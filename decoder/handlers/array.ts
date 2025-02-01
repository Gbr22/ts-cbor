import { MajorType } from "../../common.ts";
import type { DecoderLike } from "../common.ts";
import {
	bindIsStartEvent,
	type DecoderEvent,
	type StartArrayEventData,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

type ArrayStartEvent = DecoderEvent<DecoderLike, StartArrayEventData>;
export const arrayDecodingHandler: DecodingHandler<ArrayStartEvent> = {
	match: bindIsStartEvent(MajorType.Array),
	handle(control: DecodingControl): DecoderHandlerInstance {
		const values: unknown[] = [];
		return {
			onEvent(event) {
				if (event.eventData.eventType === "end") {
					control.pop();
					control.yield(values);
				}
			},
			onYield(value) {
				values.push(value);
			},
		} as DecoderHandlerInstance;
	},
} satisfies DecodingHandler<ArrayStartEvent>;
