import { MajorType } from "../common.ts";
import { ReadableValue } from "../encoder.ts";
import { collect, collectBytes } from "../utils.ts";
import { consumeByteString } from "./byte-string.ts";
import { Decoder } from "./common.ts";
import { decodeNumberEvent, isNumberEvent } from "./numbers.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "./simple-value.ts";
import { consumeTextString } from "./text-string.ts";
import { serialize } from "../common.ts";

export async function* transformDecoder(decoder: Decoder): AsyncIterableIterator<ReadableValue> {
    for await (const event of decoder.events()) {
        if (event.eventType === "end") {
            return;
        }
        if (isNumberEvent(event)) {
            yield decodeNumberEvent(event);
            continue;
        }
        if (isSimpleValueEvent(event)) {
            yield decodeSimpleValue(event.data);
            continue;
        }
        if (event.eventType === "start" && event.majorType === MajorType.Array) {
            const values = [];
            for await (const item of transformDecoder(decoder)) {
                values.push(item);
            }
            yield values;
            continue;
        }
        if (event.eventType === "start" && event.majorType === MajorType.Map) {
            const values = new Map();
            let key: unknown;
            let hasKey = false;
            for await (const item of transformDecoder(decoder)) {
                if (!hasKey) {
                    key = item;
                    hasKey = true;
                    continue;
                }
                hasKey = false;
                values.set(key, item);
            }
            yield values;
            continue;
        }
        if (event.eventType === "start" && event.majorType === MajorType.ByteString) {
            const it = await consumeByteString(decoder);
            const bytes = await collectBytes(it);
            yield bytes;
            continue;
        }
        if (event.eventType === "start" && event.majorType === MajorType.TextString) {
            const it = await consumeTextString(decoder);
            const parts = await collect(it);
            const text = parts.join("");
            yield text;
            continue;
        }
    }
}

export async function parseDecoder<T>(decoder: Decoder): Promise<T> {
    let hasValue = false;
    let value: unknown;
    for await (const item of transformDecoder(decoder)) {
        if (hasValue) {
            throw new Error(`Unexpected item; end of stream expected. Item is: ${serialize(item)}`);
        }
        value = item;
        hasValue = true;
    }
    if (hasValue) {
        return value as T;
    }
    throw new Error("Expected item");
}
