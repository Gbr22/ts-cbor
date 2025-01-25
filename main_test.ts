import { assertEquals } from "@std/assert";
import { consumeByteString, decoderFromStream, LiteralEvent } from "./main.ts";
import { MajorType } from "./main.ts";

async function collect(stream: AsyncIterable<Uint8Array>) {
    const reader = stream[Symbol.asyncIterator]();
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.next();
        if (done) {
            return chunks;
        }
        chunks.push(value);
    }
};

function joinBytes(...byteArrays: Uint8Array[]) {
    const totalLength = byteArrays.reduce((acc, b) => acc + b.byteLength, 0);
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const array of byteArrays) {
        bytes.set(array, offset);
        offset += array.byteLength;
    }
    return bytes;
}

async function collectBytes(stream: AsyncIterable<Uint8Array>) {
    const parts = await collect(stream);
    return joinBytes(...parts);
}
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

function stripWhitespace(s: string) {
    return s.replaceAll(/\s/g,"");
}

function concat(templateStringsArray: TemplateStringsArray, ...expr: (Uint8Array | string)[]) {
    const strings = [...templateStringsArray];
    let newString = "";
    while (expr.length > 0) {
        const s = strings.shift() || "";
        const e = expr.shift();
        newString += s;
        if (e instanceof Uint8Array) {
            newString += String.fromCharCode(...e);
        } else if (typeof e === "string") {
            newString += e;
        }
    }
    const result = newString+strings.join("");
    return result;
}

function hex(input: TemplateStringsArray, ..._: unknown[]) {
    let newString = "";
    const hex = stripWhitespace(input.join());
    for (let i=0; i < hex.length; i+=2) {
        const hexByte = hex.substring(i,i+2).padEnd(2,"0");
        const byte = parseInt(hexByte,16);
        newString += String.fromCharCode(byte);
    }
    return newString;
}

function b(input: TemplateStringsArray, ..._: unknown[]){
    const byte = parseInt(stripWhitespace(input.join("")),2);
    return String.fromCharCode(byte);
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
    assertEquals(next.eventType, "literal", "Expect literal event");
    assertEquals(next.majorType, majorType, "Expect correct major type");
    assertEquals((next as LiteralEvent).data, value, "Expect correct value");
}

Deno.test(async function oneBytePositiveIntTest() {
    // Integers between [0; 23] are encoded as as themselves
    for (let i=0; i < 24; i++) {
        await literalTest(String.fromCharCode(i), i, MajorType.UnsignedInteger);
    }
});

Deno.test(async function oneByteNegativeTest() {
    await literalTest(hex`20`,-1,MajorType.NegativeInteger);
    await literalTest(hex`2C`,-13,MajorType.NegativeInteger);
    await literalTest(hex`37`,-24,MajorType.NegativeInteger);
});

Deno.test(async function numberTest() {
    await literalTest(hex`18 7B`,123,MajorType.UnsignedInteger);
    await literalTest(hex`38 7A`,-123,MajorType.NegativeInteger);
    await literalTest(hex`19 3039`,12345,MajorType.UnsignedInteger);
    await literalTest(hex`39 3038`,-12345,MajorType.NegativeInteger);
    await literalTest(hex`1A 00FFE8A2`,16771234,MajorType.UnsignedInteger);
    await literalTest(hex`3A 00FFE8A1`,-16771234,MajorType.NegativeInteger);
    await literalTest(hex`1B 01B69B4BACD05F15`,123456789123456789n,MajorType.UnsignedInteger);
    await literalTest(hex`3B 01B69B4BACD05F14`,-123456789123456789n,MajorType.NegativeInteger);
});

Deno.test(async function byteString() {
    const byteArray = new Uint8Array([1,2,3,4,5]);
    const decoder = decoderFromStream(byteStringToStream(concat`${b`010 00101`}${byteArray}`));
    const iterator = decoder[Symbol.asyncIterator]();
    const next = await assertNext(iterator);
    assertEquals(next.eventType, "start", "Expect start event");
    assertEquals(next.majorType, MajorType.ByteString, "Expect correct major type");
    const bytes = await collectBytes(consumeByteString(iterator));
    assertEquals(bytes, byteArray, "Expect correct value");
});