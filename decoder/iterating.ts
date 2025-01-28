import { IterationControl } from "../iteration-control.ts";
import { refreshBuffer } from "./buffer.ts";
import { checkCollectionEnd } from "./collection.ts";
import { createReaderState, Decoder, DecoderSymbol, Mode, ReaderState } from "./common.ts";
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

async function handleDecoderIteration(state: ReaderState) {
	flushYieldQueue(state);
	await refreshBuffer(state);
	handleDecoderIterationData(state);
}

export function yieldEndOfDataItem<Event extends DecoderEvent>(state: ReaderState, event: Event): never {
	checkCollectionEnd(state);
	IterationControl.yield<DecoderEvent>(event);
}

export function decoderFromStream(stream: ReadableStream<Uint8Array>): Decoder {
	const reader = stream.getReader();
	const state = createReaderState(reader);

	function events() {
		return IterationControl.createIterator<DecoderEvent>(async () => {
			await handleDecoderIteration(state);
		})[Symbol.asyncIterator]();
	}
	const decoder: Decoder = {
		events,
		[DecoderSymbol]: undefined as unknown as Decoder,
	}
	decoder[DecoderSymbol] = decoder;
	state.decoder = decoder;
	return decoder;
}
