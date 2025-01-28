import { AdditionalInfo, isIntegerMajorType, MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { SimpleValueLiteralEvent } from "../main.ts";
import { DecoderSymbol, Mode, ReaderState } from "./common.ts";
import { FloatLiteralEvent, IntegerLiteralEvent, StartEvent, TagLiteralEvent } from "./events.ts";
import { yieldEndOfDataItem } from "./iterating.ts";
import { decodeUint } from "./numbers.ts";

export function flushHeaderAndArgument(state: ReaderState) {
	if (isIntegerMajorType(state.majorType)) {
		state.mode = Mode.ExpectingDataItem;
		if (state.majorType === MajorType.Tag) {
			if (state.argumentBytes.length > 0) {
				state.numberValue = decodeUint(state.argumentBytes);
			}
			yieldEndOfDataItem<TagLiteralEvent>(state,{
				eventType: "literal",
				majorType: MajorType.Tag,
				data: state.argumentBytes,
				[DecoderSymbol]: state.decoder!,
			});
		}
		let array = state.argumentBytes;
		if (array.length <= 0) {
			array = new Uint8Array([state.additionalInfo]);
		}
		yieldEndOfDataItem<IntegerLiteralEvent>(state,{
			eventType: "literal",
			majorType: state.majorType as IntegerLiteralEvent["majorType"],
			data: array,
			[DecoderSymbol]: state.decoder!,
		});
	}
	if (state.majorType == MajorType.SimpleValue) {
		state.mode = Mode.ExpectingDataItem;
		if (state.additionalInfo >= AdditionalInfo.Length2 && state.additionalInfo <= AdditionalInfo.Length8) {
			yieldEndOfDataItem<FloatLiteralEvent>(state,{
				eventType: "literal",
				simpleValueType: "float",
				majorType: MajorType.SimpleValue,
				data: state.argumentBytes,
				[DecoderSymbol]: state.decoder!,
			});
		}
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		let numberValue = state.additionalInfo;
		if (state.argumentBytes.length > 0) {
			numberValue = state.argumentBytes[0];
		}
		
		yieldEndOfDataItem<SimpleValueLiteralEvent>(state,{
			eventType: "literal",
			majorType: MajorType.SimpleValue,
			simpleValueType: "simple",
			data: numberValue,
			[DecoderSymbol]: state.decoder!,
		});
	}
	if (state.majorType == MajorType.ByteString) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ReadingData;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error(`Array too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`);
		}
		IterationControl.yield<StartEvent>({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.ByteString,
			[DecoderSymbol]: state.decoder!,
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
			throw new Error(`String too large. Size is ${state.numberValue} while Number.MAX_SAFE_INTEGER is ${Number.MAX_SAFE_INTEGER}`);
		}
		IterationControl.yield<StartEvent>({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.TextString,
			[DecoderSymbol]: state.decoder!,
		});
	}
	if (state.majorType == MajorType.Array) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		state.itemsToRead.push(state.numberValue);
		state.hierarchy.push(MajorType.Array);
		IterationControl.yield<StartEvent>({
			eventType: "start",
			length: state.numberValue,
			majorType: MajorType.Array,
			[DecoderSymbol]: state.decoder!,
		});
	}
	if (state.majorType == MajorType.Map) {
		if (state.argumentBytes.length > 0) {
			state.numberValue = decodeUint(state.argumentBytes);
		}
		state.mode = Mode.ExpectingDataItem;
		const doubleLength = typeof state.numberValue === "bigint" ? state.numberValue * 2n : state.numberValue * 2;
		state.itemsToRead.push(doubleLength);
		state.hierarchy.push(MajorType.Map);
		IterationControl.yield<StartEvent>({
			eventType: "start",
			length: state.numberValue,
			majorType: MajorType.Map,
			[DecoderSymbol]: state.decoder!,
		});
	}
	throw new Error(`Unexpected major type ${state.majorType} while handling end of header/argument`);
}
