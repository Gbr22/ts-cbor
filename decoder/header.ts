import { isNumerical, MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { Mode, ReaderState } from "./common.ts";

export function flushHeaderAndArgument(state: ReaderState) {
	if (isNumerical(state.majorType)) {
		state.mode = Mode.ExpectingDataItem;
		if (state.majorType === MajorType.NegativeInteger) {
			if (typeof state.numberValue === "bigint") {
				state.numberValue = (state.numberValue * -1n) -1n;
			} else {
				state.numberValue = (state.numberValue * -1) -1;
			}
		}
		IterationControl.yield({
			eventType: "literal",
			majorType: state.majorType,
			data: state.numberValue,
		});
	}
	if (state.majorType == MajorType.SimpleValue) {
		if (state.additionalInfo >= 25 && state.additionalInfo <= 27) {
			// TODO: Implement float
			IterationControl.yield({
				eventType: "literal",
				majorType: MajorType.SimpleValue,
				bytes: state.argumentBytes,
				data: state.numberValue,
			})
		}
		let numberValue = state.additionalInfo;
		if (state.argumentBytes.length > 0) {
			numberValue = state.argumentBytes[0];
		}
		let value: number | false | true | null | undefined = Number(numberValue);
		if (numberValue == 20) {
			value = false;
		}
		if (numberValue == 21) {
			value = true;
		}
		if (numberValue == 22) {
			value = null;
		}
		if (numberValue == 23) {
			value = undefined;
		}
		IterationControl.yield({
			eventType: "literal",
			majorType: MajorType.SimpleValue,
			numberValue: numberValue,
			data: value,
		});
	}
	if (state.majorType == MajorType.ByteString) {
		state.mode = Mode.ReadingData;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error("Array too large");
		}
		IterationControl.yield({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.ByteString,
		});
	}
	if (state.majorType == MajorType.TextString) {
		state.mode = Mode.ReadingData;
		state.unsafeTextSlice = new Uint8Array();
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error("String too large");
		}
		IterationControl.yield({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.TextString,
		});
	}
	throw new Error("Invalid major type");
}
