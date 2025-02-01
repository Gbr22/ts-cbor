import { MajorType, serialize } from "../../common.ts";
import { concatBytes } from "../../utils.ts";
import type { DecoderLike } from "../common.ts";
import type { DecoderEvent, StartByteStringEventData } from "../events.ts";
import type { DecoderHandlerInstance, DecodingControl, DecodingHandler } from "../parse.ts";

type ByteStringStartEvent = DecoderEvent<DecoderLike, StartByteStringEventData>;
export const byteStringDecodingHandler = {
    match(event: DecoderEvent): event is ByteStringStartEvent {
        return event.eventData.eventType === "start" && event.eventData.majorType === MajorType.ByteString;
    },
    handle(control: DecodingControl): DecoderHandlerInstance {
        const values: Uint8Array[] = [];
        let counter = 1;
        return {
            onEvent(event) {
                if (event.eventData.majorType != MajorType.ByteString) {
                    throw new Error(`Unexpected major type ${event.eventData.majorType} while reading byte string`);
                }
                if (event.eventData.eventType === "start") {
                    counter++;
                }
                if (event.eventData.eventType === "end") {
                    counter--;
                }
                if (counter === 0) {
                    control.pop();
                    control.yield(concatBytes(...values));
                }
                if (event.eventData.eventType === "data") {
                    values.push(event.eventData.data);
                }
                control.continue();
            },
            onYield(value) {
                throw new Error(`Unexpected yield while reading byte string: ${serialize(value)}`);
            }
        } as DecoderHandlerInstance;
    }
} satisfies DecodingHandler<ByteStringStartEvent>;
