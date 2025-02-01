import type { DecoderEvent, SimpleValueEventData } from "../events.ts";
import type { DecodingHandler } from "../parse.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "../simple-value.ts";

type SimpleValueEvent = DecoderEvent<SimpleValueEventData>;
export const simpleValueDecodingHandler: DecodingHandler<SimpleValueEvent> = {
	match: isSimpleValueEvent,
	handle: (control, event) =>
		control.yield(decodeSimpleValue(event.eventData.data)),
} satisfies DecodingHandler<SimpleValueEvent>;
