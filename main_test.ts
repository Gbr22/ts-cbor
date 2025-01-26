import { assertEquals } from "@std/assert";
import { consumeByteString, decoderFromStream, LiteralEvent } from "./main.ts";
import { MajorType } from "./main.ts";
import { writeByteStream, writePrimitive } from "./encoder.ts";
import { parseDecoder } from "./decoder.ts";
import { bytesToStream, byteStringToStream, byteWritableStream, collectBytes, iterableToStream, joinBytes, stringToBytes } from "./utils.ts";

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
    const inputString = input.join();
    const inputChars = inputString.split("");
    let isComment = false;
    let hex = "";
    while (inputChars.length > 0) {
        const char = inputChars.shift();
        if (char === "#") {
            isComment = true;
        }
        if (isComment) {
            if (char === "\n") {
                isComment = false;
            }
            continue;
        }
        if (char === " " || char === "\n" || char == "\t") {
            continue;
        }
        hex += char;
    }

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

async function assertRewrite(value: number | bigint | Uint8Array | boolean | null | undefined) {
    const { getBytes, stream } = byteWritableStream();
    const writer = stream.getWriter();
    await writePrimitive(writer,value);
    await writer.close();
    const bytes = getBytes();
    const decoder = decoderFromStream(bytesToStream(bytes));
    const newValue = await parseDecoder(decoder);
    assertEquals(newValue, value, "Expect value to be rewritten correctly");
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

Deno.test(async function positiveNumberIdentity() {
    await assertRewrite(0);
    await assertRewrite(0xFF);
    await assertRewrite(0xFF+1);
    await assertRewrite(0xFFFF);
    await assertRewrite(0xFFFF+1);
    await assertRewrite(0xFFFF_FFFF);
    await assertRewrite(0xFFFF_FFFFn+1n);
    await assertRewrite(0xFFFF_FFFF_FFFF_FFFFn);
});

Deno.test(async function negativeNumberIdentity() {
    await assertRewrite(-0);
    await assertRewrite(-0xFF);
    await assertRewrite(-0xFF-2);
    await assertRewrite(-0xFFFF);
    await assertRewrite(-0xFFFF-2);
    await assertRewrite(-0xFFFF_FFFF);
    await assertRewrite(-0xFFFF_FFFFn-2n);
    await assertRewrite(-0xFFFF_FFFF_FFFF_FFFFn);
});

Deno.test(async function byteStringIdentity() {
    await assertRewrite(new Uint8Array([1,2,3,4,5]));
});

Deno.test(async function constructedByteStringIdentity() {
    const buffer = new Uint8Array(0xFF+1);
    for (let i=0; i < buffer.length; i++) {
        buffer[i] = i & 255;
    }
    await assertRewrite(buffer);
});

Deno.test(async function primitiveIdentity() {
    await assertRewrite(false);
    await assertRewrite(true);
    await assertRewrite(null);
    await assertRewrite(undefined);
});

Deno.test(async function simpleTypeIdentity() {
    for (let i=0; i < 255; i++) {
        const isPrimitive = i >= 20 && i <= 23;
        const isReserved = i >= 24 && i <= 31;
        if (isPrimitive || isReserved) {
            continue;
        }
        await assertRewrite(i);
    }
});

Deno.test(async function byteStreamWriteTest() {
    const chunks = [
        new Uint8Array([1,2,3]),
        new Uint8Array([4,5,6]),
        new Uint8Array([7,8,9]),
    ];
    const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeByteStream(writer,stream);
    const result = await getBytes();
    const expected = stringToBytes(hex`
        5F         # bytes(*)
        43         # bytes(3)
            010203 # "\u0001\u0002\u0003"
        43         # bytes(3)
            040506 # "\u0004\u0005\u0006"
        43         # bytes(3)
            070809 # "\u0007\b\t"
        FF         # primitive(*)
    `);
    assertEquals(result,expected, "Expect correct byte stream");
});

Deno.test(async function byteStreamWriteReadTest() {
    const chunks = [
        new Uint8Array([1,2,3]),
        new Uint8Array([4,5,6]),
        new Uint8Array([7,8,9]),
    ];
    const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeByteStream(writer,stream);
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const next = await assertNext(await decoder[Symbol.asyncIterator]())
    assertEquals(next.eventType, "start", "Expect start event");
    const readResult = await collectBytes(consumeByteString(decoder));

    assertEquals(readResult,joinBytes(...chunks), "Expect correct byte stream");
});
