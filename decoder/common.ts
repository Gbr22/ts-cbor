import { IterationControl } from "../iteration-control.ts";
import type { AnyIterable } from "../utils.ts";
import { type DecoderEvent, type DecoderEventData, wrapEventData } from "./events.ts";
import { yieldEndOfDataItem } from "./iterating.ts";

export type DecoderEventsAsync = AsyncIterableIterator<DecoderEvent>;
export type DecoderEventsSync = IterableIterator<DecoderEvent>;

export const AsyncDecoderSymbol = Symbol("AsyncDecoder");
export type AsyncDecoderSymbol = typeof AsyncDecoderSymbol;

export const SyncDecoderSymbol = Symbol("SyncDecoder");
export type SyncDecoderSymbol = typeof SyncDecoderSymbol;

export type AsyncDecoderLike = {
    [AsyncDecoderSymbol]: AsyncDecoder;
};
export type SyncDecoderLike = {
    [SyncDecoderSymbol]: SyncDecoder;
};
export type DecoderLike = AsyncDecoderLike | SyncDecoderLike;

export interface AsyncDecoder {
    events(): DecoderEventsAsync;
    [AsyncDecoderSymbol]: AsyncDecoder;
}

export interface SyncDecoder {
    events(): DecoderEventsSync;
    [SyncDecoderSymbol]: SyncDecoder;
}
export type Decoder = AsyncDecoder | SyncDecoder;

export type MapDecoderToIterableIterator<D,A,B,C> = (
    D extends SyncDecoderLike ? IterableIterator<A,B,C> :
    D extends AsyncDecoderLike ? AsyncIterableIterator<A,B,C> :
    never
);

export type MapIterableToDecoder<I extends AnyIterable<Uint8Array>> = (
    I extends Iterable<Uint8Array> ? SyncDecoder :
    I extends AsyncIterable<Uint8Array> ? AsyncDecoder :
    never
);

export type MapDecoderToReturnType<D,T> = (
    D extends SyncDecoderLike ? T :
    D extends AsyncDecoderLike ? Promise<T> :
    never
);

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
	decoder: AsyncDecoder | SyncDecoder | undefined,
	isReaderDone: boolean,
	currentBuffer: Uint8Array
	mode: number
	subMode: number
	index: number
	majorType: number
	additionalInfo: number
	numberOfBytesToRead: number
	numberValue: number | bigint
	argumentBytes: Uint8Array
	isIndefinite: boolean
	byteArrayNumberOfBytesToRead: number
    unsafeTextSlice: Uint8Array
    itemsToRead: (number | bigint)[]
    hierarchy: number[]
    yieldQueue: DecoderEvent[]
    yieldEventData: (data: DecoderEventData)=>never
    enqueueEventData: (data: DecoderEventData)=>void
    yieldEndOfDataItem: (data: DecoderEventData)=>never
};

export function createReaderState(): ReaderState {
    return {
        decoder: undefined,
        isReaderDone: false,
        currentBuffer: new Uint8Array(),
        mode: Mode.ExpectingDataItem,
        subMode: NaN,
        index: 0,
        majorType: NaN,
        additionalInfo: NaN,
        numberOfBytesToRead: 0,
        numberValue: 0,
        argumentBytes: new Uint8Array(),
        isIndefinite: false,
        byteArrayNumberOfBytesToRead: 0,
        unsafeTextSlice: new Uint8Array(),
        itemsToRead: [],
        hierarchy: [],
        yieldQueue: [],
        yieldEventData(data: DecoderEventData) {
            return IterationControl.yield(wrapEventData(this.decoder!, data));
        },
        enqueueEventData(data: DecoderEventData) {
            this.yieldQueue.push(wrapEventData(this.decoder!, data));
        },
        yieldEndOfDataItem(data: DecoderEventData) {
            return yieldEndOfDataItem(this, wrapEventData(this.decoder!,data));
        }
    }
}
