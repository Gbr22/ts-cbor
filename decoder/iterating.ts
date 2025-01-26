import { IterationControl } from "../iteration-control.ts";
import { refreshBuffer } from "./buffer.ts";
import { checkCollectionEnd } from "./collection.ts";
import { createReaderState, Mode, ReaderState } from "./common.ts";
import { DecoderEvent } from "./events.ts";
import { handleExpectingDataItemMode } from "./expectingDataItemMode.ts";
import { handleReadingArgumentMode } from "./readingArgumentMode.ts";
import { handleReadingDataMode } from "./readingDataMode.ts";

async function handleDecoderIterationData(state: ReaderState) {
	if (state.mode == Mode.ReadingData) {
		await handleReadingDataMode(state);
		return;
	}
	if (state.mode == Mode.ExpectingDataItem) {
		await handleExpectingDataItemMode(state);
		return;
	}
	if (state.mode == Mode.ReadingArgument) {
		await handleReadingArgumentMode(state);
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
	await flushYieldQueue(state);
	await refreshBuffer(state);
	await handleDecoderIterationData(state);
}

export function yieldEndOfDataItem<Event extends DecoderEvent>(state: ReaderState, event: Event): never {
	checkCollectionEnd(state);
	IterationControl.yield<DecoderEvent>(event);
}

export function decoderFromStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const state = createReaderState(reader);

	function events() {
		return IterationControl.createIterator<DecoderEvent>(async () => {
			await handleDecoderIteration(state);
		})[Symbol.asyncIterator]();
	}
	return {
		events,
	}	
}
