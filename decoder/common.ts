import type { AnyIterable } from "../utils.ts";
import { checkCollectionEnd } from "./collection.ts";
import {
	type DecoderEvent,
	type DecoderEventData,
	wrapEventData,
} from "./events.ts";
import type { DecoderIterationState } from "./iterating.ts";

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

export type MapDecoderToIterableIterator<
	Decoder = DecoderLike,
	Yield = unknown,
	Return = unknown,
	Next = unknown,
> = Decoder extends AsyncDecoderLike
	? AsyncIterableIterator<Yield, Return, Next>
	: Decoder extends SyncDecoderLike ? IterableIterator<Yield, Return, Next>
	: never;

export type MapIterableToDecoder<I extends AnyIterable<Uint8Array>> = I extends
	Iterable<Uint8Array> ? SyncDecoder
	: I extends AsyncIterable<Uint8Array> ? AsyncDecoder
	: never;

export type MapDecoderToReturnType<D, T> = D extends SyncDecoderLike ? T
	: D extends AsyncDecoderLike ? Promise<T>
	: never;

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
	decoder: AsyncDecoder | SyncDecoder | undefined;
	isReaderDone: boolean;
	currentBuffer: Uint8Array;
	mode: number;
	subMode: number;
	index: number;
	majorType: number;
	additionalInfo: number;
	numberOfBytesToRead: number;
	numberValue: number | bigint;
	argumentBytes: Uint8Array;
	isIndefinite: boolean;
	byteArrayNumberOfBytesToRead: number;
	unsafeTextSlice: Uint8Array | null;
	itemsToRead: (number | bigint)[];
	hierarchy: number[];
	iterationState: DecoderIterationState;
	enqueueEventData: (data: DecoderEventData) => void;
	yieldEndOfDataItem: (data: DecoderEventData) => void;
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
		unsafeTextSlice: null,
		itemsToRead: [],
		hierarchy: [],
		iterationState: undefined as unknown as DecoderIterationState,
		enqueueEventData(data: DecoderEventData) {
			this.iterationState.enqueue(wrapEventData(this.decoder!, data));
		},
		yieldEndOfDataItem(data: DecoderEventData) {
			this.enqueueEventData(data);
			checkCollectionEnd(this);
		},
	};
}
