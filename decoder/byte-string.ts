import { MajorTypes } from "../common.ts";
import { IterationControl, type IterationState } from "../iteration-control.ts";
import { checkCollectionEnd } from "./collection.ts";
import {
	type AsyncDecoderLike,
	AsyncDecoderSymbol,
	type DecoderLike,
	type MapDecoderToIterableIterator,
	Mode,
	type ReaderState,
	type SyncDecoderLike,
	SyncDecoderSymbol,
} from "./common.ts";
import { type DecoderEvent, DecoderEventTypes } from "./events.ts";
import type { IteratorPullResult } from "./iterating.ts";

function checkStringEnd(state: ReaderState) {
	if (state.byteArrayNumberOfBytesToRead <= 0) {
		state.mode = Mode.ExpectingDataItem;
		state.getHandlers().onEnd(state.control);
		state.handlerHierarchy.pop();
		checkCollectionEnd(state);
	}
	if (state.isReaderDone) {
		throw new Error(
			`Unexpected end of stream while trying to read ${state.byteArrayNumberOfBytesToRead} more bytes for text string`,
		);
	}
}

export function handleByteStringData(state: ReaderState) {
	checkStringEnd(state);
	const to = state.index + state.byteArrayNumberOfBytesToRead;
	const slice = state.currentBuffer.subarray(state.index, to);
	state.index += state.byteArrayNumberOfBytesToRead;
	state.byteArrayNumberOfBytesToRead -= slice.length;
	if (slice.length > 0) {
		state.getHandlers().onItem(state.control, slice);
		checkStringEnd(state);
	}
}

export function consumeByteString<Decoder extends DecoderLike>(
	decoder: Decoder,
): MapDecoderToIterableIterator<Decoder, Uint8Array, void, void> {
	let counter = 1;

	function handleIteration(
		state: IterationState<Uint8Array, IteratorPullResult<DecoderEvent>>,
	) {
		return state.pull((result) => {
			const { done, value } = result;
			if (done) {
				throw new Error(
					`Unexpected end of stream. Depth counter: ${counter}`,
				);
			}

			if (value.eventData.majorType != MajorTypes.ByteString) {
				throw new Error(
					`Unexpected major type ${value.eventData.majorType} while reading byte string`,
				);
			}
			if (value.eventData.eventType === DecoderEventTypes.Start) {
				counter++;
			}
			if (value.eventData.eventType === DecoderEventTypes.End) {
				counter--;
			}
			if (counter === 0) {
				state.return();
				return;
			}
			if (value.eventData.eventType === DecoderEventTypes.Data) {
				state.enqueue(value.eventData.data);
			}
		});
	}

	function asyncImpl(d: AsyncDecoderLike) {
		const it = d[AsyncDecoderSymbol].events();
		const pull = () =>
			it.next() as Promise<IteratorPullResult<DecoderEvent>>;
		return IterationControl.createAsyncIterator<
			Uint8Array,
			IteratorPullResult<DecoderEvent>,
			never[]
		>(handleIteration, pull)[Symbol.asyncIterator]();
	}

	function syncImpl(d: SyncDecoderLike) {
		const it = d[SyncDecoderSymbol].events();
		const pull = () => it.next() as IteratorPullResult<DecoderEvent>;
		return IterationControl.createSyncIterator<
			Uint8Array,
			IteratorPullResult<DecoderEvent>,
			never[]
		>(handleIteration, pull)[Symbol.iterator]();
	}

	if (SyncDecoderSymbol in decoder && decoder[SyncDecoderSymbol]) {
		return syncImpl(
			decoder as SyncDecoderLike,
		) as MapDecoderToIterableIterator<
			Decoder,
			Uint8Array,
			void,
			void
		>;
	}
	if (AsyncDecoderSymbol in decoder && decoder[AsyncDecoderSymbol]) {
		return asyncImpl(
			decoder as AsyncDecoderLike,
		) as MapDecoderToIterableIterator<Decoder, Uint8Array, void, void>;
	}

	throw new Error(`Decoder is neither sync nor async`);
}
