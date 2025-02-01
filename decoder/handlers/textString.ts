import { MajorTypes, serialize } from "../../common.ts";
import {
	bindIsStartEvent,
	type DecoderEvent,
	DecoderEventTypes,
	type StartTextStringEventData,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

type TextStringStartEvent = DecoderEvent<StartTextStringEventData>;
export const textStringDecodingHandler: DecodingHandler<TextStringStartEvent> =
	{
		match: bindIsStartEvent(MajorTypes.TextString),
		handle(control: DecodingControl): DecoderHandlerInstance {
			const values: string[] = [];
			let counter = 1;
			return {
				onEvent(event) {
					if (event.eventData.majorType != MajorTypes.TextString) {
						throw new Error(
							`Unexpected major type ${event.eventData.majorType} while reading text string`,
						);
					}
					if (event.eventData.eventType === DecoderEventTypes.Start) {
						counter++;
					}
					if (event.eventData.eventType === DecoderEventTypes.End) {
						counter--;
					}
					if (counter === 0) {
						control.pop();
						control.yield(values.join(""));
					}
					if (event.eventData.eventType === DecoderEventTypes.Data) {
						values.push(event.eventData.data);
					}
					control.continue();
				},
				onYield(value) {
					throw new Error(
						`Unexpected yield while reading text string: ${
							serialize(value)
						}`,
					);
				},
			} as DecoderHandlerInstance;
		},
	} satisfies DecodingHandler<TextStringStartEvent>;
