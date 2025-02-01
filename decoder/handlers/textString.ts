import { MajorType, serialize } from "../../common.ts";
import { DecoderLike } from "../common.ts";
import { DecoderEvent, StartTextStringEventData } from "../events.ts";
import { DecoderHandlerInstance, DecodingControl, DecodingHandler } from "../parse.ts";

type TextStringStartEvent = DecoderEvent<DecoderLike, StartTextStringEventData>;
export const textStringDecodingHandler = {
    match(event: DecoderEvent): event is TextStringStartEvent {
        return event.eventData.eventType === "start" && event.eventData.majorType === MajorType.TextString;
    },
    handle(control: DecodingControl): DecoderHandlerInstance {
        const values: string[] = [];
        let counter = 1;
        return {
            onEvent(event) {
                if (event.eventData.majorType != MajorType.TextString) {
                    throw new Error(`Unexpected major type ${event.eventData.majorType} while reading text string`);
                }
                if (event.eventData.eventType === "start") {
                    counter++;
                }
                if (event.eventData.eventType === "end") {
                    counter--;
                }
                if (counter === 0) {
                    control.pop();
                    control.yield(values.join(""));
                }
                if (event.eventData.eventType === "data") {
                    values.push(event.eventData.data);
                }
                control.continue();
            },
            onYield(value) {
                throw new Error(`Unexpected yield while reading text string: ${serialize(value)}`);
            }
        } as DecoderHandlerInstance;
    }
} satisfies DecodingHandler<TextStringStartEvent>;
