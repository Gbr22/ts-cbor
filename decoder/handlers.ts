import { MajorTypes, serialize, TaggedValue } from "../common.ts";
import { concatBytes } from "../utils.ts";
import type {
	CollectionHandlerResult,
	DecodingControl,
	DecodingHandlers,
} from "./common.ts";
import {
	type DataEventData,
	DecoderEventSubTypes,
	DecoderEventTypes,
	type EndEventData,
	type FloatEventData,
	type IntegerEventData,
	type SimpleValueEventData,
	type StartArrayEventData,
	type StartEventData,
	type StartMapEventData,
	type TagEventData,
} from "./events.ts";
import { arrayDecodingHandler } from "./handlers/array.ts";
import { bigNumDecodingHandler } from "./handlers/bigNum.ts";
import { byteStringDecodingHandler } from "./handlers/byteString.ts";
import {
	mapDecodingHandler,
	mapOrObjectDecodingHandler,
} from "./handlers/map.ts";
import { numberDecodingHandler } from "./handlers/number.ts";
import { simpleValueDecodingHandler } from "./handlers/simpleValue.ts";
import { taggedValueDecodingHandler } from "./handlers/taggedValue.ts";
import { textStringDecodingHandler } from "./handlers/textString.ts";
import {
	decodeBigNInt,
	decodeBigUInt,
	decodeFloat,
	decodeNInt,
	decodeUInt,
} from "./numbers.ts";
import type { DecodingHandler } from "./parse.ts";
import { decodeSimpleValue } from "./simple-value.ts";

export const defaultDecodingHandlers: DecodingHandler[] = [
	numberDecodingHandler,
	simpleValueDecodingHandler,
	arrayDecodingHandler,
	mapOrObjectDecodingHandler,
	textStringDecodingHandler,
	byteStringDecodingHandler,
	bigNumDecodingHandler,
	taggedValueDecodingHandler,
];

export {
	arrayDecodingHandler,
	bigNumDecodingHandler,
	byteStringDecodingHandler,
	mapDecodingHandler,
	mapOrObjectDecodingHandler,
	numberDecodingHandler,
	simpleValueDecodingHandler,
	taggedValueDecodingHandler,
	textStringDecodingHandler,
};

const newDefaultDecodingHandlers: DecodingHandlers = {
	onFloat(control, bytes) {
		control.emit(
			{
				eventType: DecoderEventTypes.Literal,
				subType: DecoderEventSubTypes.Float,
				majorType: MajorTypes.SimpleValue,
				data: bytes,
			} satisfies FloatEventData,
		);

		control.handlers.onItem(control, decodeFloat(bytes));
	},
	onSimpleValue(control, numberValue) {
		control.emit(
			{
				eventType: DecoderEventTypes.Literal,
				majorType: MajorTypes.SimpleValue,
				subType: DecoderEventSubTypes.SimpleValue,
				data: numberValue,
			} satisfies SimpleValueEventData,
		);

		control.handlers.onItem(control, decodeSimpleValue(numberValue));
	},
	onArray: function (
		parentControl: DecodingControl,
		length: number | undefined,
	): CollectionHandlerResult {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Start,
				majorType: MajorTypes.Array,
				length,
			} satisfies StartArrayEventData,
		);

		const array = new Array(length ?? 0);
		let index = 0;

		return {
			handlers: {
				...parentControl.handlers,
				onItem(_control, value) {
					array[index] = value;
					index++;
				},
				onEnd(control) {
					control.emit({
						eventType: DecoderEventTypes.End,
						majorType: MajorTypes.Array,
					});
					parentControl.handlers.onItem(control, array);
				},
			},
		};
	},
	onMap(parentControl, length) {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Start,
				majorType: MajorTypes.Map,
				length,
			} satisfies StartMapEventData,
		);

		const entries: [unknown, unknown][] = [];
		let hasKey = false;
		let key: unknown;
		let areAllKeysStrings = true;

		return {
			handlers: {
				...parentControl.handlers,
				onItem(_control, value) {
					if (hasKey) {
						entries.push([key, value]);
						hasKey = false;
					} else {
						key = value;
						hasKey = true;
						if (typeof key !== "string") {
							areAllKeysStrings = false;
						}
					}
				},
				onEnd(control) {
					control.emit({
						eventType: DecoderEventTypes.End,
						majorType: MajorTypes.Map,
					});
					const value = areAllKeysStrings
						? Object.fromEntries(entries)
						: new Map(entries);
					parentControl.handlers.onItem(control, value);
				},
			},
		};
	},
	onTaggedValue(parentControl, data: Uint8Array) {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Tag,
				majorType: MajorTypes.Tag,
				data,
			} satisfies TagEventData,
		);

		let hasItem = false;
		let item: unknown;

		return {
			handlers: {
				...parentControl.handlers,
				onItem(_control, value) {
					if (hasItem) {
						throw new Error(
							"Unexpected item. Tagged value already has item",
						);
					}
					hasItem = true;
					item = value;
				},
				onEnd(control) {
					const tag = decodeUInt(data);
					let value: unknown = new TaggedValue(tag, item);
					if (tag === 2) {
						value = decodeBigUInt(item as Uint8Array);
					}
					if (tag === 3) {
						value = decodeBigNInt(item as Uint8Array);
					}
					parentControl.handlers.onItem(control, value);
				},
			},
		};
	},
	onEnd: function (_control: DecodingControl) {
		throw new Error("Unexpected end event");
	},
	onItem: function (_control: DecodingControl, value: unknown) {
		throw new Error(`Unexpected item: ${serialize(value)}`);
	},
	onUInt: function (control, value) {
		control.emit(
			{
				eventType: DecoderEventTypes.Literal,
				majorType: MajorTypes.UnsignedInteger,
				data: value
			} satisfies IntegerEventData,
		);

		control.handlers.onItem(control, decodeUInt(value));
	},
	onNInt(control, value) {
		control.emit(
			{
				eventType: DecoderEventTypes.Literal,
				majorType: MajorTypes.NegativeInteger,
				data: value
			} satisfies IntegerEventData,
		);

		control.handlers.onItem(control, decodeNInt(value));
	},
	onIndefiniteByteString(parentControl: DecodingControl) {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Start,
				length: undefined,
				majorType: MajorTypes.ByteString,
			} satisfies StartEventData,
		);

		const values: Uint8Array[] = [];

		return {
			handlers: {
				...parentControl.handlers,
				onItem(_control, value: Uint8Array) {
					values.push(value);
				},
				onEnd(control) {
					control.emit({
						eventType: DecoderEventTypes.End,
						majorType: MajorTypes.ByteString,
					});

					parentControl.handlers.onItem(control, concatBytes(...values));
				},
			},
		};
	},
	onByteString(parentControl, length) {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Start,
				length,
				majorType: MajorTypes.ByteString,
			} satisfies StartEventData,
		);

		const buffer = new Uint8Array(length);
		let index = 0;
		return {
			handlers: {
				...parentControl.handlers,
				onItem(control, value: Uint8Array) {
					control.emit(
						{
							eventType: DecoderEventTypes.Data,
							majorType: MajorTypes.ByteString,
							data: value,
						} satisfies DataEventData,
					);

					buffer.set(value, index);
					index += value.length;
				},
				onEnd(control) {
					control.emit(
						{
							eventType: DecoderEventTypes.End,
							majorType: MajorTypes.ByteString,
						} satisfies EndEventData,
					);

					parentControl.handlers.onItem(control, buffer);
				},
			},
		};
	},
	onIndefiniteTextString(parentControl: DecodingControl) {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Start,
				length: undefined,
				majorType: MajorTypes.TextString,
			} satisfies StartEventData,
		);

		const values: string[] = [];

		return {
			handlers: {
				...parentControl.handlers,
				onItem(_control, value: string) {
					values.push(value);
				},
				onEnd(control) {
					control.emit({
						eventType: DecoderEventTypes.End,
						majorType: MajorTypes.TextString,
					});
					parentControl.handlers.onItem(control, values.join(""));
				},
			},
		};
	},
	onTextString(parentControl, length) {
		parentControl.emit(
			{
				eventType: DecoderEventTypes.Start,
				length,
				majorType: MajorTypes.TextString,
			} satisfies StartEventData,
		);

		const buffer = new Uint8Array(length);
		let index = 0;

		return {
			handlers: {
				...parentControl.handlers,
				onItem(control, value: Uint8Array) {
					control.emit(
						{
							eventType: DecoderEventTypes.Data,
							majorType: MajorTypes.TextString,
							data: value,
						} satisfies DataEventData,
					);

					buffer.set(value, index);
					index += value.length;
				},
				onEnd(control) {
					control.emit(
						{
							eventType: DecoderEventTypes.End,
							majorType: MajorTypes.TextString,
						} satisfies EndEventData,
					);

					parentControl.handlers.onItem(
						control,
						new TextDecoder("UTF-8", { fatal: true }).decode(
							buffer,
						),
					);
				},
			},
		};
	},
};

export const defaultValueDecodingHandlers: DecodingHandlers =
	newDefaultDecodingHandlers;
export const defaultEventDecodingHandlers: DecodingHandlers =
	newDefaultDecodingHandlers;
