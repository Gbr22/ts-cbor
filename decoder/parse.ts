import { MajorType } from "../common.ts";
import { collect, collectBytes } from "../utils.ts";
import { consumeByteString } from "./byte-string.ts";
import { Decoder } from "./common.ts";
import { decodeNumberEvent, isNumberEvent } from "./numbers.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "./simple-value.ts";
import { consumeTextString } from "./text-string.ts";

export async function parseDecoder<T>(decoder: Decoder): Promise<T> {
    let rootObject;
    let currentObject;
    
    for await (const event of decoder.events()) {
        if (isNumberEvent(event)) {
            return decodeNumberEvent(event) as T;
        }
        if (isSimpleValueEvent(event)) {
            return decodeSimpleValue(event.data) as T;
        }
        if (event.eventType === "start" && event.majorType === MajorType.ByteString) {
            const it = await consumeByteString(decoder);
            const bytes = await collectBytes(it);
            return bytes as T;
        }
        if (event.eventType === "start" && event.majorType === MajorType.TextString) {
            const it = await consumeTextString(decoder);
            const parts = await collect(it);
            const text = parts.join("");
            return text as T;
        }
    }

    return rootObject as T;
}