import { AdditionalInfo, BREAK_BYTE, MajorTypes } from "../common.ts";
import { Mode, type ReaderState, SubMode } from "./common.ts";
import {
	DecoderEventTypes,
	type EndEventData,
	type StartEventData,
} from "./events.ts";
import { flushHeaderAndArgument } from "./header.ts";
import { handleReadingArgumentMode } from "./readingArgumentMode.ts";

const RESERVED_MIN = 28;
const RESERVED_MAX = 30;
export function handleExpectingDataItemMode(
	state: ReaderState,
) {
	if (state.isReaderDone) {
		state.iterationState.return();
		return;
	}

	const byte = state.currentBuffer[state.index];

	if (byte === BREAK_BYTE) {
		state.mode = Mode.ExpectingDataItem;
		if (state.subMode == SubMode.ReadingIndefiniteByteString) {
			state.yieldEndOfDataItem(
				{
					eventType: DecoderEventTypes.End,
					majorType: MajorTypes.ByteString,
				} satisfies EndEventData,
			);
		} else if (state.subMode == SubMode.ReadingIndefiniteTextString) {
			state.yieldEndOfDataItem(
				{
					eventType: DecoderEventTypes.End,
					majorType: MajorTypes.TextString,
				} satisfies EndEventData,
			);
		} else if (
			state.itemsToRead.length > 0 &&
			state.itemsToRead[state.itemsToRead.length - 1] === Infinity
		) {
			state.itemsToRead.pop();
			const type = state.hierarchy.pop()!;
			state.yieldEndOfDataItem(
				{
					eventType: DecoderEventTypes.End,
					majorType: type as EndEventData["majorType"],
				} satisfies EndEventData,
			);
		} else {
			throw new Error(`Unexpected stop code`);
		}
		return;
	}

	state.index++;

	state.majorType = byte >>> 5;
	state.mode = Mode.ReadingArgument;
	state.additionalInfo = byte & 0b11111;
	state.numberValue = 0;
	state.numberOfBytesToRead = 0;

	if (state.additionalInfo < AdditionalInfo.Length1) {
		state.numberValue = state.additionalInfo;
		state.argumentBytes = new Uint8Array();
		flushHeaderAndArgument(state);
	} else if (
		state.additionalInfo >= AdditionalInfo.Length1 &&
		state.additionalInfo <= AdditionalInfo.Length8
	) {
		state.numberOfBytesToRead = 2 **
			(state.additionalInfo - AdditionalInfo.Length1);
		state.argumentBytes = new Uint8Array(state.numberOfBytesToRead);
	} else if (state.additionalInfo == AdditionalInfo.IndefiniteLength) {
		state.numberOfBytesToRead = 0;
		if (state.majorType == MajorTypes.ByteString) {
			state.mode = Mode.ExpectingDataItem;
			state.subMode = SubMode.ReadingIndefiniteByteString;
			state.enqueueEventData(
				{
					eventType: DecoderEventTypes.Start,
					length: undefined,
					majorType: MajorTypes.ByteString,
				} satisfies StartEventData,
			);
		} else if (state.majorType == MajorTypes.TextString) {
			state.mode = Mode.ExpectingDataItem;
			state.subMode = SubMode.ReadingIndefiniteTextString;
			state.enqueueEventData(
				{
					eventType: DecoderEventTypes.Start,
					length: undefined,
					majorType: MajorTypes.TextString,
				} satisfies StartEventData,
			);
		} else if (
			state.majorType == MajorTypes.Array ||
			state.majorType == MajorTypes.Map
		) {
			state.mode = Mode.ExpectingDataItem;
			state.hierarchy.push(state.majorType);
			state.itemsToRead.push(Infinity);
			state.enqueueEventData(
				{
					eventType: DecoderEventTypes.Start,
					length: undefined,
					majorType: state.majorType,
				} satisfies StartEventData,
			);
		} else {
			throw new Error(
				`Major Type ${state.majorType} cannot be isIndefinite`,
			);
		}
	} else if (
		state.additionalInfo >= RESERVED_MIN &&
		state.additionalInfo <= RESERVED_MAX
	) {
		throw new Error(
			`AdditionalInfo cannot be ${state.additionalInfo}, reserved values are between: ${RESERVED_MIN} and ${RESERVED_MAX}`,
		);
	} else {
		throw new Error(`Unexpected additional info: ${state.additionalInfo}`);
	}
	while (
		state.numberOfBytesToRead > 0 &&
		state.index < state.currentBuffer.length
	) {
		handleReadingArgumentMode(state);
	}
}
