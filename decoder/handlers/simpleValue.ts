import type { DecoderLike } from "../common.ts";
import type { DecoderEvent, SimpleValueLiteralEventData } from "../events.ts";
import type { DecodingHandler } from "../parse.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "../simple-value.ts";

export const simpleValueDecodingHandler = {
    match: isSimpleValueEvent,
    handle: (control, event) => control.yield(decodeSimpleValue(event.eventData.data))
} satisfies DecodingHandler<DecoderEvent<DecoderLike, SimpleValueLiteralEventData>>;
