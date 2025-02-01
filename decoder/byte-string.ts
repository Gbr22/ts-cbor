import { MajorType } from "../common.ts";
import { IterationControl, IterationState } from "../iteration-control.ts";
import { AsyncDecoderLike, AsyncDecoderSymbol, DecoderLike, MapDecoderToIterableIterator, Mode, ReaderState, SyncDecoderLike, SyncDecoderSymbol } from "./common.ts";
import { DataEventData, DecoderEvent, EndEventData } from "./events.ts";
import { IteratorPullResult } from "./iterating.ts";

export function handleByteStringData(state: ReaderState) {
    if (state.byteArrayNumberOfBytesToRead <= 0) {
        state.mode = Mode.ExpectingDataItem;
        state.yieldEndOfDataItem({
            eventType: "end",
            majorType: MajorType.ByteString,
        } satisfies EndEventData);
    }
    if (state.isReaderDone) {
        throw new Error(`Unexpected end of stream while trying to read ${state.byteArrayNumberOfBytesToRead} more bytes for text string`);
    }
    const to = state.index + state.byteArrayNumberOfBytesToRead;
    const slice = state.currentBuffer.slice(state.index, to);
    state.index += state.byteArrayNumberOfBytesToRead;
    state.byteArrayNumberOfBytesToRead -= slice.length;
    if (slice.length > 0) {
        state.yieldEventData({
            eventType: "data",
            majorType: MajorType.ByteString,
            data: slice,
        } satisfies DataEventData);
    }
}

export function consumeByteString<Decoder extends DecoderLike>(decoder: Decoder): MapDecoderToIterableIterator<Decoder, Uint8Array, void, void> {
    let counter = 1;

    function handleIteration(state: IterationState<string, IteratorPullResult<DecoderEvent>>) {
        const result = state.pulled.shift();
        if (!result) {
            state.pull();
            IterationControl.continue();
        }
        const { done, value } = result;
        if (done) {
            throw new Error(`Unexpected end of stream. Depth counter: ${counter}`);
        }

        if (value.eventData.majorType != MajorType.ByteString) {
            throw new Error(`Unexpected major type ${value.eventData.majorType} while reading byte string`);
        }
        if (value.eventData.eventType === "start") {
            counter++;
        }
        if (value.eventData.eventType === "end") {
            counter--;
        }
        if (counter === 0) {
            IterationControl.return();
        }
        if (value.eventData.eventType === "data") {
            IterationControl.yield(value.eventData.data);
        }
    }

    function asyncImpl(d: AsyncDecoderLike) {
        const it = d[AsyncDecoderSymbol].events();
        const pull = ()=>it.next() as Promise<IteratorPullResult<DecoderEvent>>;
        return IterationControl.createAsyncIterator<string, IteratorPullResult<DecoderEvent>, never[]>(handleIteration, pull)[Symbol.asyncIterator]();
    }

    function syncImpl(d: SyncDecoderLike) {
        const it = d[SyncDecoderSymbol].events();
        const pull = ()=>it.next() as IteratorPullResult<DecoderEvent>;
        return IterationControl.createSyncIterator<string, IteratorPullResult<DecoderEvent>, never[]>(handleIteration, pull)[Symbol.iterator]();
    }
    
    if (SyncDecoderSymbol in decoder && decoder[SyncDecoderSymbol]) {
        return syncImpl(decoder as SyncDecoderLike) as MapDecoderToIterableIterator<Decoder, Uint8Array, void, void>;
    }
    if (AsyncDecoderSymbol in decoder && decoder[AsyncDecoderSymbol]) {
        return asyncImpl(decoder as AsyncDecoderLike) as MapDecoderToIterableIterator<Decoder, Uint8Array, void, void>;
    }
    
    throw new Error(`Decoder is neither sync nor async`);
}
