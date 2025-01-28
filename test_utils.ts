import { assertEquals } from "@std/assert/equals";
import { decoderFromStream, parseDecoder, WritableValue, writeValue } from "./main.ts";
import { iterableToStream, joinBytes } from "./utils.ts";

export function stripWhitespace(s: string) {
    return s.replaceAll(/\s/g,"");
}

export function concat(templateStringsArray: TemplateStringsArray, ...expr: (Uint8Array | string)[]) {
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

export function hex(input: TemplateStringsArray, ..._: unknown[]) {
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

export function b(input: TemplateStringsArray, ..._: unknown[]){
    const byte = parseInt(stripWhitespace(input.join("")),2);
    return String.fromCharCode(byte);
}

export async function assertNext<T>(iterator: AsyncIterableIterator<T>): Promise<T> {
    const { value, done } = await iterator.next();
    assertEquals(done, false, "Done should be false");
    return value;
}

export async function parseTest(bytes: string, value: unknown) {
    const decoder = decoderFromStream(byteStringToStream(bytes));
    const result = await parseDecoder(decoder);
    assertEquals(result, value, "Expect correct value");
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

export async function assertRewrite(value: WritableValue) {
    const { getBytes, stream } = byteWritableStream();
    const writer = stream.getWriter();
    await writeValue(writer,value);
    await writer.close();
    const bytes = getBytes();
    const decoder = decoderFromStream(bytesToStream(bytes));
    const newValue = await parseDecoder(decoder);
    assertEquals(newValue, value, "Expect value to be rewritten correctly");
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