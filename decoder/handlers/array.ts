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
	handle(
		control: DecodingControl,
		event: StartArrayEvent,
	): DecoderHandlerInstance {
		const values: unknown[] = new Array(
			Number(event.eventData.length || 0),
		);
		let index = 0;
		return {
			onEvent(event) {
				if (event.eventData.eventType === DecoderEventTypes.End) {
					control.pop();
					return control.yield(values);
				}
			},
			onYield(value) {
				values[index++] = value;
			},
		} as DecoderHandlerInstance;
	},
} satisfies DecodingHandler<StartArrayEvent>;
