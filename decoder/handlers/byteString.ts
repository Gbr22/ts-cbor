import { MajorTypes, serialize } from "../../common.ts";
import { concatBytes } from "../../utils.ts";
import {
	bindIsStartEvent,
	DecoderEventTypes,
	type StartByteStringEvent,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

export const byteStringDecodingHandler: DecodingHandler<StartByteStringEvent> =
	{
		match: bindIsStartEvent(MajorTypes.ByteString),
		handle(
			control: DecodingControl,
			startEvent: StartByteStringEvent,
		): DecoderHandlerInstance {
			const values: Uint8Array[] = [];
			const bytes = startEvent.eventData.length
				? new Uint8Array(Number(startEvent.eventData.length))
				: null;
			let index = 0;
			let counter = 1;

			return {
				onEvent(event) {
					if (event.eventData.majorType != MajorTypes.ByteString) {
						throw new Error(
							`Unexpected major type ${event.eventData.majorType} while reading byte string`,
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
						if (bytes) {
							return control.yield(bytes);
						}
						return control.yield(concatBytes(...values));
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
						`Unexpected yield while reading byte string: ${
							serialize(value)
						}`,
					);
				},
			} as DecoderHandlerInstance;
		},
	} satisfies DecodingHandler<StartByteStringEvent>;
