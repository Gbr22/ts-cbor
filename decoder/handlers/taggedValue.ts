import { TaggedValue } from "../../common.ts";
import { type DecoderEvent, isTagEvent, type TagEvent } from "../events.ts";
import { decodeUInt } from "../numbers.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

export const taggedValueDecodingHandler: DecodingHandler<TagEvent> =
	createTaggedValueDecodingHandler(() => true, (data) => data);

export function createTaggedValueDecodingHandler(
	matchTag: (tag: number | bigint) => boolean,
	mapper: (data: TaggedValue<unknown>) => unknown,
): DecodingHandler<TagEvent> {
	const handler = {
		match(event: DecoderEvent): event is TagEvent {
			return isTagEvent(event) &&
				matchTag(decodeUInt(event.eventData.data));
		},
		handle(
			control: DecodingControl,
			event: TagEvent,
		): DecoderHandlerInstance {
			const taggedValue = new TaggedValue<unknown>(
				decodeUInt(event.eventData.data),
				undefined,
			);
			return {
				onEvent() {},
				onYield(value) {
					taggedValue.value = value;
					control.pop();
					return control.yield(mapper(taggedValue));
				},
			} as DecoderHandlerInstance;
		},
	} satisfies DecodingHandler<TagEvent>;
	return handler;
}
