import { AdditionalInfo, MajorTypes } from "../common.ts";
import { checkCollectionEnd } from "./collection.ts";
import { Mode, type ReaderState } from "./common.ts";
import { decodeUInt } from "./numbers.ts";

export function flushHeaderAndArgument(state: ReaderState) {
	if (
		state.majorType === MajorTypes.UnsignedInteger ||
		state.majorType === MajorTypes.NegativeInteger
	) {
		state.mode = Mode.ExpectingDataItem;
		let array = state.argumentBytes;
		const length = state.argumentBytes.length;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		if (state.majorType === MajorTypes.UnsignedInteger) {
			state.getHandlers().onUInt(state.control, array, length);
		} else {
			state.getHandlers().onNInt(state.control, array, length);
		}
		checkCollectionEnd(state);
	} else if (state.majorType === MajorTypes.Tag) {
		state.mode = Mode.ExpectingDataItem;
		let array = state.argumentBytes;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUInt(state.argumentBytes);
		}
		state.handlerHierarchy.push({
			itemsToRead: 1,
			handler: state.getHandlers().onTaggedValue(state.control, array),
		});
	} else if (state.majorType == MajorTypes.SimpleValue) {
		state.mode = Mode.ExpectingDataItem;
		if (
			state.additionalInfo >= AdditionalInfo.Length2 &&
			state.additionalInfo <= AdditionalInfo.Length8
		) {
			state.getHandlers().onFloat(state.control, state.argumentBytes);
			checkCollectionEnd(state);
		} else {
			if (state.argumentBytes.length > 0) {
				state.numberValue = decodeUInt(state.argumentBytes);
			}
			let numberValue = state.additionalInfo;
			if (state.argumentBytes.length > 0) {
				numberValue = state.argumentBytes[0];
			}
			state.getHandlers().onSimpleValue(state.control, numberValue);
			checkCollectionEnd(state);
		}
	} else if (state.majorType == MajorTypes.ByteString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUInt(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				`Array too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`,
			);
		}
		state.handlerHierarchy.push({
			handler: state.getHandlers().onByteString(
				state.control,
				state.byteArrayNumberOfBytesToRead,
			),
			itemsToRead: Infinity,
		});
	} else if (state.majorType == MajorTypes.TextString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUInt(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.unsafeTextSlice = null;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error(
				`String too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`,
			);
		}
		state.handlerHierarchy.push({
			handler: state.getHandlers().onTextString(
				state.control,
				state.byteArrayNumberOfBytesToRead,
			),
			itemsToRead: Infinity,
		});
	} else if (state.majorType == MajorTypes.Array) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUInt(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		state.handlerHierarchy.push({
			handler: state.getHandlers().onArray(
				state.control,
				Number(state.numberValue),
			),
			itemsToRead: Number(state.numberValue),
		});
	} else if (state.majorType == MajorTypes.Map) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUInt(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		const doubleLength = typeof state.numberValue === "bigint"
			? state.numberValue * 2n
			: state.numberValue * 2;
		state.handlerHierarchy.push({
			handler: state.getHandlers().onMap(
				state.control,
				Number(state.numberValue),
			),
			itemsToRead: Number(doubleLength),
		});
	} else {
		throw new Error(
			`Unexpected major type ${state.majorType} while handling end of header/argument`,
		);
	}
}
