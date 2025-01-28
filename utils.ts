export async function collect<T>(stream: AsyncIterable<T>) {
    const chunks: T[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return chunks;
};

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

export async function collectBytes(stream: AsyncIterable<Uint8Array>) {
    const parts = await collect(stream);
    return concatBytes(...parts);
}

export function iterableToStream<T>(it: Iterable<T>) {
    return new ReadableStream<T>({
        start(controller) {
            for (const item of it) {
                controller.enqueue(item);
            }
            controller.close();
        }
    });
}

export type DropFirst<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never
