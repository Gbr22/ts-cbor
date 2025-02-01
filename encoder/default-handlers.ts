import { createBigNum, writeArray, writeFalse, writeNull, writeObject, writeTrue, writeUndefined } from "../encoder.ts";
import { writeTextString } from "../encoder.ts";
import { writeMap } from "../encoder.ts";
import { EncodingHandler, writeAsyncIterable, writeByteString, writeFloat64, writeInt, writeSyncIterable } from "../encoder.ts";

export const integerEncodingHandler: EncodingHandler<number> = {
    match(value): value is number {
        return typeof value === "number" && Number.isInteger(value) && value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER;
    },
    write: writeInt
};

export const bigNumEncodingHandler: EncodingHandler<bigint> = {
    match(value): value is bigint {
        return typeof value === "bigint" && (value < -18446744073709551616n || value > 18446744073709551615n);
    },
    replace: createBigNum,
};

export const floatEncodingHandler: EncodingHandler<number> = {
    match: value=>typeof value === "number",
    write: writeFloat64
};

export const bigintEncodingHandler: EncodingHandler<bigint> = {
    match: (value): value is bigint => typeof value === "bigint" && value >= -18446744073709551616n && value <= 18446744073709551615n,
    write: writeInt
};

export const stringEncodingHandler: EncodingHandler<string> = {
    match: value=>typeof value === "string",
    write: writeTextString
};

export const uint8ArrayEncodingHandler: EncodingHandler<Uint8Array> = {
    match: value=>value instanceof Uint8Array,
    write: writeByteString
};

export const arrayBufferEncodingHandler: EncodingHandler<ArrayBuffer> = {
    match: value=>value instanceof ArrayBuffer,
    write: writeByteString
};

export const syncIterableEncodingHandler: EncodingHandler<Iterable<unknown>> = {
    match: (value): value is Iterable<unknown> => !!(value && typeof value === "object" && Symbol.iterator in value),
    write: writeSyncIterable
};

export const asyncIterableEncodingHandler: EncodingHandler<AsyncIterable<unknown>> = {
    match: (value): value is AsyncIterable<unknown> => !!(value && typeof value === "object" && Symbol.asyncIterator in value),
    write: writeAsyncIterable
};

export const mapEncodingHandler: EncodingHandler<Map<unknown,unknown>> = {
    match: value=>value instanceof Map,
    write: writeMap
};

export const objectEncodingHandler: EncodingHandler<object> = {
    match: value=>typeof value === "object" && value !== null,
    write: writeObject
};

export const arrayEncodingHandler: EncodingHandler<Array<unknown>> = {
    match: value=>value instanceof Array,
    write: writeArray
};

export const booleanEncodingHandler: EncodingHandler<boolean> = {
    match: value=>typeof value === "boolean",
    write: (writer, value)=>value ? writeTrue(writer) : writeFalse(writer)
};

export const nullEncodingHandler: EncodingHandler<null> = {
    match: value=>value === null,
    write: writeNull,
};

export const undefinedEncodingHandler: EncodingHandler<undefined> = {
    match: value=>value === undefined,
    write: writeUndefined,
};

export const defaultEncodingHandlers: EncodingHandler[] = [
    integerEncodingHandler,
    floatEncodingHandler,
    booleanEncodingHandler,
    nullEncodingHandler,
    undefinedEncodingHandler,
    stringEncodingHandler,
    bigintEncodingHandler,
    uint8ArrayEncodingHandler,
    arrayBufferEncodingHandler,
    mapEncodingHandler,
    arrayEncodingHandler,
    syncIterableEncodingHandler,
    asyncIterableEncodingHandler,
    objectEncodingHandler,
    bigNumEncodingHandler,
];
