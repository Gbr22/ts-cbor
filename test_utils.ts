// deno-lint-ignore-file
import { assertEquals } from "@std/assert/equals";
import {
	AsyncWriter,
	decoderFromStream,
	intoAsyncWriter,
	parseDecoder,
	writeValue,
} from "./mod.ts";
import { concatBytes, DropFirst, iterableToStream } from "./utils.ts";
import { encodeValueSync } from "./encoder.ts";
import { decodeValue } from "./decoder/parse.ts";

export function stripWhitespace(s: string) {
	return s.replaceAll(/\s/g, "");
}

export function concat(
	templateStringsArray: TemplateStringsArray,
	...expr: (Uint8Array | string)[]
) {
	const strings = [...templateStringsArray].map(stringToBytes);

	const arrays: Uint8Array[] = [];
	while (expr.length > 0) {
		const s = strings.shift() || new Uint8Array();
		const e = expr.shift();
		arrays.push(s);
		if (e instanceof Uint8Array) {
			arrays.push(e);
		} else if (typeof e === "string") {
			arrays.push(stringToBytes(e));
		}
	}
	const result = concatBytes(...arrays, ...strings);
	return result;
}

export function hex(input: TemplateStringsArray, ..._: unknown[]) {
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
	const bytes = new Uint8Array(hex.length / 2);
	for (let arrayIndex = 0; arrayIndex < hex.length / 2; arrayIndex++) {
		const hexIndex = arrayIndex * 2;
		const hexByte = hex.substring(hexIndex, hexIndex + 2).padEnd(2, "0");
		const byte = parseInt(hexByte, 16);
		bytes[arrayIndex] = byte;
	}
	return bytes;
}

export function b(input: TemplateStringsArray, ..._: unknown[]) {
	const byte = parseInt(stripWhitespace(input.join("")), 2);
	return new Uint8Array([byte]);
}

export async function assertNext<T>(
	iterator: AsyncIterableIterator<T>,
): Promise<T> {
	const { value, done } = await iterator.next();
	assertEquals(done, false, "Done should be false");
	return value;
}

export async function parseTest(bytes: Uint8Array, value: unknown) {
	const decoder = decoderFromStream(bytesToStream(bytes));
	const result = await parseDecoder(decoder);
	assertEquals(result, value, "Expect correct value");
}

export function bytesToStream(bytes: Uint8Array, bufferSize: number = 5) {
	const count = bytes.length / bufferSize;
	const it = function* () {
		for (let i = 0; i < count; i++) {
			yield bytes.slice(i * bufferSize, (i + 1) * bufferSize);
		}
	}();
	return iterableToStream(it);
}

export function stringToBytes(str: string) {
	const bytes = new Uint8Array(str.length);
	bytes.set(str.split("").map((c) => c.charCodeAt(0)));
	return bytes;
}

export function byteStringToStream(str: string, bufferSize: number = 5) {
	return bytesToStream(stringToBytes(str), bufferSize);
}

export async function assertWriteReadIdentityAsync(value: unknown) {
	const { getBytes, stream } = byteWritableStream();
	const writer = intoAsyncWriter(stream.getWriter());
	await writeValue(writer, value);
	await writer.close();
	const bytes = getBytes();
	const decoder = decoderFromStream(bytesToStream(bytes));
	const newValue = await parseDecoder(decoder);
	assertEquals(newValue, value, "Expect value to be rewritten correctly");
}

export function assertWriteReadIdentitySync(value: unknown) {
	const bytes = encodeValueSync(value);
	const newValue = decodeValue(bytes);
	assertEquals(newValue, value, `Expect value to be rewritten correctly`);
}

export async function assertWriteReadIdentity(value: unknown) {
	assertWriteReadIdentitySync(value);
	await assertWriteReadIdentityAsync(value);
}

export function byteWritableStream() {
	const bytes: Uint8Array[] = [];
	return {
		getBytes() {
			return concatBytes(...bytes);
		},
		stream: new WritableStream({
			write(value: Uint8Array) {
				bytes.push(value);
				return Promise.resolve();
			},
			async close() {
			},
		}),
	};
}

export function bytesToDecoder(bytes: Uint8Array) {
	const decoder = decoderFromStream(bytesToStream(bytes));
	return decoder;
}

export async function writeAndReturnBytes<
	Fn extends (
		writer: AsyncWriter,
		...args: any[]
	) => void,
>(fn: Fn, args: DropFirst<Parameters<Fn>>): Promise<Uint8Array> {
	const { getBytes, stream } = byteWritableStream();
	const writer = intoAsyncWriter(stream.getWriter());
	await fn(writer, ...args);
	writer.close();
	const bytes = getBytes();
	return bytes;
}

export async function writeThenAssertBytesEquals<
	Fn extends (
		writer: AsyncWriter,
		...args: any[]
	) => void,
>(fn: Fn, args: DropFirst<Parameters<Fn>>, expected: Uint8Array) {
	const bytes = await writeAndReturnBytes(fn, args);
	assertEquals(bytes, expected, "Expect correct bytes");
}

export async function writeThenAssertParsedValueEquals<
	Fn extends (
		writer: AsyncWriter,
		...args: any[]
	) => void,
>(fn: Fn, args: DropFirst<Parameters<Fn>>, expected: unknown) {
	const bytes = await writeAndReturnBytes(fn, args);
	const decoder = decoderFromStream(bytesToStream(bytes));
	const value = await parseDecoder(decoder);
	assertEquals(value, expected, "Expect correct value");
}
