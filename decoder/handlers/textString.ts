import { MajorTypes, serialize } from "../../common.ts";
import type { DecoderEvent, StartTextStringEventData } from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

type TextStringStartEvent = DecoderEvent<StartTextStringEventData>;
export const textStringDecodingHandler: DecodingHandler<TextStringStartEvent> =
	{
		match(event: DecoderEvent): event is TextStringStartEvent {
			return event.eventData.eventType === "start" &&
				event.eventData.majorType === MajorTypes.TextString;
		},
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
					if (event.eventData.eventType === "start") {
						counter++;
					}
					if (event.eventData.eventType === "end") {
						counter--;
					}
					if (counter === 0) {
						control.pop();
						control.yield(values.join(""));
					}
					if (event.eventData.eventType === "data") {
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
