import { AdditionalInfo, MajorType } from "./common.ts";
import { UnknownSimpleValue } from "./decoder/simple-value.ts";

type Writer = WritableStreamDefaultWriter<Uint8Array>;

export async function writeFalse(writer: Writer) {
    await writer.write(new Uint8Array([0xF4]));
}
export async function writeTrue(writer: Writer) {
    await writer.write(new Uint8Array([0xF5]));
}
export async function writeNull(writer: Writer) {
    await writer.write(new Uint8Array([0xF6]));
}
export async function writeUndefined(writer: Writer) {
    await writer.write(new Uint8Array([0xF7]));
}
export async function writeHeader(writer: Writer, majorType: number, additionalInfo: number) {
    const header = new Uint8Array(1);
    header[0] = (majorType << 5) | additionalInfo;
    await writer.write(header);
}
export async function writeSimpleValue(writer: Writer, value: number) {
    if (value <= 31) {
        await writeHeader(writer, MajorType.SimpleValue, value);
        return;
    }
    await writeHeader(writer, MajorType.SimpleValue, AdditionalInfo.Length1);
    await writer.write(new Uint8Array([value]));
}
export async function writeBreak(writer: Writer) {
    await writeHeader(writer, MajorType.SimpleValue, AdditionalInfo.IndefiniteLength);
}
export async function writeArgument8(writer: Writer, majorType: number, number: number | bigint) {
    await writeHeader(writer, majorType, AdditionalInfo.Length1);
    await writer.write(new Uint8Array([Number(number)]));
}
export async function writeArgument16(writer: Writer, majorType: number, number: number | bigint) {
    await writeHeader(writer, majorType, AdditionalInfo.Length2);
    const buffer = new Uint8Array(2);
    new DataView(buffer.buffer).setUint16(0, Number(number));
    await writer.write(buffer);
}
export async function writeArgument32(writer: Writer, majorType: number, number: number | bigint) {
    await writeHeader(writer, majorType, AdditionalInfo.Length4);
    const buffer = new Uint8Array(4);
    new DataView(buffer.buffer).setUint32(0, Number(number));
    await writer.write(buffer);
}
export async function writeArgument64(writer: Writer, majorType: number, number: number | bigint) {
    await writeHeader(writer, majorType, AdditionalInfo.Length8);
    const buffer = new Uint8Array(8);
    new DataView(buffer.buffer).setBigUint64(0, BigInt(number));
    await writer.write(buffer);
}
export async function writeArgument(writer: Writer, majorType: number, number: number | bigint) {
    if (number < 0) {
        throw new Error("Number must be positive");
    }
    if (number < AdditionalInfo.Length1) {
        await writeHeader(writer, majorType, Number(number));
        return;
    }
    if (number <= 0xFF) {
        await writeArgument8(writer, majorType, number);
        return;
    }
    if (number <= 0xFFFF) {
        await writeArgument16(writer, majorType, number);
        return;
    }
    if (number <= 0xFFFF_FFFF) {
        await writeArgument32(writer, majorType, number);
        return;
    }
    if (number <= 0xFFFF_FFFF_FFFF_FFFFn) {
        await writeArgument64(writer, majorType, number);
        return;
    }
    throw new Error(`Number too large: ${number}`);
}

export async function writeIntTiny(writer: Writer, number: number | bigint) {
    const { type, value } = getNumberWrittenValueAndType(number);
    await writeHeader(writer, type, Number(value));
}
export async function writeInt8(writer: Writer, number: number | bigint) {
    const { type, value } = getNumberWrittenValueAndType(number);
    await writeArgument8(writer, type, value);
}
export async function writeInt16(writer: Writer, number: number | bigint) {
    const { type, value } = getNumberWrittenValueAndType(number);
    await writeArgument16(writer, type, value);
}
export async function writeInt32(writer: Writer, number: number | bigint) {
    const { type, value } = getNumberWrittenValueAndType(number);
    await writeArgument32(writer, type, value);
}
export async function writeInt64(writer: Writer, number: number | bigint) {
    const { type, value } = getNumberWrittenValueAndType(number);
    await writeArgument64(writer, type, value);
}
export async function writeByteString(writer: Writer, value: Uint8Array) {
    await writeArgument(writer, MajorType.ByteString, value.byteLength);
    await writer.write(value);
}

export async function writeByteStream(writer: Writer, stream: ReadableStream<Uint8Array>) {
    await writeHeader(writer, MajorType.ByteString, AdditionalInfo.IndefiniteLength);
    for await (const value of stream) {
        await writeByteString(writer, value);
    }
    await writeBreak(writer);
}

export async function writeTextString(writer: Writer, value: string) {
    const buffer = new TextEncoder().encode(value);
    await writeArgument(writer, MajorType.TextString, buffer.byteLength);
    await writer.write(buffer);
}

export async function writeTextStream(writer: Writer, stream: ReadableStream<string>) {
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

export async function writeInt(writer: Writer, number: number | bigint) {
    const { type, value } = getNumberWrittenValueAndType(number);
    await writeArgument(writer, type, value);
}

async function writeFloatN<ArrayConstructor extends typeof Float16Array | typeof Float32Array | typeof Float64Array>(writer: Writer, value: number | InstanceType<ArrayConstructor>, ArrayConstructor: ArrayConstructor, simpleValue: number) {
    let floatArray: InstanceType<ArrayConstructor> = undefined!;
    if (value instanceof ArrayConstructor) {
        floatArray = value;
    } else {
        floatArray = new ArrayConstructor(1) as InstanceType<ArrayConstructor>;
        floatArray[0] = value as number;
    }
    const buffer = new Uint8Array(floatArray.buffer);
    const reverse = new Uint8Array([...buffer].reverse());
    await writeHeader(writer, MajorType.SimpleValue, simpleValue);
    await writer.write(reverse);
}

export async function writeFloat16(writer: Writer, value: number | Float16Array) {
    await writeFloatN(writer, value, Float16Array, AdditionalInfo.Length2);
}

export async function writeFloat32(writer: Writer, value: number | Float32Array) {
    await writeFloatN(writer, value, Float32Array, AdditionalInfo.Length4);
}

export async function writeFloat64(writer: Writer, value: number | Float64Array) {
    await writeFloatN(writer, value, Float64Array, AdditionalInfo.Length8);
}

export async function writeArrayHeader(writer: Writer, length?: number | bigint | undefined) {
    if (length === undefined) {
        await writeHeader(writer, MajorType.Array, AdditionalInfo.IndefiniteLength);
        return;
    }
    await writeArgument(writer, MajorType.Array, length);
}

export async function writeMapHeader(writer: Writer, length?: number | bigint | undefined) {
    if (length === undefined) {
        await writeHeader(writer, MajorType.Map, AdditionalInfo.IndefiniteLength);
        return;
    }
    await writeArgument(writer, MajorType.Map, length);
}

type PrimitiveWritableValue = number | bigint | Uint8Array | boolean | null | undefined | string;
type PrimitiveReadableValue = PrimitiveWritableValue | UnknownSimpleValue;
export type WritableValue = PrimitiveWritableValue | Map<WritableValue,WritableValue> | Iterable<WritableValue> | AsyncIterable<WritableValue> | Array<WritableValue>;
export type ReadableValue = PrimitiveReadableValue | Map<ReadableValue,ReadableValue> | Iterable<ReadableValue> | AsyncIterable<ReadableValue> | Array<ReadableValue>;

export async function writeValue(writer: Writer, value: PrimitiveWritableValue | WritableValue) {
    if (typeof value === "number" && Number.isInteger(value)) {
        await writeInt(writer, value);
        return;
    }
    if (typeof value === "number") {
        await writeFloat64(writer, value);
        return;
    }
    if (typeof value === "bigint") {
        await writeInt(writer, value);
        return;
    }
    if (value instanceof Uint8Array) {
        await writeByteString(writer, value);
        return;
    }
    if (typeof value === "string") {
        await writeTextString(writer, value);
        return;
    }
    if (value === false) {
        await writeFalse(writer);
        return;
    }
    if (value === true) {
        await writeTrue(writer);
        return;
    }
    if (value === null) {
        await writeNull(writer);
        return;
    }
    if (value === undefined) {
        await writeUndefined(writer);
        return;
    }
    if (value instanceof Map) {
        await writeMapHeader(writer, value.size);
        for (const [key, item] of value) {
            await writeValue(writer, key);
            await writeValue(writer, item);
        }
        return;
    }
    if (value instanceof Array) {
        await writeArrayHeader(writer, value.length);
        for (const e of value) {
            await writeValue(writer, e);
        }
        return;
    }
    if (typeof (value as AsyncIterable<WritableValue>)?.[Symbol.asyncIterator] === "function") {
        await writeArrayHeader(writer);
        for await (const e of value) {
            await writeValue(writer, e);
        }
        await writeBreak(writer);
        return;
    }
    if (typeof (value as Iterable<WritableValue>)?.[Symbol.iterator] === "function") {
        await writeArrayHeader(writer);
        for (const e of value as Iterable<WritableValue>) {
            await writeValue(writer, e);
        }
        await writeBreak(writer);
        return;
    }
}
