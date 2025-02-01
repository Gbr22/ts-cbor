import { IterationControl, type IterationState } from "../iteration-control.ts";
import type { AnyIterable } from "../utils.ts";
import { refreshBuffer } from "./buffer.ts";
import { checkCollectionEnd } from "./collection.ts";
import { createReaderState, type AsyncDecoder, AsyncDecoderSymbol, Mode, type ReaderState, type MapIterableToDecoder, type SyncDecoder, SyncDecoderSymbol } from "./common.ts";
import type { DecoderEvent } from "./events.ts";
import { handleExpectingDataItemMode } from "./expectingDataItemMode.ts";
import { handleReadingArgumentMode } from "./readingArgumentMode.ts";
import { handleReadingDataMode } from "./readingDataMode.ts";

function handleDecoderIterationData(state: ReaderState) {
	if (state.mode == Mode.ReadingData) {
		handleReadingDataMode(state);
		return;
	}
	if (state.mode == Mode.ExpectingDataItem) {
		handleExpectingDataItemMode(state);
		return;
	}
	if (state.mode == Mode.ReadingArgument) {
		handleReadingArgumentMode(state);
		return;
	}
	throw new Error(`Unexpected mode ${state.mode} in ReaderState`);
}

function flushYieldQueue(state: ReaderState) {
	if (state.yieldQueue.length > 0) {
		const event = state.yieldQueue.pop()!;
		IterationControl.yield<DecoderEvent>(event);
	}
}

export type IteratorPullResult<T> = {
	done: false,
	value: T,
} | {
	done: true,
	value?: T,
};
export type DecoderIterationState = IterationState<DecoderEvent, IteratorPullResult<Uint8Array>, never[]>;

function handleDecoderIteration(readerState: ReaderState, iterationState: DecoderIterationState) {
	flushYieldQueue(readerState);
	refreshBuffer(iterationState, readerState);
	handleDecoderIterationData(readerState);
}

export function yieldEndOfDataItem<Event extends DecoderEvent>(state: ReaderState, event: Event): never {
	checkCollectionEnd(state);
	IterationControl.yield<DecoderEvent>(event);
}

export function decoderFromIterable<I extends AnyIterable<Uint8Array>>(iterable: I): MapIterableToDecoder<I> {
	const readerState = createReaderState();
	if (Symbol.iterator in iterable) {
		const it = iterable[Symbol.iterator]();
		const pull = it.next.bind(it) as ()=>IteratorPullResult<Uint8Array>;
		const events = ()=>{
			return IterationControl.createSyncIterator<DecoderEvent, IteratorPullResult<Uint8Array>, never[]>(handleDecoderIteration.bind(null,readerState),pull)[Symbol.iterator]();
		}
		const decoder: SyncDecoder = {
			events,
			[SyncDecoderSymbol]: undefined as unknown as SyncDecoder,
		}
		decoder[SyncDecoderSymbol] = decoder;
		readerState.decoder = decoder;
		return decoder as MapIterableToDecoder<I>;
	}
	if (Symbol.asyncIterator in iterable) {
		const it = iterable[Symbol.asyncIterator]();
		const pull = it.next.bind(it) as ()=>Promise<IteratorPullResult<Uint8Array>>;
		const events = ()=>{
			return IterationControl.createAsyncIterator<DecoderEvent, IteratorPullResult<Uint8Array>, never[]>(handleDecoderIteration.bind(null,readerState),pull)[Symbol.asyncIterator]();
		}
		const decoder: AsyncDecoder = {
			events,
			[AsyncDecoderSymbol]: undefined as unknown as AsyncDecoder,
		}
		decoder[AsyncDecoderSymbol] = decoder;
		readerState.decoder = decoder;
		return decoder as MapIterableToDecoder<I>;
	}
	throw new Error("Expected iterable to have either Symbol.iterator or Symbol.asyncIterator");
}

export function decoderFromStream(stream: ReadableStream<Uint8Array>): AsyncDecoder {
	return decoderFromIterable(stream);
}
