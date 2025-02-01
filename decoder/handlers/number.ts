import type { NumberEvent } from "../events.ts";
import { decodeNumberEvent, isNumberEvent } from "../numbers.ts";
import type { DecodingHandler } from "../parse.ts";

export const numberDecodingHandler: DecodingHandler<NumberEvent> = {
	match: isNumberEvent,
	handle: (control, event) => control.yield(decodeNumberEvent(event)),
};
