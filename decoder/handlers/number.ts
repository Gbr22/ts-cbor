import { decodeNumberEvent, isNumberEvent } from "../numbers.ts";
import type { DecodingHandler } from "../parse.ts";

export const numberDecodingHandler = {
    match: isNumberEvent,
    handle: (control, event) => control.yield(decodeNumberEvent(event))
} satisfies DecodingHandler;
