import { assertEquals } from "@std/assert";
import { MajorType, parseDecoder, consumeByteString, decoderFromStream, SimpleValueLiteralEvent, writeByteStream, writePrimitive, writeTextStream } from "./main.ts";
import { bytesToStream, byteStringToStream, byteWritableStream, collect, collectBytes, iterableToStream, joinBytes, stringToBytes } from "./utils.ts";
import { consumeTextString } from "./decoder/text-string.ts";
import { writeSimpleValue } from "./encoder.ts";

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

async function assertRewrite(value: number | bigint | Uint8Array | boolean | null | undefined | string) {
    const { getBytes, stream } = byteWritableStream();
    const writer = stream.getWriter();
    await writePrimitive(writer,value);
    await writer.close();
    const bytes = getBytes();
    const decoder = decoderFromStream(bytesToStream(bytes));
    const newValue = await parseDecoder(decoder);
    assertEquals(newValue, value, "Expect value to be rewritten correctly");
}

async function literalTest(bytes: string, value: unknown) {
    const decoder = decoderFromStream(byteStringToStream(bytes));
    const result = await parseDecoder(decoder);
    assertEquals(result, value, "Expect correct value");
}

Deno.test(async function oneBytePositiveIntTest() {
    // Integers between [0; 23] are encoded as as themselves
    for (let i=0; i < 24; i++) {
        await literalTest(String.fromCharCode(i), i);
    }
});

Deno.test(async function oneByteNegativeTest() {
    await literalTest(hex`20`,-1);
    await literalTest(hex`2C`,-13);
    await literalTest(hex`37`,-24);
});

Deno.test(async function numberTest() {
    await literalTest(hex`18 7B`,123);
    await literalTest(hex`38 7A`,-123);
    await literalTest(hex`19 3039`,12345);
    await literalTest(hex`39 3038`,-12345);
    await literalTest(hex`1A 00FFE8A2`,16771234);
    await literalTest(hex`3A 00FFE8A1`,-16771234);
    await literalTest(hex`1B 01B69B4BACD05F15`,123456789123456789n);
    await literalTest(hex`3B 01B69B4BACD05F14`,-123456789123456789n);
});

Deno.test(async function byteString() {
    const byteArray = new Uint8Array([1,2,3,4,5]);
    const decoder = decoderFromStream(byteStringToStream(concat`${b`010 00101`}${byteArray}`));
    const iterator = decoder.events();
    const next = await assertNext(iterator);
    assertEquals(next.eventType, "start", "Expect start event");
    assertEquals(next.majorType, MajorType.ByteString, "Expect correct major type");
    const bytes = await collectBytes(consumeByteString(decoder));
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

Deno.test(async function simpleValueTypeIdentity() {
    for (let index=0; index <= 255; index++) {
        const isReserved = index >= 24 && index <= 31;
        if (isReserved) {
            continue;
        }
        const simpleValue = index;
        const { getBytes, stream: writerStream } = byteWritableStream();
        const writer = writerStream.getWriter();
        await writeSimpleValue(writer,simpleValue);
        const writeResult = await getBytes();
        const decoder = decoderFromStream(bytesToStream(writeResult));
        const next = await assertNext(decoder.events())
        assertEquals(next.eventType, "literal", "Expect start event");
        assertEquals(next.majorType, MajorType.SimpleValue, "Expect SimpleValue major type");
        assertEquals((next as SimpleValueLiteralEvent).simpleValueType, "simple", "Expect simple value type");
        assertEquals((next as SimpleValueLiteralEvent).data, simpleValue, "Expect correct value");
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
    assertEquals(result,expected, "Expect correct bytes");
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
    const next = await assertNext(decoder.events())
    assertEquals(next.eventType, "start", "Expect start event");
    const readResult = await collectBytes(consumeByteString(decoder));

    assertEquals(readResult,joinBytes(...chunks), "Expect correct bytes");
});

Deno.test(async function textStringIdentity() {
    await assertRewrite("Helló világ");
});

Deno.test(async function brokenTextTest() {
    const chunks = [
        new Uint8Array([0x66]), // String header
        new Uint8Array([0x6B,0xC3]), // kö
        new Uint8Array([0xB6, 0x72, 0x74, 0x65]), // örte
    ];
    
    const expectedText = "körte";
    const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
    const decoder = decoderFromStream(stream);
    const next = await assertNext(decoder.events())
    assertEquals(next.eventType, "start", "Expect start event");
    const parts = await collect(consumeTextString(decoder));
    const resultText = parts.join("");
    assertEquals(resultText,expectedText,"Expect correct text");
});

Deno.test(async function textStreamWriteTest() {
    const chunks = [
        "Lorem á",
        "é ipsum",
        "dolor ű",
    ];
    const stream: ReadableStream<string> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeTextStream(writer,stream);
    const result = await getBytes();
    const expected = stringToBytes(hex`
    7F                       # text(*)
        68                   # text(8)
            4C6F72656D20C3A1 # "Lorem á"
        68                   # text(8)
            C3A920697073756D # "é ipsum"
        68                   # text(8)
            646F6C6F7220C5B1 # "dolor ű"
        FF                   # primitive(*)
    `);
    assertEquals(result,expected, "Expect correct bytes");
});

Deno.test(async function byteStreamWriteReadTest() {
    const chunks = [
        "Lorem á",
        "é ipsum",
        "dolor ű",
    ];
    const stream: ReadableStream<string> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeTextStream(writer,stream);
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const next = await assertNext(decoder.events())
    assertEquals(next.eventType, "start", "Expect start event");
    const readResult = (await collect(consumeTextString(decoder))).join("");

    assertEquals(readResult, chunks.join(""), "Expect correct bytes");
});