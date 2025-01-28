import { MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { DecoderLike, DecoderSymbol, Mode, ReaderState } from "./common.ts";
import { DataEvent, EndEvent } from "./events.ts";
import { yieldEndOfDataItem } from "./iterating.ts";

const utf8LengthMapping = [
//   Expected     Mask         Length
    [0b1100_0000, 0b1110_0000, 2     ],
    [0b1110_0000, 0b1111_0000, 3     ],
    [0b1111_0000, 0b1111_1000, 4     ],
    [0b1111_1000, 0b1111_1100, 5     ],
    [0b1111_1100, 0b1111_1110, 6     ],
    [0b1111_1110, 0b1111_1111, 7     ],
    [0b1111_1111, 0b1111_1111, 8     ],
];

export function handleTextStringData(state: ReaderState) {
    if (state.byteArrayNumberOfBytesToRead <= 0) {
        state.mode = Mode.ExpectingDataItem;
        if (state.unsafeTextSlice.length > 0) {
            throw new Error(`Expected continuation of text string due to presence of incomplete UTF-8 sequence: ${JSON.stringify([...state.unsafeTextSlice])}`);
        }
        yieldEndOfDataItem<EndEvent>(state,{
            eventType: "end",
            majorType: MajorType.TextString,
            [DecoderSymbol]: state.decoder!
        });
    }
    if (state.isReaderDone) {
        throw new Error(`Unexpected end of stream when ${state.byteArrayNumberOfBytesToRead} bytes are left to read`);
    }
    const toIndex = state.index + state.byteArrayNumberOfBytesToRead;
    const currentBufferSlice = state.currentBuffer.slice(state.index, toIndex);
    state.index += state.byteArrayNumberOfBytesToRead;
    state.byteArrayNumberOfBytesToRead -= currentBufferSlice.length;
    let slice = currentBufferSlice;
    if (state.unsafeTextSlice.length > 0) {
        slice = new Uint8Array(state.unsafeTextSlice.length+currentBufferSlice.length);
        slice.set(state.unsafeTextSlice);
        slice.set(currentBufferSlice, state.unsafeTextSlice.length);
        state.unsafeTextSlice = new Uint8Array();
    }
    if (slice.length > 0) {
        const last = slice[slice.length-1];
        let safeSlice = slice;
        if ((last & 0b1000_0000) == 0b1000_0000 && !state.isReaderDone) {
            let startByteIndex = slice.length - 1;
            let length = 0;
            while (true) {
                if (startByteIndex < 0) {
                    throw new Error("Invalid UTF-8 sequence in text string, buffer underflow occurred while looking for start byte");
                }
                length++;
                const currentByte = slice[startByteIndex];
                const isStartByte = (currentByte & 0b1100_0000) === 0b1100_0000;
                if (isStartByte) {
                    break;
                }
                startByteIndex--;
            }
            const startByte = slice[startByteIndex];
            let expectedLength = 0;
            for (const [expected, mask, length] of utf8LengthMapping) {
                if ((startByte & mask) === expected) {
                    expectedLength = length;
                    break;
                }
            }
            if (expectedLength != length) {
                safeSlice = slice.slice(0, startByteIndex);
                const unsafeSlice = slice.slice(startByteIndex);
                state.unsafeTextSlice = unsafeSlice;
            }
        }

        IterationControl.yield<DataEvent>({
            eventType: "data",
            majorType: MajorType.TextString,
            data: new TextDecoder('UTF-8', { "fatal": true }).decode(safeSlice),
            [DecoderSymbol]: state.decoder!
        });
    }
}

export async function* consumeTextString(decoder: DecoderLike): AsyncIterableIterator<string,void,void> {
    let counter = 1;

    for await (const value of decoder[DecoderSymbol].events()) {
        if (value.majorType != MajorType.TextString) {
            throw new Error(`Unexpected major type ${value.majorType} while reading text string event: ${value}`);
        }
        if (value.eventType === "start") {
            counter++;
        }
        if (value.eventType === "end") {
            counter--;
        }
        if (counter === 0) {
            return;
        }
        if (value.eventType === "data") {
            yield value.data;
        }
    }
    throw new Error(`Unexpected end of stream. Depth counter: ${counter}`);
}
