import { MajorType, serialize, TaggedValue } from "../../common.ts";
import { concatBytes } from "../../utils.ts";
import { DecoderLike } from "../common.ts";
import { DecoderEvent, TagLiteralEventData } from "../events.ts";
import { decodeUint } from "../numbers.ts";
import { DecoderHandlerInstance, DecodingControl, DecodingHandler } from "../parse.ts";

type TagEvent = DecoderEvent<DecoderLike, TagLiteralEventData>;
export const taggedValueDecodingHandler = {
    match(event: DecoderEvent): event is TagEvent {
        return event.eventData.eventType === "literal" && event.eventData.majorType === MajorType.Tag;
    },
    handle(control: DecodingControl, event: TagEvent): DecoderHandlerInstance {
        const taggedValue = new TaggedValue(decodeUint(event.eventData.data), undefined);
        return {
            onEvent(event) {
                
            },
            onYield(value) {
                taggedValue.value = value;
                control.pop();
                control.yield(taggedValue);
            }
        } as DecoderHandlerInstance;
    }
} satisfies DecodingHandler<TagEvent>;
