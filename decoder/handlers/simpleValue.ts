import type { DecoderLike } from "../common.ts";
import type { DecoderEvent, SimpleValueLiteralEventData } from "../events.ts";
import type { DecodingHandler } from "../parse.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "../simple-value.ts";

type SimpleValueEvent = DecoderEvent<DecoderLike, SimpleValueLiteralEventData>;
export const simpleValueDecodingHandler: DecodingHandler<SimpleValueEvent> = {
	match: isSimpleValueEvent,
	handle: (control, event) =>
		control.yield(decodeSimpleValue(event.eventData.data)),
} satisfies DecodingHandler<SimpleValueEvent>;
