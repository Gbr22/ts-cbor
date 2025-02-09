import { MajorTypes, serialize } from "../common.ts";
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

const utf8LengthMapping = [
	//   Expected     Mask         Length
	[0b1100_0000, 0b1110_0000, 2],
	[0b1110_0000, 0b1111_0000, 3],
	[0b1111_0000, 0b1111_1000, 4],
	[0b1111_1000, 0b1111_1100, 5],
	[0b1111_1100, 0b1111_1110, 6],
	[0b1111_1110, 0b1111_1111, 7],
	[0b1111_1111, 0b1111_1111, 8],
];

function checkStringEnd(state: ReaderState) {
	if (state.byteArrayNumberOfBytesToRead <= 0) {
		state.mode = Mode.ExpectingDataItem;
		if (state.unsafeTextSlice && state.unsafeTextSlice.length > 0) {
			throw new Error(
				`Expected continuation of text string due to presence of incomplete UTF-8 sequence: ${
					JSON.stringify([...state.unsafeTextSlice])
				}`,
			);
		}
		state.getHandlers().onEnd(state.control);
		state.handlerHierarchy.pop();
		checkCollectionEnd(state);
	}
	if (state.isReaderDone) {
		throw new Error(
			`Unexpected end of stream when ${state.byteArrayNumberOfBytesToRead} bytes are left to read`,
		);
	}
}

export function handleTextStringData(state: ReaderState) {
	checkStringEnd(state);
	let fromIndex = state.index;
	let toIndex = Math.min(
		state.index + state.byteArrayNumberOfBytesToRead,
		state.currentBuffer.length,
	);
	let len = toIndex - fromIndex;
	let viewOf = state.currentBuffer;
	state.index += state.byteArrayNumberOfBytesToRead;
	state.byteArrayNumberOfBytesToRead -= len;
	if (state.unsafeTextSlice && state.unsafeTextSlice.length > 0) {
		const currentBufferSlice = state.currentBuffer.subarray(
			fromIndex,
			toIndex,
		);
		const slice = new Uint8Array(
			state.unsafeTextSlice.length + currentBufferSlice.length,
		);
		slice.set(state.unsafeTextSlice);
		slice.set(currentBufferSlice, state.unsafeTextSlice.length);
		state.unsafeTextSlice = null;

		fromIndex = 0;
		toIndex = slice.length;
		viewOf = slice;
		len = toIndex - fromIndex;
	}

	if (len > 0) {
		const last = viewOf[toIndex - 1];
		let safeSlice: Uint8Array | undefined;
		if ((last & 0b1000_0000) == 0b1000_0000 && !state.isReaderDone) {
			let startByteIndex = toIndex - 1;
			let length = 0;
			while (true) {
				if (startByteIndex < fromIndex) {
					throw new Error(
						"Invalid UTF-8 sequence in text string, buffer underflow occurred while looking for start byte",
					);
				}
				length++;
				const currentByte = viewOf[startByteIndex];
				const isStartByte = (currentByte & 0b1100_0000) === 0b1100_0000;
				if (isStartByte) {
					break;
				}
				startByteIndex--;
			}
			const startByte = viewOf[startByteIndex];
			let expectedLength = 0;
			for (const [expected, mask, length] of utf8LengthMapping) {
				if ((startByte & mask) === expected) {
					expectedLength = length;
					break;
				}
			}
			if (expectedLength != length) {
				safeSlice = viewOf.subarray(fromIndex, startByteIndex);
				const unsafeSlice = viewOf.subarray(startByteIndex, toIndex);
				state.unsafeTextSlice = unsafeSlice;
			}
		}
		if (safeSlice === undefined) {
			safeSlice = viewOf.subarray(fromIndex, toIndex);
		}

		state.getHandlers().onItem(state.control, safeSlice);
		checkStringEnd(state);
	}
}

export function consumeTextString<Decoder extends DecoderLike>(
	decoder: Decoder,
): MapDecoderToIterableIterator<Decoder, string, void, void> {
	let counter = 1;

	function handleIteration(
		state: IterationState<string, IteratorPullResult<DecoderEvent>>,
	) {
		return state.pull((result) => {
			const { done, value } = result;
			if (done) {
				throw new Error(
					`Unexpected end of stream. Depth counter: ${counter}`,
				);
			}

			if (value.eventData.majorType != MajorTypes.TextString) {
				throw new Error(
					`Unexpected major type ${value.eventData.majorType} while reading text string event: ${
						serialize(value)
					}`,
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
				const data = new TextDecoder("UTF-8", { "fatal": true }).decode(
					value.eventData.data,
				);
				state.enqueue(data);
				return;
			}
		});
	}

	function asyncImpl(d: AsyncDecoderLike) {
		const it = d[AsyncDecoderSymbol].events();
		const pull = () =>
			it.next() as Promise<IteratorPullResult<DecoderEvent>>;
		return IterationControl.createAsyncIterator<
			string,
			IteratorPullResult<DecoderEvent>,
			never[]
		>(handleIteration, pull)[Symbol.asyncIterator]();
	}

	function syncImpl(d: SyncDecoderLike) {
		const it = d[SyncDecoderSymbol].events();
		const pull = () => it.next() as IteratorPullResult<DecoderEvent>;
		return IterationControl.createSyncIterator<
			string,
			IteratorPullResult<DecoderEvent>,
			never[]
		>(handleIteration, pull)[Symbol.iterator]();
	}

	if (SyncDecoderSymbol in decoder && decoder[SyncDecoderSymbol]) {
		return syncImpl(
			decoder as SyncDecoderLike,
		) as MapDecoderToIterableIterator<
			Decoder,
			string,
			void,
			void
		>;
	}
	if (AsyncDecoderSymbol in decoder && decoder[AsyncDecoderSymbol]) {
		return asyncImpl(
			decoder as AsyncDecoderLike,
		) as MapDecoderToIterableIterator<
			Decoder,
			string,
			void,
			void
		>;
	}

	throw new Error(`Decoder is neither sync nor async`);
}
