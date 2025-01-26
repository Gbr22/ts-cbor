import { MajorType } from "../common.ts";
import { collectBytes } from "../utils.ts";
import { consumeByteString } from "./byte-string.ts";
import { Decoder } from "./common.ts";

export async function parseDecoder<T>(decoder: Decoder): Promise<T> {
    let rootObject;
    let currentObject;
    
    for await (const event of decoder.events()) {
        if (event.eventType === "literal") {
            return event.data as T;
        }
        if (event.eventType === "start" && event.majorType === MajorType.ByteString) {
            const it = await consumeByteString(decoder);
            const bytes = await collectBytes(it);
            return bytes as T;
        }
    }

    return rootObject as T;
}