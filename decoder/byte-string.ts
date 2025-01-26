import { MajorType } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { Decoder, Mode, ReaderState } from "./common.ts";
import { DataEvent, EndEvent } from "./events.ts";

export async function handleByteStringData(state: ReaderState) {
    if (state.byteArrayNumberOfBytesToRead <= 0) {
        state.mode = Mode.ExpectingDataItem;
        IterationControl.yield<EndEvent>({
            eventType: "end",
            majorType: MajorType.ByteString,
        });
    }
    if (state.isReaderDone) {
        throw new Error(`Unexpected end of stream when ${state.byteArrayNumberOfBytesToRead} bytes are left to read`);
    }
    const to = state.index + state.byteArrayNumberOfBytesToRead;
    const slice = state.currentBuffer.slice(state.index, to);
    state.index += state.byteArrayNumberOfBytesToRead;
    state.byteArrayNumberOfBytesToRead -= slice.length;
    if (slice.length > 0) {
        IterationControl.yield<DataEvent>({
            eventType: "data",
            majorType: MajorType.ByteString,
            data: slice,
        });
    }
}

export async function* consumeByteString(decoder: Decoder): AsyncIterableIterator<Uint8Array,void,void> {
    let counter = 1;

    for await (const value of decoder.events()) {
        if (value.majorType != MajorType.ByteString) {
            throw new Error(`Unexpected major type ${value.majorType} while reading byte string`);
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