import { MajorType } from "../common.ts";
import { ReadableValue } from "../encoder.ts";
import { concatBytes } from "../utils.ts";
import { consumeByteString } from "./byte-string.ts";
import { AsyncDecoder } from "./common.ts";
import { consumeTextString } from "./text-string.ts";
import { serialize } from "../common.ts";
import { DecoderEvent, SyncDecoder } from "../main.ts";
import { handlePullResult, IterationControl, IterationState, pullFunction } from "../iteration-control.ts";
import { arrayHandler } from "./handlers/array.ts";
import { numberHandler } from "./handlers/number.ts";
import { simpleValueHandler } from "./handlers/simpleValue.ts";
import { mapHandler } from "./handlers/map.ts";

type DecoderStackItemByteString = {
    type: "byte-string";
    values: Uint8Array[]
    it: AsyncIterableIterator<Uint8Array>
};
type DecoderStackItemTextString = {
    type: "text-string";
    values: string[]
    it: AsyncIterableIterator<string>
};
type DecoderStackItem = DecoderStackItemByteString | DecoderStackItemTextString;
type DecoderStack = (DecoderStackItem | ComplexHandler)[];

export type Control = {
    yield(value: ReadableValue): never;
    pop(): void;
};
export type ComplexHandler = {
    type: "complex";
    onYield(value: ReadableValue): void;
    onEvent(event: DecoderEvent): void;
};
export type DecodingHandler<E extends DecoderEvent = DecoderEvent> = {
    match(event: DecoderEvent): event is E;
    handle(control: Control, event: E): void | ComplexHandler;
};

const defaultDecodingHandlers: DecodingHandler[] = [
    numberHandler,
    simpleValueHandler,
    arrayHandler,
    mapHandler
];

export function transformDecoder(decoder: AsyncDecoder, handlers: DecodingHandler[]): AsyncIterableIterator<ReadableValue> {
    const it = decoder.events();
    const next = it.next.bind(it);

    
    const stack: DecoderStack = [];

    function yieldValue(y: ReadableValue): never {
        if (stack[stack.length - 1]?.type === "complex") {
            (stack[stack.length - 1] as ComplexHandler).onYield(y);
            IterationControl.continue();
        }
        IterationControl.yield(y);
    }

    const control: Control = {
        yield(value: ReadableValue): never {
            yieldValue(value);
        },
        pop() {
            stack.pop();
        }
    };

    function handleEvent(event: DecoderEvent) {
        if (stack[stack.length - 1]?.type === "complex") {
            (stack[stack.length - 1] as ComplexHandler).onEvent(event);
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
        if (event.eventData.eventType === "start" && event.eventData.majorType === MajorType.ByteString) {
            stack.push({ type: "byte-string", values: [], it: consumeByteString(decoder) });
            IterationControl.continue();
        }
        if (event.eventData.eventType === "start" && event.eventData.majorType === MajorType.TextString) {
            stack.push({ type: "text-string", values: [], it: consumeTextString(decoder) });
            IterationControl.continue();
        }
    }

    async function iterate(state: IterationState<ReadableValue, any, any[]>) {
        if (stack[stack.length - 1]?.type === "byte-string") {
            const { values, it } = stack[stack.length - 1] as DecoderStackItemByteString;
            const { done, value } = await it.next();
            if (done) {
                stack.pop();
                yieldValue(concatBytes(...values));
            }
            values.push(value);
            IterationControl.continue();
        }
        if (stack[stack.length - 1]?.type === "text-string") {
            const { values, it } = stack[stack.length - 1] as DecoderStackItemTextString;
            const { done, value } = await it.next();
            if (done) {
                stack.pop();
                yieldValue(values.join(""));
            }
            values.push(value);
            IterationControl.continue();
        }
        handlePullResult(state.pulled);
        if (state.pulled.length === 0) {
            state.pull(next,[],(result: IteratorResult<DecoderEvent>)=>{
                const { done, value: event } = result;
                if (done) {
                    IterationControl.return();
                }
                handleEvent(event);
            });
        }
    }

    return IterationControl.createAsyncIterator<any, any, any[]>(iterate, pullFunction)[Symbol.asyncIterator]();
}

export async function parseDecoder<T>(decoder: AsyncDecoder): Promise<T> {
    let hasValue = false;
    let value: unknown;
    for await (const item of transformDecoder(decoder, defaultDecodingHandlers)) {
        if (hasValue) {
            throw new Error(`Unexpected item; end of stream expected. Item is: ${serialize(item)}`);
        }
        value = item;
        hasValue = true;
    }
    if (hasValue) {
        return value as T;
    }
    throw new Error("Expected item");
}

export type MapDecoderToIterator<D,A,B,C> = (
    D extends AsyncDecoder ?
        AsyncIterableIterator<A,B,C>
        :
        D extends SyncDecoder ?
            IterableIterator<A,B,C>
            :
            never
);
