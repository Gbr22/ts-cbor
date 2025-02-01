import { MajorType } from "../../common.ts";
import { ReadableValue } from "../../encoder.ts";
import { DecoderLike } from "../common.ts";
import { DecoderEvent, StartMapEventData } from "../events.ts";
import { DecoderStackItem, DecodingControl, DecodingHandler } from "../parse.ts";

type MapStartEvent = DecoderEvent<DecoderLike, StartMapEventData>;
export const mapHandler = {
    match(event: DecoderEvent): event is MapStartEvent {
        return event.eventData.eventType === "start" && event.eventData.majorType === MajorType.Map;
    },
    handle(control: DecodingControl): DecoderStackItem {
        const map = new Map<ReadableValue, ReadableValue>();
        let hasKey = false;
        let key: ReadableValue | undefined = undefined;
        return {
            type: "complex",
            onEvent(event) {
                if (event.eventData.eventType === "end") {
                    control.pop();
                    control.yield(map);
                }
            },
            onYield(value) {
                if (!hasKey) {
                    key = value;
                    hasKey = true;
                    return;
                }
                map.set(key, value);
                hasKey = false;
            }
        } as DecoderStackItem;
    }
} satisfies DecodingHandler<MapStartEvent>;
