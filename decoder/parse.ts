import {
	type AsyncDecoder,
	type AsyncDecoderLike,
	AsyncDecoderSymbol,
	type DecoderLike,
	type MapDecoderToIterableIterator,
	type MapDecoderToReturnType,
	type SyncDecoder,
	type SyncDecoderLike,
	SyncDecoderSymbol,
} from "./common.ts";
import { serialize } from "../common.ts";
import { IterationControl } from "../iteration-control.ts";
import { defaultDecodingHandlers } from "./handlers.ts";
import { type DecoderEvent, DecoderEventTypes } from "./events.ts";
import { decoderFromIterable } from "./iterating.ts";
import type { IterationState } from "../iteration-control.ts";

type DecoderStack = DecoderHandlerInstance[];

export type DecodingControl = {
	yield(value: unknown): boolean;
	pop(): void;
};
export type DecoderHandlerInstance = {
	onYield(value: unknown): void;
	onEvent(event: DecoderEvent): boolean | undefined;
};
export type DecodingHandler<E extends DecoderEvent = DecoderEvent> = {
	match(event: DecoderEvent): event is E;
	handle(
		control: DecodingControl,
		event: E,
	): boolean | DecoderHandlerInstance;
};

export function transformDecoder<Decoder extends DecoderLike>(
	decoder: Decoder,
	handlers: DecodingHandler[] = defaultDecodingHandlers,
): MapDecoderToIterableIterator<Decoder, unknown, void, void> {
	const stack: DecoderStack = [];

	function handleEvent(
		state: IterationState<unknown, IteratorResult<DecoderEvent>>,
		control: DecodingControl,
		event: DecoderEvent,
	) {
		if (stack.length > 0) {
			if (
				(stack[stack.length - 1] as DecoderHandlerInstance).onEvent(
					event,
				)
			) {
				return;
			}
		}
		if (event.eventData.eventType === DecoderEventTypes.End) {
			state.return();
			return;
		}
		for (const handler of handlers) {
			if (handler.match(event)) {
				const result = handler.handle(control, event);
				if (typeof result != "boolean") {
					stack.push(result);
				}
				return;
			}
		}
	}

	let it: Iterator<DecoderEvent> | AsyncIterator<DecoderEvent> | undefined =
		undefined;
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

	function iterate(
		state: IterationState<unknown, IteratorResult<DecoderEvent>>,
	): Promise<void> | void {
		const control: DecodingControl = {
			yield(y: unknown): boolean {
				if (stack.length > 0) {
					(stack[stack.length - 1] as DecoderHandlerInstance).onYield(
						y,
					);
					return true;
				}
				state.enqueue(y);
				return false;
			},
			pop() {
				stack.pop();
			},
		};

		while (state.pulled.length > 0) {
			const result = state.pulled.shift()!;
			const { done, value: event } = result;
			if (done) {
				if (stack.length > 0) {
					throw new Error(
						`Unexpected end of stream while stack is not empty: ${
							serialize(stack)
						}`,
					);
				}
				state.return();
				return;
			}
			handleEvent(state, control, event);
		}
		return state.pull();
	}

	if (SyncDecoderSymbol in decoder) {
		return IterationControl
			.createSyncIterator<
				unknown,
				IteratorResult<DecoderEvent>,
				[]
			>(
				iterate,
				next,
			)[Symbol.iterator]() as MapDecoderToIterableIterator<
				Decoder,
				unknown,
				void,
				void
			>;
	}
	if (AsyncDecoderSymbol in decoder) {
		return IterationControl
			.createReadableStream<
				unknown,
				IteratorResult<DecoderEvent>,
				[]
			>(
				iterate,
				next,
			)[Symbol.asyncIterator]() as MapDecoderToIterableIterator<
				Decoder,
				unknown,
				void,
				void
			>;
	}

	throw new Error("Decoder is neither sync nor async");
}

export function parseDecoder<Decoder extends DecoderLike>(
	decoder: Decoder,
	handlers: DecodingHandler[] = defaultDecodingHandlers,
): MapDecoderToReturnType<DecoderLike, unknown> {
	if (SyncDecoderSymbol in decoder) {
		let hasValue = false;
		let value: unknown;
		for (
			const item of transformDecoder(decoder as SyncDecoderLike, handlers)
		) {
			if (hasValue) {
				throw new Error(
					`Unexpected item; end of stream expected. Item is: ${
						serialize(item)
					}`,
				);
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
		const fn = async function (): Promise<
			MapDecoderToReturnType<DecoderLike, unknown>
		> {
			let hasValue = false;
			let value: unknown;
			for await (
				const item of transformDecoder(
					decoder as AsyncDecoderLike,
					handlers,
				)
			) {
				if (hasValue) {
					throw new Error(
						`Unexpected item; end of stream expected. Item is: ${
							serialize(item)
						}`,
					);
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

type MapValueToDecoder<Value> = Value extends Uint8Array ? SyncDecoder
	: Value extends Iterable<Uint8Array> ? SyncDecoder
	: Value extends AsyncIterable<Uint8Array> ? AsyncDecoder
	: never;

export function decodeValue<
	V extends Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
>(
	value: V,
	decodingHandlers: DecodingHandler[] = defaultDecodingHandlers,
): MapDecoderToReturnType<MapValueToDecoder<V>, unknown> {
	type R = MapDecoderToReturnType<MapValueToDecoder<V>, unknown>;
	if (value instanceof Uint8Array) {
		return parseDecoder(
			decoderFromIterable([value]),
			decodingHandlers,
		) as R;
	}
	if (Symbol.iterator in value) {
		return parseDecoder(
			decoderFromIterable(value as Iterable<Uint8Array>),
			decodingHandlers,
		) as R;
	}
	if (Symbol.asyncIterator in value) {
		return parseDecoder(
			decoderFromIterable(value as AsyncIterable<Uint8Array>),
			decodingHandlers,
		) as R;
	}
	throw new Error(
		"Expected value to be Uint8Array or (sync/async) iterable of Uint8Array",
	);
}
