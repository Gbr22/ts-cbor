import { MajorTypes, serialize } from "../common.ts";
import { IterationControl, type IterationState } from "../iteration-control.ts";
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
import {
	type DataEventData,
	type DecoderEvent,
	DecoderEventTypes,
	type EndEventData,
} from "./events.ts";
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

export function handleTextStringData(state: ReaderState) {
	if (state.byteArrayNumberOfBytesToRead <= 0) {
		state.mode = Mode.ExpectingDataItem;
		if (state.unsafeTextSlice.length > 0) {
			throw new Error(
				`Expected continuation of text string due to presence of incomplete UTF-8 sequence: ${
					JSON.stringify([...state.unsafeTextSlice])
				}`,
			);
		}
		state.yieldEndOfDataItem(
			{
				eventType: DecoderEventTypes.End,
				majorType: MajorTypes.TextString,
			} satisfies EndEventData,
		);
	}
	if (state.isReaderDone) {
		throw new Error(
			`Unexpected end of stream when ${state.byteArrayNumberOfBytesToRead} bytes are left to read`,
		);
	}
	const toIndex = state.index + state.byteArrayNumberOfBytesToRead;
	const currentBufferSlice = state.currentBuffer.slice(state.index, toIndex);
	state.index += state.byteArrayNumberOfBytesToRead;
	state.byteArrayNumberOfBytesToRead -= currentBufferSlice.length;
	let slice = currentBufferSlice;
	if (state.unsafeTextSlice.length > 0) {
		slice = new Uint8Array(
			state.unsafeTextSlice.length + currentBufferSlice.length,
		);
		slice.set(state.unsafeTextSlice);
		slice.set(currentBufferSlice, state.unsafeTextSlice.length);
		state.unsafeTextSlice = new Uint8Array();
	}
	if (slice.length > 0) {
		const last = slice[slice.length - 1];
		let safeSlice = slice;
		if ((last & 0b1000_0000) == 0b1000_0000 && !state.isReaderDone) {
			let startByteIndex = slice.length - 1;
			let length = 0;
			while (true) {
				if (startByteIndex < 0) {
					throw new Error(
						"Invalid UTF-8 sequence in text string, buffer underflow occurred while looking for start byte",
					);
				}
				length++;
				const currentByte = slice[startByteIndex];
				const isStartByte = (currentByte & 0b1100_0000) === 0b1100_0000;
				if (isStartByte) {
					break;
				}
				startByteIndex--;
			}
			const startByte = slice[startByteIndex];
			let expectedLength = 0;
			for (const [expected, mask, length] of utf8LengthMapping) {
				if ((startByte & mask) === expected) {
					expectedLength = length;
					break;
				}
			}
			if (expectedLength != length) {
				safeSlice = slice.slice(0, startByteIndex);
				const unsafeSlice = slice.slice(startByteIndex);
				state.unsafeTextSlice = unsafeSlice;
			}
		}

		state.yieldEventData(
			{
				eventType: DecoderEventTypes.Data,
				majorType: MajorTypes.TextString,
				data: new TextDecoder("UTF-8", { "fatal": true }).decode(
					safeSlice,
				),
			} satisfies DataEventData,
		);
	}
}

export function consumeTextString<Decoder extends DecoderLike>(
	decoder: Decoder,
): MapDecoderToIterableIterator<Decoder, string, void, void> {
	let counter = 1;

	function handleIteration(
		state: IterationState<string, IteratorPullResult<DecoderEvent>>,
	) {
		const result = state.pulled.shift();
		if (!result) {
			state.pull();
			IterationControl.continue();
		}
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
			IterationControl.return();
		}
		if (value.eventData.eventType === DecoderEventTypes.Data) {
			IterationControl.yield(value.eventData.data);
		}
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
