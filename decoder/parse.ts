import { AsyncDecoder, AsyncDecoderLike, AsyncDecoderSymbol, DecoderLike, MapDecoderToIterableIterator, MapDecoderToReturnType, SyncDecoder, SyncDecoderLike, SyncDecoderSymbol } from "./common.ts";
import { serialize } from "../common.ts";
import { handlePullResult, IterationControl, pullFunction, PullFunctionArgs, PullFunctionIterationState, PullFunctionResult } from "../iteration-control.ts";
import { defaultDecodingHandlers } from "./handlers.ts";
import { DecoderEvent } from "./events.ts";
import { decoderFromIterable } from "./iterating.ts";

type DecoderStack = DecoderHandlerInstance[];

export type DecodingControl = {
    yield(value: unknown): never;
    pop(): void;
    continue(): never;
};
export type DecoderHandlerInstance = {
    onYield(value: unknown): void;
    onEvent(event: DecoderEvent): void;
};
export type DecodingHandler<E extends DecoderEvent = DecoderEvent> = {
    match(event: DecoderEvent): event is E;
    handle(control: DecodingControl, event: E): void | DecoderHandlerInstance;
};

export function transformDecoder<Decoder extends DecoderLike>(decoder: Decoder, handlers: DecodingHandler[] = defaultDecodingHandlers): MapDecoderToIterableIterator<Decoder, unknown, void, void> {
    const stack: DecoderStack = [];

    function yieldValue(y: unknown): never {
        if (stack.length > 0) {
            (stack[stack.length - 1] as DecoderHandlerInstance).onYield(y);
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
            (stack[stack.length - 1] as DecoderHandlerInstance).onEvent(event);
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

    function iterate(state: PullFunctionIterationState<unknown, PullableFunctions>) {
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
                unknown,
                PullFunctionResult<PullableFunctions>,
                PullFunctionArgs<PullableFunctions>
            >(
                iterate,
                pullFunction<PullableFunctions>
            )[Symbol.iterator]() as
            MapDecoderToIterableIterator<Decoder, unknown, void, void>;
    }
    if (AsyncDecoderSymbol in decoder) {
        return IterationControl
            .createAsyncIterator<
                unknown,
                PullFunctionResult<PullableFunctions>,
                PullFunctionArgs<PullableFunctions>
            >(
                iterate,
                pullFunction<PullableFunctions>
            )[Symbol.asyncIterator]() as
            MapDecoderToIterableIterator<Decoder, unknown, void, void>;
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

export type MapDecoderToIterator<Decoder = DecoderLike, Yield = unknown, Return = unknown, Next = unknown> = (
    Decoder extends AsyncDecoderLike ?
        AsyncIterableIterator<Yield,Return,Next>
        :
        Decoder extends SyncDecoderLike ?
            IterableIterator<Yield,Return,Next>
            :
            never
);

type MapValueToDecoder<Value> = (
    Value extends Uint8Array ? SyncDecoder :
    Value extends Iterable<Uint8Array> ? SyncDecoder :
    Value extends AsyncIterable<Uint8Array> ? AsyncDecoder :
    never
);

export function decodeValue<V extends Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>>(value: V, decodingHandlers: DecodingHandler[] = defaultDecodingHandlers): MapDecoderToReturnType<MapValueToDecoder<V>, unknown> {
    type R = MapDecoderToReturnType<MapValueToDecoder<V>, unknown>;
    if (value instanceof Uint8Array) {
        return parseDecoder(decoderFromIterable([value]), decodingHandlers) as R;
    }
    if (Symbol.iterator in value) {
        return parseDecoder(decoderFromIterable(value as Iterable<Uint8Array>), decodingHandlers) as R;
    }
    if (Symbol.asyncIterator in value) {
        return parseDecoder(decoderFromIterable(value as AsyncIterable<Uint8Array>), decodingHandlers) as R;
    }
    throw new Error("Expected value to be Uint8Array or (sync/async) iterable of Uint8Array");
}
