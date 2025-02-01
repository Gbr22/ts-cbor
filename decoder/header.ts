import { AdditionalInfo, isIntegerMajorType, MajorTypes } from "../common.ts";
import { Mode, type ReaderState } from "./common.ts";
import type {
	FloatLiteralEventData,
	IntegerLiteralEventData,
	SimpleValueLiteralEventData,
	StartEventData,
	TagLiteralEventData,
} from "./events.ts";
import { decodeUint } from "./numbers.ts";

export function flushHeaderAndArgument(state: ReaderState) {
	if (isIntegerMajorType(state.majorType)) {
		state.mode = Mode.ExpectingDataItem;
		let array = state.argumentBytes;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		if (state.majorType === MajorTypes.Tag) {
			if (state.argumentBytes.length > 0) {
				state.numberValue = decodeUint(state.argumentBytes);
			}
			state.yieldEndOfDataItem(
				{
					eventType: "literal",
					majorType: MajorTypes.Tag,
					data: array,
				} satisfies TagLiteralEventData,
			);
		}
		state.yieldEndOfDataItem(
			{
				eventType: "literal",
				majorType: state
					.majorType as IntegerLiteralEventData["majorType"],
				data: array,
			} satisfies IntegerLiteralEventData,
		);
	}
	if (state.majorType == MajorTypes.SimpleValue) {
		state.mode = Mode.ExpectingDataItem;
		if (
			state.additionalInfo >= AdditionalInfo.Length2 &&
			state.additionalInfo <= AdditionalInfo.Length8
		) {
			state.yieldEndOfDataItem(
				{
					eventType: "literal",
					simpleValueType: "float",
					majorType: MajorTypes.SimpleValue,
					data: state.argumentBytes,
				} satisfies FloatLiteralEventData,
			);
		}
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		let numberValue = state.additionalInfo;
		if (state.argumentBytes.length > 0) {
			numberValue = state.argumentBytes[0];
		}

		state.yieldEndOfDataItem(
			{
				eventType: "literal",
				majorType: MajorTypes.SimpleValue,
				simpleValueType: "simple",
				data: numberValue,
			} satisfies SimpleValueLiteralEventData,
		);
	}
	if (state.majorType == MajorTypes.ByteString) {
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
		state.yieldEventData(
			{
				eventType: "start",
				length: state.byteArrayNumberOfBytesToRead,
				majorType: MajorTypes.ByteString,
			} satisfies StartEventData,
		);
	}
	if (state.majorType == MajorTypes.TextString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.unsafeTextSlice = new Uint8Array();
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				`String too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`,
			);
		}
		state.yieldEventData(
			{
				eventType: "start",
				length: state.byteArrayNumberOfBytesToRead,
				majorType: MajorTypes.TextString,
			} satisfies StartEventData,
		);
	}
	if (state.majorType == MajorTypes.Array) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		state.itemsToRead.push(state.numberValue);
		state.hierarchy.push(MajorTypes.Array);
		state.yieldEventData(
			{
				eventType: "start",
				length: state.numberValue,
				majorType: MajorTypes.Array,
			} satisfies StartEventData,
		);
	}
	if (state.majorType == MajorTypes.Map) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		const doubleLength = typeof state.numberValue === "bigint"
			? state.numberValue * 2n
			: state.numberValue * 2;
		state.itemsToRead.push(doubleLength);
		state.hierarchy.push(MajorTypes.Map);
		state.yieldEventData(
			{
				eventType: "start",
				length: state.numberValue,
				majorType: MajorTypes.Map,
			} satisfies StartEventData,
		);
	}
	throw new Error(
		`Unexpected major type ${state.majorType} while handling end of header/argument`,
	);
}
