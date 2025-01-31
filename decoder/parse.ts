import { MajorType } from "../common.ts";
import { ReadableValue } from "../encoder.ts";
import { collect, collectBytes } from "../utils.ts";
import { consumeByteString } from "./byte-string.ts";
import { AsyncDecoder } from "./common.ts";
import { decodeNumberEvent, isNumberEvent } from "./numbers.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "./simple-value.ts";
import { consumeTextString } from "./text-string.ts";
import { serialize } from "../common.ts";
import { SyncDecoder } from "../main.ts";

export async function* transformDecoder(decoder: AsyncDecoder): AsyncIterableIterator<ReadableValue> {
    for await (const event of decoder.events()) {
        if (event.eventData.eventType === "end") {
            return;
        }
        if (isNumberEvent(event)) {
            yield decodeNumberEvent(event);
            continue;
        }
        if (isSimpleValueEvent(event)) {
            yield decodeSimpleValue(event.eventData.data);
            continue;
        }
        if (event.eventData.eventType === "start" && event.eventData.majorType === MajorType.Array) {
            const values = [];
            for await (const item of transformDecoder(decoder)) {
                values.push(item);
            }
            yield values;
            continue;
        }
        if (event.eventData.eventType === "start" && event.eventData.majorType === MajorType.Map) {
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
        if (event.eventData.eventType === "start" && event.eventData.majorType === MajorType.ByteString) {
            const it = await consumeByteString(decoder);
            const bytes = await collectBytes(it);
            yield bytes;
            continue;
        }
        if (event.eventData.eventType === "start" && event.eventData.majorType === MajorType.TextString) {
            const it = await consumeTextString(decoder);
            const parts = await collect(it);
            const text = parts.join("");
            yield text;
            continue;
        }
    }
}

export async function parseDecoder<T>(decoder: AsyncDecoder): Promise<T> {
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

export type MapDecoderToIterator<D,A,B,C> = (
    D extends AsyncDecoder ?
        AsyncIterableIterator<A,B,C>
        :
        D extends SyncDecoder ?
            IterableIterator<A,B,C>
            :
            never
);
