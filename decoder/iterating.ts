import { IterationControl, IterationState } from "../iteration-control.ts";
import { refreshBuffer } from "./buffer.ts";
import { checkCollectionEnd } from "./collection.ts";
import { createReaderState, AsyncDecoder, AsyncDecoderSymbol, Mode, ReaderState } from "./common.ts";
import { DecoderEvent } from "./events.ts";
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

export function decoderFromStream(stream: ReadableStream<Uint8Array>): AsyncDecoder {
	const reader = stream.getReader();
	const readerState = createReaderState(reader);

	async function pull() {
		const result = await reader.read();
		return result;
	}

	function events() {
		return IterationControl.createAsyncIterator<DecoderEvent,ReadableStreamReadResult<Uint8Array>, never[]>(handleDecoderIteration.bind(null,readerState),pull)[Symbol.asyncIterator]();
	}
	const decoder: AsyncDecoder = {
		events,
		[AsyncDecoderSymbol]: undefined as unknown as AsyncDecoder,
	}
	decoder[AsyncDecoderSymbol] = decoder;
	readerState.decoder = decoder;
	return decoder;
}
