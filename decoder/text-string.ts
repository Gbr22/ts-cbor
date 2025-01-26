import { MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { Decoder, Mode, ReaderState } from "./common.ts";

export async function handleTextStringData(state: ReaderState) {
    if (state.byteArrayNumberOfBytesToRead <= 0) {
        state.mode = Mode.ExpectingDataItem;
        IterationControl.yield({
            eventType: "end",
            majorType: MajorType.TextString,
        });
    }
    if (state.isReaderDone) {
        throw new Error(`Unexpected end of stream when ${state.byteArrayNumberOfBytesToRead} bytes are left to read`);
    }
    const to = state.index + state.byteArrayNumberOfBytesToRead;
    const currentBufferSlice = state.currentBuffer.slice(state.index, to);
    const slice = new Uint8Array(state.unsafeTextSlice.length+currentBufferSlice.length);
    slice.set(state.unsafeTextSlice);
    slice.set(currentBufferSlice, state.unsafeTextSlice.length);
    state.index += state.byteArrayNumberOfBytesToRead;
    state.byteArrayNumberOfBytesToRead -= slice.length;
    if (slice.length > 0) {
        const last = slice[slice.length-1];
        let safeSlice = slice;
        if ((last & 0b1000_0000) == 0b1000_0000) {
            let safeIndex = slice.length - 1;
            while (true) {
                if (safeIndex < 0) {
                    throw new Error("Invalid UTF-8 sequence in text string");
                }
                const isSafe = (slice[safeIndex] & 0b1100_0000) === 0b1100_0000;
                if (isSafe) {
                    break;
                }
                safeIndex--;
            }
            safeSlice = slice.slice(0, safeIndex);
            const unsafeSlice = slice.slice(safeIndex);
            state.unsafeTextSlice = unsafeSlice;
        }

        IterationControl.yield({
            eventType: "data",
            majorType: MajorType.TextString,
            data: new TextDecoder('UTF-8', { "fatal": true }).decode(safeSlice),
        });
    }
}

export async function* consumeTextString(decoder: Decoder): AsyncIterableIterator<string,void,void> {
    let counter = 1;

    for await (const value of decoder.events()) {
        if (value.majorType != MajorType.TextString) {
            throw new Error(`Unexpected major type ${value.majorType} while reading text string`);
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
    throw new Error(`Unexpected end of stream counter: ${counter}`);
}
