import type { SimpleValueEvent } from "../events.ts";
import type { DecodingHandler } from "../parse.ts";
import { decodeSimpleValue, isSimpleValueEvent } from "../simple-value.ts";

export const simpleValueDecodingHandler: DecodingHandler<SimpleValueEvent> = {
	match: isSimpleValueEvent,
	handle: (control, event) =>
		control.yield(decodeSimpleValue(event.eventData.data)),
} satisfies DecodingHandler<SimpleValueEvent>;
