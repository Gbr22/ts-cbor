import { isIntegerMajorType, MajorType } from "../common.ts";
import { DecoderEvent } from "../main.ts";
import { NumberEvent } from "./events.ts";

export function decodeUint(array: Uint8Array): number | bigint {
    if (array.length == 8) {
        return new DataView(array.buffer).getBigUint64(0);
    }
    if (array.length == 4) {
        return new DataView(array.buffer).getUint32(0);
    }
    if (array.length == 2) {
        return new DataView(array.buffer).getUint16(0);
    }
    if (array.length == 1) {
        return new DataView(array.buffer).getUint8(0);
    }
    throw new Error(`Could not decode Uint, invalid number of bytes: ${array.length}`);
}

export function decodeFloat(array: Uint8Array): number {
    if (array.length == 8) {
        return new DataView(array.buffer).getFloat64(0);
    }
    if (array.length == 4) {
        return new DataView(array.buffer).getFloat32(0);
    }
    if (array.length == 2) {
        // TODO: implement fallback for f16
        return new DataView(array.buffer).getFloat16(0);
    }
    throw new Error(`Could not decode Float, invalid number of bytes: ${array.length}`);
}

export function isNumberEvent(event: DecoderEvent): event is NumberEvent {
    if (event.eventType != "literal") {
        return false;
    }
    const isInt = event.majorType === MajorType.UnsignedInteger || event.majorType === MajorType.NegativeInteger;
    if (isInt) {
        return true;
    }
    const isFloat = event.majorType === MajorType.SimpleValue && event.data instanceof Uint8Array;
    if (isFloat) {
        return true;
    }
    return false;
}

export function decodeNumberEvent(event: DecoderEvent) {
    if (event.eventType === "literal") {
        if (isIntegerMajorType(event.majorType)) {
            let number = decodeUint(event.data as Uint8Array);
            if (event.majorType == MajorType.NegativeInteger) {
                if (typeof number === "bigint") {
                    number = (number * -1n) -1n;
                } else {
                    number = (number * -1) -1;
                }
            }
            return number;
        }
        if (event.majorType === MajorType.SimpleValue && event.data instanceof Uint8Array) {
            return decodeFloat(event.data);
        }
    }
    throw new Error(`Could not decode number event with event type: ${event.eventType} and major type: ${event.majorType}`);
}