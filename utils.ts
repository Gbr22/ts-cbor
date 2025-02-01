export type MapIterableToReturnType<T, R> = T extends Iterable<any> ? R
	: T extends AsyncIterable<any> ? Promise<R>
	: never;

export type MapIterableIteratorToReturnType<T, R> = T extends
	IterableIterator<any> ? R
	: T extends AsyncIterableIterator<any> ? Promise<R>
	: never;

export type AnyIterable<T = any> = Iterable<T> | AsyncIterable<T>;

export function collect<T, I extends AnyIterable<T> = AnyIterable<T>>(
	stream: I,
): MapIterableToReturnType<I, T[]> {
	if (Symbol.iterator in stream) {
		const chunks: T[] = [];
		for (const chunk of stream as Iterable<T>) {
			chunks.push(chunk);
		}
		return chunks as MapIterableToReturnType<I, T[]>;
	}
	if (Symbol.asyncIterator in stream) {
		return async function () {
			const chunks: T[] = [];
			for await (const chunk of stream as AsyncIterable<T>) {
				chunks.push(chunk);
			}
			return chunks;
		}() as MapIterableToReturnType<I, T[]>;
	}
	throw new Error("Not an iterable");
}

export function concatBytes(...byteArrays: Uint8Array[]) {
	const totalLength = byteArrays.reduce((acc, b) => acc + b.byteLength, 0);
	const bytes = new Uint8Array(totalLength);
	let offset = 0;
	for (const array of byteArrays) {
		bytes.set(array, offset);
		offset += array.byteLength;
	}
	return bytes;
}

export function collectBytes<
	I extends AnyIterable<Uint8Array> = AnyIterable<Uint8Array>,
>(stream: I): MapIterableToReturnType<I, Uint8Array> {
	const result: MapIterableToReturnType<I, Uint8Array[]> = collect(stream);
	if (result instanceof Promise) {
		return result.then((chunks) =>
			concatBytes(...chunks)
		) as MapIterableToReturnType<I, Uint8Array>;
	}
	return concatBytes(...result as Uint8Array[]) as MapIterableToReturnType<
		I,
		Uint8Array
	>;
}

export function iterableToStream<T>(it: Iterable<T>) {
	return new ReadableStream<T>({
		start(controller) {
			for (const item of it) {
				controller.enqueue(item);
			}
			controller.close();
		},
	});
}

export type DropFirst<T extends unknown[]> = T extends [unknown, ...infer Rest]
	? Rest
	: never;
