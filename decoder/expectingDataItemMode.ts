import { AdditionalInfo, MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { DecoderSymbol, Mode, ReaderState, SubMode } from "./common.ts";
import { EndEvent, StartEvent } from "./events.ts";
import { flushHeaderAndArgument } from "./header.ts";
import { yieldEndOfDataItem } from "./iterating.ts";
import { serialize } from "../common.ts";

const reservedAddionalInfo = Object.freeze([28,29,30]);
export async function handleExpectingDataItemMode(state: ReaderState) {
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
        throw new Error(`AdditionalInfo cannot be ${state.additionalInfo}, reserved values are: ${serialize(reservedAddionalInfo)}`);
    }
    if (state.additionalInfo == AdditionalInfo.IndefiniteLength) {
        state.isIndefinite = true;
        state.numberOfBytesToRead = 0;
        if (state.majorType == MajorType.ByteString) {
            state.mode = Mode.ExpectingDataItem;
            state.subMode = SubMode.ReadingIndefiniteByteString;
            IterationControl.yield<StartEvent>({
                eventType: "start",
                length: undefined,
                majorType: MajorType.ByteString,
                [DecoderSymbol]: state.decoder!,
            });
        }
        if (state.majorType == MajorType.TextString) {
            state.mode = Mode.ExpectingDataItem;
            state.subMode = SubMode.ReadingIndefiniteTextString;
            IterationControl.yield<StartEvent>({
                eventType: "start",
                length: undefined,
                majorType: MajorType.TextString,
                [DecoderSymbol]: state.decoder!,
            });
        }
        if (state.majorType == MajorType.SimpleValue) {
            state.mode = Mode.ExpectingDataItem;
            if (state.subMode == SubMode.ReadingIndefiniteByteString) {
                yieldEndOfDataItem<EndEvent>(state,{
                    eventType: "end",
                    majorType: MajorType.ByteString,
                    [DecoderSymbol]: state.decoder!,
                });
            }
            if (state.subMode == SubMode.ReadingIndefiniteTextString) {
                yieldEndOfDataItem<EndEvent>(state,{
                    eventType: "end",
                    majorType: MajorType.TextString,
                    [DecoderSymbol]: state.decoder!,
                });
            }
            throw new Error(`Unexpected stop code`);
        }
        throw new Error(`Major Type ${state.majorType} cannot be isIndefinite`);
    }
}