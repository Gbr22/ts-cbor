import { isIntegerMajorType, MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { SimpleValueLiteralEvent } from "../main.ts";
import { Mode, ReaderState } from "./common.ts";
import { FloatLiteralEvent, IntegerLiteralEvent, StartEvent, TagLiteralEvent } from "./events.ts";
import { decodeUint } from "./numbers.ts";

export function flushHeaderAndArgument(state: ReaderState) {
	if (isIntegerMajorType(state.majorType)) {
		state.mode = Mode.ExpectingDataItem;
		if (state.majorType === MajorType.Tag) {
			if (state.argumentBytes.length > 0) {
				state.numberValue = decodeUint(state.argumentBytes);
			}
			IterationControl.yield<TagLiteralEvent>({
				eventType: "literal",
				majorType: MajorType.Tag,
				data: state.argumentBytes,
			});
		}
		let array = state.argumentBytes;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		IterationControl.yield<IntegerLiteralEvent>({
			eventType: "literal",
			majorType: state.majorType as IntegerLiteralEvent["majorType"],
			data: array,
		});
	}
	if (state.majorType == MajorType.SimpleValue) {
		if (state.additionalInfo >= 25 && state.additionalInfo <= 27) {
			IterationControl.yield<FloatLiteralEvent>({
				eventType: "literal",
				simpleValueType: "float",
				majorType: MajorType.SimpleValue,
				data: state.argumentBytes,
			});
		}
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		let numberValue = state.additionalInfo;
		if (state.argumentBytes.length > 0) {
			numberValue = state.argumentBytes[0];
		}
		
		IterationControl.yield<SimpleValueLiteralEvent>({
			eventType: "literal",
			majorType: MajorType.SimpleValue,
			simpleValueType: "simple",
			data: numberValue,
		});
	}
	if (state.majorType == MajorType.ByteString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error("Array too large");
		}
		IterationControl.yield<StartEvent>({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.ByteString,
		});
	}
	if (state.majorType == MajorType.TextString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.unsafeTextSlice = new Uint8Array();
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error("String too large");
		}
		IterationControl.yield<StartEvent>({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.TextString,
		});
	}
	throw new Error("Invalid major type");
}
