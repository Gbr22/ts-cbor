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

export type DecodingControl = {
	emit(value: DecoderEventData): void;
	return(value: unknown): void;
	handlers: DecodingHandlers;
};

export type CollectionHandlerResult = {
	handlers?: DecodingHandlers;
};

export type DecodingHandlers = {
	onEnd(control: DecodingControl): unknown;
	onSimpleValue(control: DecodingControl, value: number): unknown;
	onUInt(
		control: DecodingControl,
		value: Uint8Array,
		length: number,
	): unknown;
	onNInt(
		control: DecodingControl,
		value: Uint8Array,
		length: number,
	): unknown;
	onItem(control: DecodingControl, value: unknown): unknown;
	onFloat(control: DecodingControl, value: Uint8Array): unknown;
	onArray(
		control: DecodingControl,
		length: number | undefined,
	): CollectionHandlerResult;
	onMap(
		control: DecodingControl,
		length: number | undefined,
	): CollectionHandlerResult;
	onIndefiniteByteString(control: DecodingControl): CollectionHandlerResult;
	onByteString(
		control: DecodingControl,
		length: number,
	): CollectionHandlerResult;
	onIndefiniteTextString(control: DecodingControl): CollectionHandlerResult;
	onTextString(
		control: DecodingControl,
		length: number,
	): CollectionHandlerResult;
	onTaggedValue(
		control: DecodingControl,
		tag: Uint8Array,
	): CollectionHandlerResult;
};

export type HierarchyItem = {
	itemsToRead: number;
	handler: CollectionHandlerResult | CollectionHandlerResult;
};

export type ReaderState = {
	handlers: DecodingHandlers;
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
	byteArrayNumberOfBytesToRead: number;
	unsafeTextSlice: Uint8Array | null;
	handlerHierarchy: HierarchyItem[];
	iterationState: DecoderIterationState;
	control: DecodingControl;
	enqueueEventData: (data: DecoderEventData) => void;
	yieldEndOfDataItem: (data: DecoderEventData) => void;
	getHandlers(): DecodingHandlers;
};

export function createReaderState(props: {
	handlers: DecodingHandlers;
}): ReaderState {
	let returnValue: unknown;
	const object: ReaderState = {
		handlers: props.handlers,
		decoder: undefined,
		isReaderDone: false,
		currentBuffer: new Uint8Array(),
		mode: Mode.ExpectingDataItem,
		subMode: 0,
		index: 0,
		majorType: 0,
		additionalInfo: 0,
		numberOfBytesToRead: 0,
		numberValue: 0,
		argumentBytes: new Uint8Array(),
		byteArrayNumberOfBytesToRead: 0,
		unsafeTextSlice: null,
		handlerHierarchy: [] as HierarchyItem[],
		iterationState: undefined as unknown as DecoderIterationState,
		getHandlers() {
			return this.handlerHierarchy.at(-1)?.handler.handlers ??
				this.handlers;
		},
		enqueueEventData(data: DecoderEventData) {
			this.iterationState.enqueue(wrapEventData(this.decoder!, data));
		},
		yieldEndOfDataItem(data: DecoderEventData) {
			this.enqueueEventData(data);
			checkCollectionEnd(this);
		},
		control: undefined as unknown as DecodingControl,
	};
	Object.defineProperty(object, "control", {
		get(): DecodingControl {
			const handlers = object.getHandlers();
			return {
				handlers,
				emit(data: DecoderEventData) {
					object.enqueueEventData(data);
				},
				return(value: unknown) {
					object.iterationState.return(value);
				},
			};
		},
	});
	object.handlerHierarchy.push({
		itemsToRead: 1,
		handler: {
			handlers: {
				...props.handlers,
				onItem(_control, value) {
					returnValue = value;
				},
				onEnd(_control) {
					object.control.return(returnValue);
				},
			},
		},
	});
	return object;
}
