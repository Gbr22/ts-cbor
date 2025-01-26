import { MajorType } from "./common.ts";

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
export async function writeArgument(writer: Writer, majorType: number, number: number | bigint) {
    if (number < 0) {
        throw new Error("Number must be positive");
    }
    if (number < 24) {
        await writeHeader(writer, majorType, Number(number));
        return;
    }
    if (number <= 0xFF) {
        await writeHeader(writer, majorType, 24);
        await writer.write(new Uint8Array([Number(number)]));
        return;
    }
    if (number <= 0xFFFF) {
        await writeHeader(writer, majorType, 25);
        const buffer = new Uint8Array(2);
        new DataView(buffer.buffer).setUint16(0, Number(number));
        await writer.write(buffer);
        return;
    }
    if (number <= 0xFFFF_FFFF) {
        await writeHeader(writer, majorType, 26);
        const buffer = new Uint8Array(4);
        new DataView(buffer.buffer).setUint32(0, Number(number));
        await writer.write(buffer);
        return;
    }
    if (number <= 0xFFFF_FFFF_FFFF_FFFFn) {
        await writeHeader(writer, majorType, 27);
        const buffer = new Uint8Array(8);
        new DataView(buffer.buffer).setBigUint64(0, BigInt(number));
        await writer.write(buffer);
        return;
    }
    throw new Error(`Number too large: ${number}`);
}

export async function writePrimitive(writer: Writer, value: number | bigint | Uint8Array | boolean | null | undefined) {
    if (typeof value === "number" || typeof value === "bigint") {
        let newValue = value;
        if (newValue < 0) {
            if (typeof newValue === "bigint") {
                newValue = (newValue * -1n) - 1n;
            }
            else if (typeof newValue === "number") {
                newValue = (newValue * -1) - 1;
            }
        }
        const type = value < 0 ? MajorType.NegativeInteger : MajorType.UnsignedInteger;
        await writeArgument(writer, type, newValue);
        return;
    }
    if (value instanceof Uint8Array) {
        await writeArgument(writer, MajorType.ByteString, value.byteLength);
        await writer.write(value);
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
}
