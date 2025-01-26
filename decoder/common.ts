import { DecoderEvent } from "./events.ts";

export type DecoderEvents = AsyncIterableIterator<DecoderEvent>;

export interface Decoder {
    events(): DecoderEvents;
}

export const Mode = Object.freeze({
    ExpectingDataItem: 0,
    ReadingArgument: 1,
    ReadingData: 2,
});

export const SubMode = Object.freeze({
    Normal: 0,
    ReadingIndefiniteByteString: 1,
    ReadingIndefiniteTextString: 2,
});

export type ReaderState = {
	reader: ReadableStreamDefaultReader<Uint8Array>
	isReaderDone: boolean,
	currentBuffer: Uint8Array
	mode: number
	subMode: number
	index: number
	majorType: number
	additionalInfo: number
	numberOfBytesToRead: number
	numberValue: number | bigint
	argumentBytes: number[]
	isIndefinite: boolean
	byteArrayNumberOfBytesToRead: number
    unsafeTextSlice: Uint8Array
};

export function createReaderState(reader: ReadableStreamDefaultReader<Uint8Array>): ReaderState {
    return {
        reader,
        isReaderDone: false,
        currentBuffer: new Uint8Array(),
        mode: Mode.ExpectingDataItem,
        subMode: NaN,
        index: 0,
        majorType: NaN,
        additionalInfo: NaN,
        numberOfBytesToRead: 0,
        numberValue: 0,
        argumentBytes: [],
        isIndefinite: false,
        byteArrayNumberOfBytesToRead: 0,
        unsafeTextSlice: new Uint8Array(),
    }
}
