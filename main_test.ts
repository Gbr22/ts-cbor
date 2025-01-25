import { assertEquals } from "@std/assert";
import { decoderFromStream } from "./main.ts";
import { MajorType } from "./main.ts";

function iterableToStream<T>(it: Iterable<T>) {
    return new ReadableStream({
        start(controller) {
            for (const item of it) {
                controller.enqueue(item);
            }
            controller.close();
        }
    });
}
function byteStringToStream(str: string, bufferSize: number = 5) {
    const bytes = new Uint8Array(str.length);
    bytes.set(str.split("").map(c => c.charCodeAt(0)));
    const count = bytes.length / bufferSize;
    const it = function*() {
        for (let i = 0; i < count; i++) {
            yield bytes.slice(i * bufferSize, (i + 1) * bufferSize);
        }
    }();
    return iterableToStream(it);
}

async function assertNext<T>(iterator: AsyncIterableIterator<T>): Promise<T> {
    const { value, done } = await iterator.next();
    assertEquals(done, false, "Done should be false");
    return value;
}

async function literalTest(bytes: string, value: unknown, majorType: number) {
    const decoder = decoderFromStream(byteStringToStream(bytes));
    const iterator = decoder[Symbol.asyncIterator]();
    const next = await assertNext(iterator);
    assertEquals(next.majorType, majorType, "Expect correct major type");
    assertEquals(next.data, value, "Expect correct value");
}

Deno.test(async function oneBytePositiveIntTest() {
    // Integers between [0; 23] are encoded as as themselves
    for (let i=0; i < 24; i++) {
        await literalTest(String.fromCharCode(i), i, MajorType.UnsignedInteger);
    }
});

Deno.test(async function oneByteNegativeTest() {
    await literalTest(`\x20`,-1,MajorType.NegativeInteger);
    await literalTest(`\x2C`,-13,MajorType.NegativeInteger);
    await literalTest(`\x37`,-24,MajorType.NegativeInteger);
});

Deno.test(async function numberTest() {
    await literalTest(`\x18${''}\x7B`,123,MajorType.UnsignedInteger);
    await literalTest(`\x38${''}\x7A`,-123,MajorType.NegativeInteger);
    await literalTest(`\x39${''}\x30\x38`,-12345,MajorType.NegativeInteger);
    await literalTest(`\x19${''}\x30\x39`,12345,MajorType.UnsignedInteger);
    await literalTest(`\x39${''}\x30\x38`,-12345,MajorType.NegativeInteger);
    await literalTest(`\x1A${''}\x00\xFF\xE8\xA2`,16771234,MajorType.UnsignedInteger);
    await literalTest(`\x3A${''}\x00\xFF\xE8\xA1`,-16771234,MajorType.NegativeInteger);
    await literalTest(`\x1B${''}\x01\xB6\x9B\x4B\xAC\xD0\x5F\x15`,123456789123456789n,MajorType.UnsignedInteger);
    await literalTest(`\x3B${''}\x01\xB6\x9B\x4B\xAC\xD0\x5F\x14`,-123456789123456789n,MajorType.NegativeInteger);
});
