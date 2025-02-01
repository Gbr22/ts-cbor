import { MajorType } from "../../common.ts";
import { ReadableValue } from "../../encoder.ts";
import { DecoderLike } from "../common.ts";
import { DecoderEvent, StartArrayEventData } from "../events.ts";
import { DecoderStackItem, DecodingControl, DecodingHandler } from "../parse.ts";

type ArrayStartEvent = DecoderEvent<DecoderLike, StartArrayEventData>;
export const arrayHandler = {
    match(event: DecoderEvent): event is ArrayStartEvent {
        return event.eventData.eventType === "start" && event.eventData.majorType === MajorType.Array;
    },
    handle(control: DecodingControl): DecoderStackItem {
        const values: ReadableValue[] = [];
        return {
            type: "complex",
            onEvent(event) {
                if (event.eventData.eventType === "end") {
                    control.pop();
                    control.yield(values);
                }
            },
            onYield(value) {
                values.push(value);
            }
        } as DecoderStackItem;
    }
} satisfies DecodingHandler<ArrayStartEvent>;
