import type { DecoderLike } from "../common.ts";
import type { DecoderEvent, NumberEventData } from "../events.ts";
import { decodeNumberEvent, isNumberEvent } from "../numbers.ts";
import type { DecodingHandler } from "../parse.ts";

type NumberEvent = DecoderEvent<DecoderLike, NumberEventData>
export const numberDecodingHandler: DecodingHandler<NumberEvent> = {
    match: isNumberEvent,
    handle: (control, event) => control.yield(decodeNumberEvent(event))
};
