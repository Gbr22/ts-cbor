import {
	AdditionalInfo,
	MajorTypes,
	serialize,
	TaggedValue,
} from "./common.ts";
import { SimpleValue } from "./decoder/simple-value.ts";
import { defaultEncodingHandlers } from "./encoder/default-handlers.ts";
import { concatBytes } from "./utils.ts";

export const AsyncWriterSymbol = Symbol("AsyncWriter");
export type AsyncWriterSymbol = typeof AsyncWriterSymbol;
export const SyncWriterSymbol = Symbol("SyncWriter");
export type SyncWriterSymbol = typeof SyncWriterSymbol;
export type AsyncWriter = {
	write(chunk: Uint8Array): Promise<void>;
	[AsyncWriterSymbol]: true;
};

export type SyncWriter = {
	write(chunk: Uint8Array): void;
	[SyncWriterSymbol]: true;
};

type AnyWriter = AsyncWriter | SyncWriter;

/**
 * Maps an AsyncWriter | SyncWriter to a return type. For async writers, `Param` is wrapped in a `Promise`. `Param` is usually void.
 */
export type WriterReturnType<Writer extends AnyWriter, Param = void> =
	Writer extends SyncWriter ? Param
		: Writer extends AsyncWriter ? Promise<Param>
		: never;
export type WriterErrorType<Writer extends AnyWriter> = WriterReturnType<
	Writer,
	never
>;

type SequentialGenerator = () => IterableIterator<void | Promise<void>>;
export function sequentialWriteGenerator<Writer extends AnyWriter>(
	writer: Writer,
	gen: SequentialGenerator,
): WriterReturnType<Writer> {
	if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
		return (async () => {
			for (const promise of gen()) {
				await promise;
			}
		})() as WriterReturnType<Writer>;
	}
	const it = gen();
	while (true) {
		const { done } = it.next();
		if (done) {
			break;
		}
	}
	return undefined as WriterReturnType<Writer>;
}

type FunctionSequence = (() => void | Promise<void>)[];
export function sequentialWriteFunctions<Writer extends AnyWriter>(
	writer: Writer,
	sequence: FunctionSequence,
): WriterReturnType<Writer> {
	if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
		return (async () => {
			for (const fn of sequence) {
				await fn();
			}
		})() as WriterReturnType<Writer>;
	}

	for (const fn of sequence) {
		fn();
	}

	return undefined as WriterReturnType<Writer>;
}

export type MustUseAsyncWriterReturnType<
	Writer extends AnyWriter,
	ReturnType = void,
> = Writer extends SyncWriter ? never
	: Writer extends AsyncWriter ? Promise<ReturnType>
	: never;

export function mustUseAsyncWriter<Writer extends AnyWriter>(
	writer: Writer,
	fn: () => Promise<void>,
): MustUseAsyncWriterReturnType<Writer> {
	if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
		return fn() as MustUseAsyncWriterReturnType<Writer>;
	}
	throw new Error("Expected async writer");
}

function write<Writer extends AnyWriter>(
	writer: Writer,
	value: Uint8Array | ArrayBuffer,
): WriterReturnType<Writer> {
	return writer.write(new Uint8Array(value)) as WriterReturnType<Writer>;
}

export function writeFalse<Writer extends AnyWriter>(
	writer: Writer,
): WriterReturnType<Writer> {
	return write(writer, new Uint8Array([0xF4]));
}

export function writeTrue<Writer extends AnyWriter>(
	writer: Writer,
): WriterReturnType<Writer> {
	return write(writer, new Uint8Array([0xF5]));
}

export function writeBoolean<Writer extends AnyWriter>(
	writer: Writer,
	value: boolean,
): WriterReturnType<Writer> {
	return write(writer, new Uint8Array([value ? 0xF5 : 0xF4]));
}

export function writeNull<Writer extends AnyWriter>(
	writer: Writer,
): WriterReturnType<Writer> {
	return write(writer, new Uint8Array([0xF6]));
}

export function writeUndefined<Writer extends AnyWriter>(
	writer: Writer,
): WriterReturnType<Writer> {
	return write(writer, new Uint8Array([0xF7]));
}
function createHeader(majorType: number, additionalInfo: number) {
	return (majorType << 5) | additionalInfo;
}
export function writeHeader<Writer extends AnyWriter>(
	writer: Writer,
	majorType: number,
	additionalInfo: number,
): WriterReturnType<Writer> {
	const header = new Uint8Array(1);
	header[0] = (majorType << 5) | additionalInfo;
	return write(writer, header);
}
export function writeSimpleValue<Writer extends AnyWriter>(
	writer: Writer,
	value: number | SimpleValue,
): WriterReturnType<Writer> {
	const numberValue = value instanceof SimpleValue ? value.value : value;
	if (numberValue <= 31) {
		return writeHeader(writer, MajorTypes.SimpleValue, numberValue);
	}
	return write(
		writer,
		new Uint8Array([
			createHeader(MajorTypes.SimpleValue, AdditionalInfo.Length1),
			numberValue,
		]),
	);
}
export function writeBreak<Writer extends AnyWriter>(
	writer: Writer,
): WriterReturnType<Writer> {
	return writeHeader(
		writer,
		MajorTypes.SimpleValue,
		AdditionalInfo.IndefiniteLength,
	);
}

export function writeArgument8<Writer extends AnyWriter>(
	writer: Writer,
	majorType: number,
	number: number | bigint,
): WriterReturnType<Writer> {
	return write(
		writer,
		new Uint8Array([
			createHeader(majorType, AdditionalInfo.Length1),
			Number(number),
		]),
	);
}
export function writeArgument16<Writer extends AnyWriter>(
	writer: Writer,
	majorType: number,
	number: number | bigint,
): WriterReturnType<Writer> {
	const buffer = new Uint8Array(3);
	new DataView(buffer.buffer).setUint16(1, Number(number));
	buffer[0] = createHeader(majorType, AdditionalInfo.Length2);
	return write(writer, buffer);
}
export function writeArgument32<Writer extends AnyWriter>(
	writer: Writer,
	majorType: number,
	number: number | bigint,
): WriterReturnType<Writer> {
	const buffer = new Uint8Array(5);
	new DataView(buffer.buffer).setUint32(1, Number(number));
	buffer[0] = createHeader(majorType, AdditionalInfo.Length4);
	return write(writer, buffer);
}
export function writeArgument64<Writer extends AnyWriter>(
	writer: Writer,
	majorType: number,
	number: number | bigint,
): WriterReturnType<Writer> {
	const buffer = new Uint8Array(9);
	new DataView(buffer.buffer).setBigUint64(1, BigInt(number));
	buffer[0] = createHeader(majorType, AdditionalInfo.Length8);
	return write(writer, buffer);
}

function throwOrReject<Writer extends AnyWriter>(
	writer: Writer,
	error: unknown,
): WriterErrorType<Writer> {
	if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
		return Promise.reject(error) as WriterErrorType<Writer>;
	}
	throw error;
}

export function writeArgument<Writer extends AnyWriter>(
	writer: Writer,
	majorType: number,
	number: number | bigint,
): WriterReturnType<Writer> {
	if (number < 0) {
		return throwOrReject(writer, new Error("Number must be positive"));
	}
	if (number < AdditionalInfo.Length1) {
		return writeHeader(writer, majorType, Number(number));
	}
	if (number <= 0xFF) {
		return writeArgument8(writer, majorType, number);
	}
	if (number <= 0xFFFF) {
		return writeArgument16(writer, majorType, number);
	}
	if (number <= 0xFFFF_FFFF) {
		return writeArgument32(writer, majorType, number);
	}
	if (number <= 0xFFFF_FFFF_FFFF_FFFFn) {
		return writeArgument64(writer, majorType, number);
	}
	return throwOrReject(writer, new Error(`Number too large: ${number}`));
}

export function writeIntTiny<Writer extends AnyWriter>(
	writer: Writer,
	number: number | bigint,
): WriterReturnType<Writer> {
	const { type, value } = getNumberWrittenValueAndType(number);
	return writeHeader(writer, type, Number(value));
}
export function writeInt8<Writer extends AnyWriter>(
	writer: Writer,
	number: number | bigint,
): WriterReturnType<Writer> {
	const { type, value } = getNumberWrittenValueAndType(number);
	return writeArgument8(writer, type, value);
}
export function writeInt16<Writer extends AnyWriter>(
	writer: Writer,
	number: number | bigint,
): WriterReturnType<Writer> {
	const { type, value } = getNumberWrittenValueAndType(number);
	return writeArgument16(writer, type, value);
}
export function writeInt32<Writer extends AnyWriter>(
	writer: Writer,
	number: number | bigint,
): WriterReturnType<Writer> {
	const { type, value } = getNumberWrittenValueAndType(number);
	return writeArgument32(writer, type, value);
}
export function writeInt64<Writer extends AnyWriter>(
	writer: Writer,
	number: number | bigint,
): WriterReturnType<Writer> {
	const { type, value } = getNumberWrittenValueAndType(number);
	return writeArgument64(writer, type, value);
}

export function writeByteString<Writer extends AnyWriter>(
	writer: Writer,
	value: Uint8Array | ArrayBuffer,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		yield writeArgument(writer, MajorTypes.ByteString, value.byteLength);
		yield write(writer, value);
	});
}

export async function writeByteStream(
	writer: AsyncWriter,
	stream: ReadableStream<Uint8Array>,
) {
	await writeHeader(
		writer,
		MajorTypes.ByteString,
		AdditionalInfo.IndefiniteLength,
	);
	for await (const value of stream) {
		await writeByteString(writer, value);
	}
	await writeBreak(writer);
}

export function writeTextString<Writer extends AnyWriter>(
	writer: Writer,
	value: string,
): WriterReturnType<Writer> {
	const buffer = new TextEncoder().encode(value);
	return sequentialWriteGenerator(writer, function* () {
		yield writeArgument(writer, MajorTypes.TextString, buffer.byteLength);
		yield write(writer, buffer);
	});
}

export async function writeTextStream(
	writer: AsyncWriter,
	stream: ReadableStream<string>,
) {
	await writeHeader(
		writer,
		MajorTypes.TextString,
		AdditionalInfo.IndefiniteLength,
	);
	for await (const value of stream) {
		await writeTextString(writer, value);
	}
	await writeBreak(writer);
}

function getNumberWrittenValueAndType(number: number | bigint) {
	let value = number;
	if (value < 0) {
		if (typeof value === "bigint") {
			value = -1n - value;
		} else if (typeof value === "number") {
			value = -1 - value;
		}
	}
	const type = number < 0
		? MajorTypes.NegativeInteger
		: MajorTypes.UnsignedInteger;
	return { type, value };
}

function bigIntToBytes(number: bigint): Uint8Array {
	const bytes: number[] = [];
	while (number > 0) {
		bytes.unshift(Number(number & 0xFFn));
		number >>= 8n;
	}
	return new Uint8Array(bytes);
}

export function createBigNum(number: bigint): TaggedValue {
	const { type, value } = getNumberWrittenValueAndType(number);
	const bytes = bigIntToBytes(value as bigint);
	return new TaggedValue(type + 2, bytes);
}

function writeBigIntHelper<Writer extends AnyWriter>(
	writer: Writer,
	tagValue: number,
	value: bigint,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		yield writeTag(writer, tagValue);
		const bytes = bigIntToBytes(value);
		yield writeArgument(writer, MajorTypes.ByteString, bytes.length);
		yield write(writer, bytes);
	});
}

/**
 * Serialize a JavaScript integer to a CBOR integer.
 * This function can handle number and bigint values in the range: -(2^64) <= n and n >= (2^64)-1.
 * The behaviour for values outside this range is not defined.
 * To serialize a number outside this range, use `createBigNum` to turn a BigInt into a TaggedValue, which can be used in the `writeValue` function with the default handlers.
 */
export function writeInt<Writer extends AnyWriter>(
	writer: Writer,
	number: number | bigint,
): WriterReturnType<Writer> {
	const { type, value } = getNumberWrittenValueAndType(number);
	if (typeof value === "number") {
		return writeArgument(writer, type, value);
	} else {
		if (value <= 0xFFFF_FFFF_FFFF_FFFFn) {
			return writeArgument(writer, type, value);
		}
		return writeBigIntHelper(writer, type + 2, value);
	}
}

export function writeTag<Writer extends AnyWriter>(
	writer: Writer,
	value: number | bigint,
): WriterReturnType<Writer> {
	return writeArgument(writer, MajorTypes.Tag, value);
}

function writeFloatN<
	Writer extends AnyWriter,
	ArrayConstructor extends
		| typeof Float16Array
		| typeof Float32Array
		| typeof Float64Array,
>(
	writer: Writer,
	value: number | InstanceType<ArrayConstructor>,
	ArrayConstructor: ArrayConstructor,
	simpleValue: number,
): WriterReturnType<Writer> {
	let floatArray: InstanceType<ArrayConstructor> = undefined!;
	if (value instanceof ArrayConstructor) {
		floatArray = value;
	} else {
		floatArray = new ArrayConstructor(1) as InstanceType<ArrayConstructor>;
		floatArray[0] = value as number;
	}
	const buffer = new Uint8Array(floatArray.buffer);
	const reverse = new Uint8Array([...buffer].reverse());
	return sequentialWriteGenerator(writer, function* () {
		yield writeHeader(writer, MajorTypes.SimpleValue, simpleValue);
		yield write(writer, reverse);
	});
}

export function writeFloat16<Writer extends AnyWriter>(
	writer: Writer,
	value: number | Float16Array,
): WriterReturnType<Writer> {
	return writeFloatN(writer, value, Float16Array, AdditionalInfo.Length2);
}

export function writeFloat32<Writer extends AnyWriter>(
	writer: Writer,
	value: number | Float32Array,
): WriterReturnType<Writer> {
	return writeFloatN(writer, value, Float32Array, AdditionalInfo.Length4);
}

export function writeFloat64<Writer extends AnyWriter>(
	writer: Writer,
	value: number | Float64Array,
): WriterReturnType<Writer> {
	return writeFloatN(writer, value, Float64Array, AdditionalInfo.Length8);
}

export function writeArrayHeader<Writer extends AnyWriter>(
	writer: Writer,
	length?: number | bigint | undefined,
): WriterReturnType<Writer> {
	if (length === undefined) {
		return writeHeader(
			writer,
			MajorTypes.Array,
			AdditionalInfo.IndefiniteLength,
		);
	}
	return writeArgument(writer, MajorTypes.Array, length);
}

export function writeMapHeader<Writer extends AnyWriter>(
	writer: Writer,
	length?: number | bigint | undefined,
): WriterReturnType<Writer> {
	if (length === undefined) {
		return writeHeader(
			writer,
			MajorTypes.Map,
			AdditionalInfo.IndefiniteLength,
		);
	}
	return writeArgument(writer, MajorTypes.Map, length);
}

export function writeMap<Writer extends AnyWriter>(
	writer: Writer,
	value: Map<unknown, unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		yield writeMapHeader(writer, value.size);
		for (const [key, item] of value) {
			yield writeValue(writer, key, encodingHandlers);
			yield writeValue(writer, item, encodingHandlers);
		}
	});
}

export function writeArray<Writer extends AnyWriter>(
	writer: Writer,
	value: unknown[] | Array<unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		yield writeArrayHeader(writer, value.length);
		for (const element of value) {
			yield writeValue(writer, element, encodingHandlers);
		}
	});
}

export function writeObject<Writer extends AnyWriter>(
	writer: Writer,
	value: object,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		const entries = Object.entries(value);
		yield writeMapHeader(writer, entries.length);
		for (const [key, item] of entries) {
			yield writeValue(writer, key, encodingHandlers);
			yield writeValue(writer, item, encodingHandlers);
		}
	});
}

export function writeSyncIterable<Writer extends AnyWriter>(
	writer: Writer,
	value: Iterable<unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		yield writeArrayHeader(writer);
		for (const element of value as Iterable<unknown>) {
			yield writeValue(writer, element, encodingHandlers);
		}
		yield writeBreak(writer);
	});
}

export function writeAsyncIterable<Writer extends AnyWriter>(
	writer: Writer,
	value: AsyncIterable<unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return mustUseAsyncWriter(writer, async () => {
		await writeArrayHeader(writer);
		for await (const element of value as AsyncIterable<unknown>) {
			await writeValue(writer, element, encodingHandlers);
		}
		await writeBreak(writer);
	});
}

export function writeIterable<Writer extends AnyWriter>(
	writer: Writer,
	value: Iterable<unknown> | AsyncIterable<unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	if (value && typeof value === "object" && Symbol.iterator in value) {
		return writeSyncIterable(writer, value, encodingHandlers);
	}
	if (value && typeof value === "object" && Symbol.asyncIterator in value) {
		return writeAsyncIterable(writer, value, encodingHandlers);
	}
	throw new Error("Value is not iterable or async iterable");
}
export type WriteFunction<T = unknown> = <Writer extends AnyWriter>(
	writer: Writer,
	value: T,
	encodingHandlers?: EncodingHandler[],
) => WriterReturnType<Writer>;
export type EncodingHandler<T = unknown> = {
	match(value: unknown): value is T;
	write?<Writer extends AnyWriter>(
		writer: Writer,
		value: T,
		encodingHandlers?: EncodingHandler[],
	): WriterReturnType<Writer>;
	replace?(value: T): unknown;
};

type AssertExtends<T extends U, U> = T;
type _AssertWriteFunctionEquality1 = AssertExtends<
	NonNullable<EncodingHandler["write"]>,
	WriteFunction
>;
type _AssertWriteFunctionEquality2 = AssertExtends<
	WriteFunction,
	NonNullable<EncodingHandler["write"]>
>;

export function writeValue<Writer extends AnyWriter>(
	writer: Writer,
	value: unknown,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	let didReplace = false;
	function write(value: unknown) {
		if (value instanceof TaggedValue) {
			return sequentialWriteGenerator(writer, function* () {
				for (const handler of encodingHandlers) {
					if (handler.match(value.value)) {
						yield writeTag(writer, value.tag);
						yield handler.write?.(writer, value.value);
						return;
					}
				}
				throw new Error(
					`No encoding handler for tagged value with tag (${value.tag}): ${
						serialize(value)
					}`,
				);
			});
		} else {
			for (const handler of encodingHandlers) {
				if (handler.match(value)) {
					if (handler.replace && !didReplace) {
						didReplace = true;
						write(handler.replace(value));
					}
					return sequentialWriteGenerator(writer, function* () {
						yield handler.write?.(writer, value);
					});
				}
			}
			throw new Error(
				`No encoding handler for untagged value with ${
					serialize(value)
				}`,
			);
		}
	}
	return write(value);
}

export function intoAsyncWriter<
	Writer extends {
		write: (value: Uint8Array) => Promise<void> | void;
	},
>(writer: Writer): Writer & AsyncWriter {
	const write = async (chunk: Uint8Array) => {
		await writer.write(chunk);
	};
	return new Proxy(writer, {
		get(target, prop) {
			if (prop === AsyncWriterSymbol) {
				return true;
			}
			if (prop === "write") {
				return write;
			}
			return Reflect.get(target, prop);
		},
		set(target, prop, value) {
			if (prop === "write" || prop === AsyncWriterSymbol) {
				return false;
			}
			return Reflect.set(target, prop, value);
		},
	}) as Writer & AsyncWriter;
}

export function intoSyncWriter<
	Writer extends {
		write: (value: Uint8Array) => void;
	},
>(writer: Writer): Writer & SyncWriter {
	const write = (chunk: Uint8Array) => {
		writer.write(chunk);
	};
	return new Proxy(writer, {
		get(target, prop) {
			if (prop === SyncWriterSymbol) {
				return true;
			}
			if (prop === "write") {
				return write;
			}
			return Reflect.get(target, prop);
		},
		set(target, prop, value) {
			if (prop === "write" || prop === SyncWriterSymbol) {
				return false;
			}
			return Reflect.set(target, prop, value);
		},
	}) as Writer & SyncWriter;
}

export function encodeValueSync(
	value: unknown,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): Uint8Array {
	const bytesArray: Uint8Array[] = [];
	const writer = intoSyncWriter({
		write(value: Uint8Array) {
			bytesArray.push(value);
		},
	});
	writeValue(writer, value, encodingHandlers);
	return concatBytes(...bytesArray);
}

export async function encodeValueAsync(
	value: unknown,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): Promise<Uint8Array> {
	const bytesArray: Uint8Array[] = [];
	const writer = intoAsyncWriter({
		write(value: Uint8Array) {
			bytesArray.push(value);
		},
	});
	await writeValue(writer, value, encodingHandlers);
	return concatBytes(...bytesArray);
}
