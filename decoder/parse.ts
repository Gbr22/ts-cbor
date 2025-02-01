import { ReadableValue } from "../encoder.ts";
import { AsyncDecoder, AsyncDecoderLike, AsyncDecoderSymbol, DecoderLike, MapDecoderToIterableIterator, MapDecoderToReturnType, SyncDecoderLike, SyncDecoderSymbol } from "./common.ts";
import { serialize } from "../common.ts";
import { DecoderEvent, decoderFromIterable, SyncDecoder } from "../main.ts";
import { handlePullResult, IterationControl, pullFunction, PullFunctionArgs, PullFunctionIterationState, PullFunctionResult } from "../iteration-control.ts";
import { arrayHandler } from "./handlers/array.ts";
import { numberHandler } from "./handlers/number.ts";
import { simpleValueHandler } from "./handlers/simpleValue.ts";
import { mapHandler } from "./handlers/map.ts";
import { byteStringHandler } from "./handlers/byteString.ts";
import { textStringHandler } from "./handlers/textString.ts";

type DecoderStack = DecoderStackItem[];

export type DecodingControl = {
    yield(value: ReadableValue): never;
    pop(): void;
    continue(): never;
};
export type DecoderStackItem = {
    onYield(value: ReadableValue): void;
    onEvent(event: DecoderEvent): void;
};
export type DecodingHandler<E extends DecoderEvent = DecoderEvent> = {
    match(event: DecoderEvent): event is E;
    handle(control: DecodingControl, event: E): void | DecoderStackItem;
};

export const defaultDecodingHandlers: DecodingHandler[] = [
    numberHandler,
    simpleValueHandler,
    arrayHandler,
    mapHandler,
    byteStringHandler,
    textStringHandler,
];

export function transformDecoder<Decoder extends DecoderLike>(decoder: Decoder, handlers: DecodingHandler[]): MapDecoderToIterableIterator<Decoder, ReadableValue, void, void> {
    const stack: DecoderStack = [];

    function yieldValue(y: ReadableValue): never {
        if (stack.length > 0) {
            (stack[stack.length - 1] as DecoderStackItem).onYield(y);
            IterationControl.continue();
        }
        IterationControl.yield(y);
    }

    const control: DecodingControl = {
        yield: yieldValue,
        pop() {
            stack.pop();
        },
        continue(): never {
            IterationControl.continue();
        }
    };

    function handleEvent(event: DecoderEvent) {
        if (stack.length > 0) {
            (stack[stack.length - 1] as DecoderStackItem).onEvent(event);
        }
        if (event.eventData.eventType === "end") {
            IterationControl.return();
        }
        for (const handler of handlers) {
            if (handler.match(event)) {
                const result = handler.handle(control, event);
                if (result) {
                    stack.push(result);
                }
                IterationControl.continue();
            }
        }
    }

    let it: Iterator<DecoderEvent> | AsyncIterator<DecoderEvent> | undefined = undefined;
    if (SyncDecoderSymbol in decoder) {
        it = decoder[SyncDecoderSymbol].events()[Symbol.iterator]();
    }
    if (AsyncDecoderSymbol in decoder) {
        it = decoder[AsyncDecoderSymbol].events()[Symbol.asyncIterator]();
    }
    if (!it) {
        throw new Error("Decoder is neither sync nor async");
    }
    const next = it.next.bind(it);
    type PullableFunctions = typeof next;

    function iterate(state: PullFunctionIterationState<ReadableValue, PullableFunctions>) {
        handlePullResult(state.pulled);
        if (state.pulled.length === 0) {
            state.pull(next,[],(result)=>{
                const { done, value: event } = result;
                if (done) {
                    if (stack.length > 0) {
                        throw new Error(`Unexpected end of stream while stack is not empty: ${serialize(stack)}`);
                    }
                    IterationControl.return();
                }
                handleEvent(event);
            });
        }
    }

    if (SyncDecoderSymbol in decoder) {
        return IterationControl
            .createSyncIterator<
                ReadableValue,
                PullFunctionResult<PullableFunctions>,
                PullFunctionArgs<PullableFunctions>
            >(
                iterate,
                pullFunction<PullableFunctions>
            )[Symbol.iterator]() as
            MapDecoderToIterableIterator<Decoder, ReadableValue, void, void>;
    }
    if (AsyncDecoderSymbol in decoder) {
        return IterationControl
            .createAsyncIterator<
                ReadableValue,
                PullFunctionResult<PullableFunctions>,
                PullFunctionArgs<PullableFunctions>
            >(
                iterate,
                pullFunction<PullableFunctions>
            )[Symbol.asyncIterator]() as
            MapDecoderToIterableIterator<Decoder, ReadableValue, void, void>;
    }

    throw new Error("Decoder is neither sync nor async");
}

export function parseDecoder<Decoder extends DecoderLike>(decoder: Decoder, handlers: DecodingHandler[] = defaultDecodingHandlers): MapDecoderToReturnType<DecoderLike, unknown> {
    if (SyncDecoderSymbol in decoder) {
        let hasValue = false;
        let value: unknown;
        for (const item of transformDecoder(decoder as SyncDecoderLike, handlers)) {
            if (hasValue) {
                throw new Error(`Unexpected item; end of stream expected. Item is: ${serialize(item)}`);
            }
            value = item;
            hasValue = true;
        }
        if (hasValue) {
            return value as MapDecoderToReturnType<DecoderLike, unknown>;
        }
        throw new Error("Expected item");    
    }
    if (AsyncDecoderSymbol in decoder) {
        const fn = async function(): Promise<MapDecoderToReturnType<DecoderLike, unknown>> {
            let hasValue = false;
            let value: unknown;
            for await (const item of transformDecoder(decoder as AsyncDecoderLike, handlers)) {
                if (hasValue) {
                    throw new Error(`Unexpected item; end of stream expected. Item is: ${serialize(item)}`);
                }
                value = item;
                hasValue = true;
            }
            if (hasValue) {
                return value as MapDecoderToReturnType<DecoderLike, unknown>;
            }
            throw new Error("Expected item");  
        };
        return fn();
    }
    throw new Error("Decoder is neither sync nor async");
}

export type MapDecoderToIterator<D,A,B,C> = (
    D extends AsyncDecoderLike ?
        AsyncIterableIterator<A,B,C>
        :
        D extends SyncDecoderLike ?
            IterableIterator<A,B,C>
            :
            never
);

type MapValueToDecoder<V> = (
    V extends Uint8Array ? SyncDecoder :
    V extends Iterable<Uint8Array> ? SyncDecoder :
    V extends AsyncIterable<Uint8Array> ? AsyncDecoder :
    never
);

export function decodeValue<V extends Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>>(value: V): MapDecoderToReturnType<MapValueToDecoder<V>, unknown> {
    type R = MapDecoderToReturnType<MapValueToDecoder<V>, unknown>;
    if (value instanceof Uint8Array) {
        return parseDecoder(decoderFromIterable([value])) as R;
    }
    if (Symbol.iterator in value) {
        return parseDecoder(decoderFromIterable(value as Iterable<Uint8Array>)) as R;
    }
    if (Symbol.asyncIterator in value) {
        return parseDecoder(decoderFromIterable(value as AsyncIterable<Uint8Array>)) as R;
    }
    throw new Error("Expected value to be Uint8Array or (sync/async) iterable of Uint8Array");
}
