import { AdditionalInfo, MajorType } from "./common.ts";
import { UnknownSimpleValue } from "./decoder/simple-value.ts";

export const AsyncWriterSymbol = Symbol("AsyncWriter");
export type AsyncWriterSymbol = typeof AsyncWriterSymbol;
export const SyncWriterSymbol = Symbol("SyncWriter");
export type SyncWriterSymbol = typeof SyncWriterSymbol;
export type AsyncWriter = {
    write(chunk: Uint8Array): Promise<void>
    [AsyncWriterSymbol]: true;
};

export type SyncWriter = {
    write(chunk: Uint8Array): void
    [SyncWriterSymbol]: true;
};

type AnyWriter = AsyncWriter | SyncWriter;

export type WriterReturnType<Writer, Param = void> = Writer extends AsyncWriter ? Promise<Param> : Param;
export type WriterErrorType<Writer> = WriterReturnType<Writer, never>;

type SequentialGenerator = ()=>(IterableIterator<void | Promise<void>>);
export function sequentialGenerator<Writer extends AnyWriter>(writer: Writer, gen: SequentialGenerator): WriterReturnType<Writer> {
    if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
        return (async () => {
            for (const promise of gen()) {
                await promise;
            }
        })() as WriterReturnType<Writer>;
    }
    const it = gen();
    while(true) {
        const { done } = it.next();
        if (done) {
            break;
        }
    }
    return undefined as WriterReturnType<Writer>;
}

type FunctionSequence = (()=>(void | Promise<void>))[];
export function sequentialFunctions<Writer extends AnyWriter>(writer: Writer, sequence: FunctionSequence): WriterReturnType<Writer> {
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

type AsyncOrThrowMap<Writer> = Writer extends AsyncWriter ? Promise<void> : never;
export function mustUseAsyncWriter<Writer extends AnyWriter>(writer: Writer, fn: ()=>Promise<void>): AsyncOrThrowMap<Writer> {
    if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
        return fn() as AsyncOrThrowMap<Writer>;
    }
    throw new Error("Expected async writer");
}

function write<Writer extends AnyWriter>(writer: Writer, value: Uint8Array): WriterReturnType<Writer> {
    return writer.write(value) as WriterReturnType<Writer>;
}

export function writeFalse<Writer extends AnyWriter>(writer: Writer): WriterReturnType<Writer> {
    return write(writer,new Uint8Array([0xF4]));
}

export function writeTrue<Writer extends AnyWriter>(writer: Writer): WriterReturnType<Writer> {
    return write(writer,new Uint8Array([0xF5]));
}

export function writeNull<Writer extends AnyWriter>(writer: Writer): WriterReturnType<Writer> {
    return write(writer,new Uint8Array([0xF6]));
}

export function writeUndefined<Writer extends AnyWriter>(writer: Writer): WriterReturnType<Writer> {
    return write(writer,new Uint8Array([0xF7]));
}
function createHeader(majorType: number, additionalInfo: number) {
    return (majorType << 5) | additionalInfo;
}
export function writeHeader<Writer extends AnyWriter>(writer: Writer, majorType: number, additionalInfo: number): WriterReturnType<Writer> {
    const header = new Uint8Array(1);
    header[0] = (majorType << 5) | additionalInfo;
    return write(writer,header);
}
export function writeSimpleValue<Writer extends AnyWriter>(writer: Writer, value: number): WriterReturnType<Writer> {
    if (value <= 31) {
        return writeHeader(writer, MajorType.SimpleValue, value);
    }
    return write(writer,new Uint8Array([
        createHeader(MajorType.SimpleValue, AdditionalInfo.Length1),
        value
    ]));
}
export function writeBreak<Writer extends AnyWriter>(writer: Writer): WriterReturnType<Writer> {
    return writeHeader(writer, MajorType.SimpleValue, AdditionalInfo.IndefiniteLength);
}

export function writeArgument8<Writer extends AnyWriter>(writer: Writer, majorType: number, number: number | bigint): WriterReturnType<Writer> {
    return write(writer,new Uint8Array([
        createHeader(majorType, AdditionalInfo.Length1),
        Number(number)
    ]));
}
export function writeArgument16<Writer extends AnyWriter>(writer: Writer, majorType: number, number: number | bigint): WriterReturnType<Writer> {
    const buffer = new Uint8Array(3);
    new DataView(buffer.buffer).setUint16(1, Number(number));
    buffer[0] = createHeader(majorType, AdditionalInfo.Length2);
    return write(writer,buffer);
}
export function writeArgument32<Writer extends AnyWriter>(writer: Writer, majorType: number, number: number | bigint): WriterReturnType<Writer> {
    const buffer = new Uint8Array(5);
    new DataView(buffer.buffer).setUint32(1, Number(number));
    buffer[0] = createHeader(majorType, AdditionalInfo.Length4);
    return write(writer, buffer);
}
export function writeArgument64<Writer extends AnyWriter>(writer: Writer, majorType: number, number: number | bigint): WriterReturnType<Writer> {
    const buffer = new Uint8Array(9);
    new DataView(buffer.buffer).setBigUint64(1, BigInt(number));
    buffer[0] = createHeader(majorType, AdditionalInfo.Length8);
    return write(writer, buffer);
}

function throwOrReject<Writer extends AnyWriter>(writer: Writer, error: unknown): WriterErrorType<Writer> {
    if (AsyncWriterSymbol in writer && writer[AsyncWriterSymbol]) {
        return Promise.reject(error) as WriterErrorType<Writer>;
    }
    throw error;
}

export function writeArgument<Writer extends AnyWriter>(writer: Writer, majorType: number, number: number | bigint): WriterReturnType<Writer> {
    if (number < 0) {
        return throwOrReject(writer,new Error("Number must be positive"));
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
    return throwOrReject(writer,new Error(`Number too large: ${number}`));
}

export function writeIntTiny<Writer extends AnyWriter>(writer: Writer, number: number | bigint): WriterReturnType<Writer> {
    const { type, value } = getNumberWrittenValueAndType(number);
    return writeHeader(writer, type, Number(value));
}
export function writeInt8<Writer extends AnyWriter>(writer: Writer, number: number | bigint): WriterReturnType<Writer> {
    const { type, value } = getNumberWrittenValueAndType(number);
    return writeArgument8(writer, type, value);
}
export function writeInt16<Writer extends AnyWriter>(writer: Writer, number: number | bigint): WriterReturnType<Writer> {
    const { type, value } = getNumberWrittenValueAndType(number);
    return writeArgument16(writer, type, value);
}
export function writeInt32<Writer extends AnyWriter>(writer: Writer, number: number | bigint): WriterReturnType<Writer> {
    const { type, value } = getNumberWrittenValueAndType(number);
    return writeArgument32(writer, type, value);
}
export function writeInt64<Writer extends AnyWriter>(writer: Writer, number: number | bigint): WriterReturnType<Writer> {
    const { type, value } = getNumberWrittenValueAndType(number);
    return writeArgument64(writer, type, value);
}

export function writeByteString<Writer extends AnyWriter>(writer: Writer, value: Uint8Array): WriterReturnType<Writer> {
    return sequentialGenerator(writer, function*(){
        yield writeArgument(writer, MajorType.ByteString, value.byteLength);
        yield write(writer, value);
    });
}

export async function writeByteStream(writer: AsyncWriter, stream: ReadableStream<Uint8Array>) {
    await writeHeader(writer, MajorType.ByteString, AdditionalInfo.IndefiniteLength);
    for await (const value of stream) {
        await writeByteString(writer, value);
    }
    await writeBreak(writer);
}

export function writeTextString<Writer extends AnyWriter>(writer: Writer, value: string): WriterReturnType<Writer> {
    const buffer = new TextEncoder().encode(value);
    return sequentialGenerator(writer, function*() {
        yield writeArgument(writer, MajorType.TextString, buffer.byteLength);
        yield write(writer, buffer);
    });
}

export async function writeTextStream(writer: AsyncWriter, stream: ReadableStream<string>) {
    await writeHeader(writer, MajorType.TextString, AdditionalInfo.IndefiniteLength);
    for await (const value of stream) {
        await writeTextString(writer, value);
    }
    await writeBreak(writer);
}

function getNumberWrittenValueAndType(number: number | bigint) {
    let value = number;
    if (value < 0) {
        if (typeof value === "bigint") {
            value = (value * -1n) - 1n;
        }
        else if (typeof value === "number") {
            value = (value * -1) - 1;
        }
    }
    const type = number < 0 ? MajorType.NegativeInteger : MajorType.UnsignedInteger;
    return { type, value };
}

export function writeInt<Writer extends AnyWriter>(writer: Writer, number: number | bigint): WriterReturnType<Writer> {
    const { type, value } = getNumberWrittenValueAndType(number);
    return writeArgument(writer, type, value);
}

function writeFloatN<Writer extends AnyWriter,ArrayConstructor extends typeof Float16Array | typeof Float32Array | typeof Float64Array>(writer: Writer, value: number | InstanceType<ArrayConstructor>, ArrayConstructor: ArrayConstructor, simpleValue: number): WriterReturnType<Writer> {
    let floatArray: InstanceType<ArrayConstructor> = undefined!;
    if (value instanceof ArrayConstructor) {
        floatArray = value;
    } else {
        floatArray = new ArrayConstructor(1) as InstanceType<ArrayConstructor>;
        floatArray[0] = value as number;
    }
    const buffer = new Uint8Array(floatArray.buffer);
    const reverse = new Uint8Array([...buffer].reverse());
    return sequentialGenerator(writer, function*() {
        yield writeHeader(writer, MajorType.SimpleValue, simpleValue);
        yield write(writer,reverse);
    });
}

export function writeFloat16<Writer extends AnyWriter>(writer: Writer, value: number | Float16Array): WriterReturnType<Writer> {
    return writeFloatN(writer, value, Float16Array, AdditionalInfo.Length2);
}

export function writeFloat32<Writer extends AnyWriter>(writer: Writer, value: number | Float32Array): WriterReturnType<Writer> {
    return writeFloatN(writer, value, Float32Array, AdditionalInfo.Length4);
}

export function writeFloat64<Writer extends AnyWriter>(writer: Writer, value: number | Float64Array): WriterReturnType<Writer> {
    return writeFloatN(writer, value, Float64Array, AdditionalInfo.Length8);
}

export function writeArrayHeader<Writer extends AnyWriter>(writer: Writer, length?: number | bigint | undefined): WriterReturnType<Writer> {
    if (length === undefined) {
        return writeHeader(writer, MajorType.Array, AdditionalInfo.IndefiniteLength);
    }
    return writeArgument(writer, MajorType.Array, length);
}

export function writeMapHeader<Writer extends AnyWriter>(writer: Writer, length?: number | bigint | undefined): WriterReturnType<Writer> {
    if (length === undefined) {
        return writeHeader(writer, MajorType.Map, AdditionalInfo.IndefiniteLength);
    }
    return writeArgument(writer, MajorType.Map, length);
}

type PrimitiveWritableValue = number | bigint | Uint8Array | boolean | null | undefined | string;
type PrimitiveReadableValue = PrimitiveWritableValue | UnknownSimpleValue;
export type WritableValue = PrimitiveWritableValue | Map<WritableValue,WritableValue> | Iterable<WritableValue> | AsyncIterable<WritableValue> | Array<WritableValue>;
export type ReadableValue = PrimitiveReadableValue | Map<ReadableValue,ReadableValue> | Iterable<ReadableValue> | AsyncIterable<ReadableValue> | Array<ReadableValue>;

export function writeValue<Writer extends AnyWriter>(writer: Writer, value: PrimitiveWritableValue | WritableValue): WriterReturnType<Writer> {
    if (typeof value === "number" && Number.isInteger(value)) {
        return writeInt(writer, value);
    }
    if (typeof value === "number") {
        return writeFloat64(writer, value);
    }
    if (typeof value === "bigint") {
        return writeInt(writer, value);
    }
    if (value instanceof Uint8Array) {
        return writeByteString(writer, value);
    }
    if (typeof value === "string") {
        return writeTextString(writer, value);
    }
    if (value === false) {
        return writeFalse(writer);
    }
    if (value === true) {
        return writeTrue(writer);
    }
    if (value === null) {
        return writeNull(writer);
    }
    if (value === undefined) {
        return writeUndefined(writer);
    }
    if (value instanceof Map) {
        return sequentialGenerator(writer, function*() {
            yield writeMapHeader(writer, value.size);
            for (const [key, item] of value) {
                yield writeValue(writer, key);
                yield writeValue(writer, item);
            }
        });
    }
    if (value instanceof Array) {
        return sequentialGenerator(writer, function*() {
            yield writeArrayHeader(writer, value.length);
            for (const e of value) {
                yield writeValue(writer, e);
            }
        });
    }
    if (Symbol.asyncIterator in value && typeof (value)[Symbol.asyncIterator] === "function") {
        return mustUseAsyncWriter(writer, async()=>{
            await writeArrayHeader(writer);
            for await (const e of value) {
                await writeValue(writer, e);
            }
            await writeBreak(writer);
        });
    }
    if (Symbol.iterator in value && typeof (value)[Symbol.iterator] === "function") {
        return mustUseAsyncWriter(writer,async ()=>{
            await writeArrayHeader(writer);
            for (const e of value) {
                await writeValue(writer, e);
            }
            await writeBreak(writer);    
        });
    }
    return sequentialGenerator(writer, function*() {});
}

export function intoAsyncWriter<Writer extends {
    write: (value: Uint8Array) => Promise<void> | void
}>(writer: Writer): Writer & AsyncWriter {
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
        }
    }) as Writer & AsyncWriter;
}

export function intoSyncWriter<Writer extends {
    write: (value: Uint8Array) => void
}>(writer: Writer): Writer & SyncWriter {
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
        }
    }) as Writer & SyncWriter;
}
