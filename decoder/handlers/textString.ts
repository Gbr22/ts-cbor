import { MajorTypes, serialize } from "../../common.ts";
import { concatBytes } from "../../utils.ts";
import {
	bindIsStartEvent,
	DecoderEventTypes,
	type StartTextStringEvent,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

export const textStringDecodingHandler: DecodingHandler<StartTextStringEvent> =
	{
		match: bindIsStartEvent(MajorTypes.TextString),
		handle(
			control: DecodingControl,
			startEvent: StartTextStringEvent,
		): DecoderHandlerInstance {
			const values: Uint8Array[] = [];
			const bytes = startEvent.eventData.length
				? new Uint8Array(Number(startEvent.eventData.length))
				: null;
			let index = 0;
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
						return control.yield(
							new TextDecoder("UTF-8", { "fatal": true }).decode(
								bytes ? bytes : concatBytes(...values),
							),
						);
					}
					if (event.eventData.eventType === DecoderEventTypes.Data) {
						if (bytes) {
							bytes.set(event.eventData.data, index);
							index += event.eventData.data.length;
						} else {
							values.push(event.eventData.data);
						}
					}
					return true;
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
	} satisfies DecodingHandler<StartTextStringEvent>;
