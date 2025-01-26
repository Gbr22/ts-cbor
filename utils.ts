export async function collect<T>(stream: AsyncIterable<T>) {
    const chunks: T[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return chunks;
};

export function joinBytes(...byteArrays: Uint8Array[]) {
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
    return joinBytes(...parts);
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

export function bytesToStream(bytes: Uint8Array, bufferSize: number = 5) {
    const count = bytes.length / bufferSize;
    const it = function*() {
        for (let i = 0; i < count; i++) {
            yield bytes.slice(i * bufferSize, (i + 1) * bufferSize);
        }
    }();
    return iterableToStream(it);
}

export function stringToBytes(str: string) {
    const bytes = new Uint8Array(str.length);
    bytes.set(str.split("").map(c => c.charCodeAt(0)));
    return bytes;
}

export function byteStringToStream(str: string, bufferSize: number = 5) {
    return bytesToStream(stringToBytes(str), bufferSize);
}
export function byteWritableStream() {
    const bytes: Uint8Array[] = [];
    return {
        getBytes() {
            return joinBytes(...bytes);
        },
        stream: new WritableStream({
            async write(value: Uint8Array) {
                bytes.push(value);
            },
            async close() {
            }
        })
    }
}