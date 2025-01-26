import { MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { Mode, ReaderState, SubMode } from "./common.ts";
import { flushHeaderAndArgument } from "./header.ts";

export async function handleExpectingDataItemMode(state: ReaderState) {
    if (state.isReaderDone) {
        IterationControl.return();
    }
    const byte = state.currentBuffer[state.index];
    state.index++;
    
    state.majorType = byte >>> 5;
    state.mode = Mode.ReadingArgument;
    state.additionalInfo = byte & 0b00011111;
    state.numberValue = 0;
    state.numberOfBytesToRead = 0;
    state.argumentBytes = [];
    state.isIndefinite = false;

    if (state.additionalInfo < 24) {
        state.numberValue = state.additionalInfo;
        flushHeaderAndArgument(state);
    }
    if (state.additionalInfo == 24) {
        state.numberOfBytesToRead = 1;
    }
    if (state.additionalInfo == 25) {
        state.numberOfBytesToRead = 2;
    }
    if (state.additionalInfo == 26) {
        state.numberOfBytesToRead = 4;
    }
    if (state.additionalInfo == 27) {
        state.numberValue = 0n;
        state.numberOfBytesToRead = 8;
    }
    if ([28,29,30].includes(state.additionalInfo)) {
        throw new Error(`additionalInfo cannot be ${state.additionalInfo}`);
    }
    if (state.additionalInfo == 31) {
        state.isIndefinite = true;
        state.numberOfBytesToRead = 0;
        if (state.majorType == MajorType.ByteString) {
            state.mode = Mode.ExpectingDataItem;
            state.subMode = SubMode.ReadingIndefiniteByteString;
            IterationControl.yield({
                eventType: "start",
                length: undefined,
                majorType: MajorType.ByteString,
            });
        }
        if (state.majorType == MajorType.SimpleValue) {
            state.mode = Mode.ExpectingDataItem;
            if (state.subMode == SubMode.ReadingIndefiniteByteString) {
                IterationControl.yield({
                    eventType: "end",
                    majorType: MajorType.ByteString
                });
            }
            throw new Error(`Unexpected stop code`);
        }
        throw new Error(`Major Type ${state.majorType} cannot be isIndefinite`);
    }
}