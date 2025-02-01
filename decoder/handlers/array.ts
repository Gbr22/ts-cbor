import { MajorTypes } from "../../common.ts";
import {
	bindIsStartEvent,
	type DecoderEvent,
	DecoderEventTypes,
	type StartArrayEventData,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

type ArrayStartEvent = DecoderEvent<StartArrayEventData>;
export const arrayDecodingHandler: DecodingHandler<ArrayStartEvent> = {
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
} satisfies DecodingHandler<ArrayStartEvent>;
