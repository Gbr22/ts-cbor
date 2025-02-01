import { MajorTypes } from "../../common.ts";
import {
	bindIsStartEvent,
	DecoderEventTypes,
	type StartArrayEvent,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

export const arrayDecodingHandler: DecodingHandler<StartArrayEvent> = {
	match: bindIsStartEvent(MajorTypes.Array),
	handle(control: DecodingControl): DecoderHandlerInstance {
		const values: unknown[] = [];
		return {
			onEvent(event) {
				if (event.eventData.eventType === DecoderEventTypes.End) {
					control.pop();
					control.yield(values);
				}
			},
			onYield(value) {
				values.push(value);
			},
		} as DecoderHandlerInstance;
	},
} satisfies DecodingHandler<StartArrayEvent>;
