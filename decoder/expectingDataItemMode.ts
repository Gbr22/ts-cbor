import { AdditionalInfo, MajorTypes } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { Mode, type ReaderState, SubMode } from "./common.ts";
import type { EndEventData, StartEventData } from "./events.ts";
import { flushHeaderAndArgument } from "./header.ts";
import { serialize } from "../common.ts";

const reservedAddionalInfo = Object.freeze([28, 29, 30]);
export function handleExpectingDataItemMode(state: ReaderState) {
	if (state.isReaderDone) {
		IterationControl.return();
	}
	const byte = state.currentBuffer[state.index];
	state.index++;

	state.majorType = byte >>> 5;
	state.mode = Mode.ReadingArgument;
	state.additionalInfo = byte & 0b11111;
	state.numberValue = 0;
	state.numberOfBytesToRead = 0;
	state.argumentBytes = new Uint8Array();
	state.isIndefinite = false;

	if (state.additionalInfo < AdditionalInfo.Length1) {
		state.numberValue = state.additionalInfo;
		flushHeaderAndArgument(state);
	}
	if (state.additionalInfo == AdditionalInfo.Length1) {
		state.numberOfBytesToRead = 1;
	}
	if (state.additionalInfo == AdditionalInfo.Length2) {
		state.numberOfBytesToRead = 2;
	}
	if (state.additionalInfo == AdditionalInfo.Length4) {
		state.numberOfBytesToRead = 4;
	}
	if (state.additionalInfo == AdditionalInfo.Length8) {
		state.numberValue = 0n;
		state.numberOfBytesToRead = 8;
	}
	state.argumentBytes = new Uint8Array(state.numberOfBytesToRead);
	if (reservedAddionalInfo.includes(state.additionalInfo)) {
		throw new Error(
			`AdditionalInfo cannot be ${state.additionalInfo}, reserved values are: ${
				serialize(reservedAddionalInfo)
			}`,
		);
	}
	if (state.additionalInfo == AdditionalInfo.IndefiniteLength) {
		state.isIndefinite = true;
		state.numberOfBytesToRead = 0;
		if (state.majorType == MajorTypes.ByteString) {
			state.mode = Mode.ExpectingDataItem;
			state.subMode = SubMode.ReadingIndefiniteByteString;
			state.yieldEventData(
				{
					eventType: "start",
					length: undefined,
					majorType: MajorTypes.ByteString,
				} satisfies StartEventData,
			);
		}
		if (state.majorType == MajorTypes.TextString) {
			state.mode = Mode.ExpectingDataItem;
			state.subMode = SubMode.ReadingIndefiniteTextString;
			state.yieldEventData(
				{
					eventType: "start",
					length: undefined,
					majorType: MajorTypes.TextString,
				} satisfies StartEventData,
			);
		}
		if (state.majorType == MajorTypes.SimpleValue) {
			state.mode = Mode.ExpectingDataItem;
			if (state.subMode == SubMode.ReadingIndefiniteByteString) {
				state.yieldEndOfDataItem(
					{
						eventType: "end",
						majorType: MajorTypes.ByteString,
					} satisfies EndEventData,
				);
			}
			if (state.subMode == SubMode.ReadingIndefiniteTextString) {
				state.yieldEndOfDataItem(
					{
						eventType: "end",
						majorType: MajorTypes.TextString,
					} satisfies EndEventData,
				);
			}
			if (
				state.itemsToRead.length > 0 &&
				state.itemsToRead[state.itemsToRead.length - 1] === Infinity
			) {
				state.itemsToRead.pop();
				const type = state.hierarchy.pop()!;
				state.yieldEndOfDataItem(
					{
						eventType: "end",
						majorType: type as EndEventData["majorType"],
					} satisfies EndEventData,
				);
			}
			throw new Error(`Unexpected stop code`);
		}
		if (
			state.majorType == MajorTypes.Array ||
			state.majorType == MajorTypes.Map
		) {
			state.mode = Mode.ExpectingDataItem;
			state.hierarchy.push(state.majorType);
			state.itemsToRead.push(Infinity);
			state.yieldEventData(
				{
					eventType: "start",
					length: undefined,
					majorType: state.majorType,
				} satisfies StartEventData,
			);
		}
		throw new Error(`Major Type ${state.majorType} cannot be isIndefinite`);
	}
}
