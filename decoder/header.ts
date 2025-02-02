import { AdditionalInfo, MajorTypes } from "../common.ts";
import { Mode, type ReaderState } from "./common.ts";
import {
	DecoderEventSubTypes,
	DecoderEventTypes,
	type FloatEventData,
	type IntegerEventData,
	type SimpleValueEventData,
	type StartEventData,
	type TagEventData,
} from "./events.ts";
import { decodeUint } from "./numbers.ts";

export function flushHeaderAndArgument(state: ReaderState) {
	if (
		state.majorType === MajorTypes.UnsignedInteger ||
		state.majorType === MajorTypes.NegativeInteger
	) {
		state.mode = Mode.ExpectingDataItem;
		let array = state.argumentBytes;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		state.yieldEndOfDataItem(
			{
				eventType: DecoderEventTypes.Literal,
				majorType: state
					.majorType as IntegerEventData["majorType"],
				data: array,
			} satisfies IntegerEventData,
		);
	} else if (state.majorType === MajorTypes.Tag) {
		state.mode = Mode.ExpectingDataItem;
		let array = state.argumentBytes;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.enqueueEventData(
			{
				eventType: DecoderEventTypes.Tag,
				majorType: MajorTypes.Tag,
				data: array,
			} satisfies TagEventData,
		);
	} else if (state.majorType == MajorTypes.SimpleValue) {
		state.mode = Mode.ExpectingDataItem;
		if (
			state.additionalInfo >= AdditionalInfo.Length2 &&
			state.additionalInfo <= AdditionalInfo.Length8
		) {
			state.yieldEndOfDataItem(
				{
					eventType: DecoderEventTypes.Literal,
					subType: DecoderEventSubTypes.Float,
					majorType: MajorTypes.SimpleValue,
					data: state.argumentBytes,
				} satisfies FloatEventData,
			);
		} else {
			if (state.argumentBytes.length > 0) {
				state.numberValue = decodeUint(state.argumentBytes);
			}
			let numberValue = state.additionalInfo;
			if (state.argumentBytes.length > 0) {
				numberValue = state.argumentBytes[0];
			}

			state.yieldEndOfDataItem(
				{
					eventType: DecoderEventTypes.Literal,
					majorType: MajorTypes.SimpleValue,
					subType: DecoderEventSubTypes.SimpleValue,
					data: numberValue,
				} satisfies SimpleValueEventData,
			);
		}
	} else if (state.majorType == MajorTypes.ByteString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				`Array too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`,
			);
		}
		state.enqueueEventData(
			{
				eventType: DecoderEventTypes.Start,
				length: state.byteArrayNumberOfBytesToRead,
				majorType: MajorTypes.ByteString,
			} satisfies StartEventData,
		);
	} else if (state.majorType == MajorTypes.TextString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.unsafeTextSlice = null;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				`String too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`,
			);
		}
		state.enqueueEventData(
			{
				eventType: DecoderEventTypes.Start,
				length: state.byteArrayNumberOfBytesToRead,
				majorType: MajorTypes.TextString,
			} satisfies StartEventData,
		);
	} else if (state.majorType == MajorTypes.Array) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		state.itemsToRead.push(state.numberValue);
		state.hierarchy.push(MajorTypes.Array);
		state.enqueueEventData(
			{
				eventType: DecoderEventTypes.Start,
				length: state.numberValue,
				majorType: MajorTypes.Array,
			} satisfies StartEventData,
		);
	} else if (state.majorType == MajorTypes.Map) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		const doubleLength = typeof state.numberValue === "bigint"
			? state.numberValue * 2n
			: state.numberValue * 2;
		state.itemsToRead.push(doubleLength);
		state.hierarchy.push(MajorTypes.Map);
		state.enqueueEventData(
			{
				eventType: DecoderEventTypes.Start,
				length: state.numberValue,
				majorType: MajorTypes.Map,
			} satisfies StartEventData,
		);
	} else {
		throw new Error(
			`Unexpected major type ${state.majorType} while handling end of header/argument`,
		);
	}
}
