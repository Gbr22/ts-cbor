import { isIntegerMajorType, MajorTypes } from "../common.ts";
import type { DecoderLike } from "./common.ts";
import {
	type DecoderEvent,
	DecoderEventSubTypes,
	DecoderEventTypes,
	type FloatEventData,
	type IntegerEventData,
	type NumberEventData,
} from "./events.ts";

export function decodeBigUInt(bytes: Uint8Array): bigint {
	let value = 0n;
	for (const byte of bytes) {
		value = (value << 8n) | BigInt(byte);
	}
	return value;
}

export function decodeBigNInt(bytes: Uint8Array): bigint {
	const value = decodeBigUInt(bytes);
	return -1n - value;
}

export function decodeUInt(value: Uint8Array | number): number | bigint {
	if (typeof value === "number") {
		return value;
	}
	if (value.length == 8) {
		return new DataView(value.buffer).getBigUint64(0);
	}
	if (value.length == 4) {
		return new DataView(value.buffer).getUint32(0);
	}
	if (value.length == 2) {
		return new DataView(value.buffer).getUint16(0);
	}
	if (value.length == 1) {
		return value[0];
	}

	throw new Error(
		`Could not decode Uint, invalid number of bytes: ${value.length}`,
	);
}

export function decodeNInt(value: Uint8Array | number): number | bigint {
	let number = decodeUInt(value);
	if (typeof number === "bigint") {
		number = -1n - number;
	} else {
		number = -1 - number;
	}
	return number;
}

export function decodeFloat(array: Uint8Array): number {
	if (array.length == 8) {
		return new DataView(array.buffer).getFloat64(0);
	}
	if (array.length == 4) {
		return new DataView(array.buffer).getFloat32(0);
	}
	if (array.length == 2) {
		return new DataView(array.buffer).getFloat16(0);
	}
	throw new Error(
		`Could not decode Float, invalid number of bytes: ${array.length}`,
	);
}

export function isIntegerEvent(
	event: DecoderEvent,
): event is Event & DecoderEvent<IntegerEventData, DecoderLike> {
	return event.eventData.eventType === DecoderEventTypes.Literal &&
			event.eventData.majorType === MajorTypes.UnsignedInteger ||
		event.eventData.majorType === MajorTypes.NegativeInteger;
}

export function isFloatEvent(
	event: DecoderEvent,
): event is Event & DecoderEvent<FloatEventData, DecoderLike> {
	return event.eventData.eventType === DecoderEventTypes.Literal &&
		event.eventData.majorType === MajorTypes.SimpleValue &&
		event.eventData.subType === DecoderEventSubTypes.Float;
}

export function isNumberEvent(
	event: DecoderEvent,
): event is Event & DecoderEvent<NumberEventData, DecoderLike> {
	return isIntegerEvent(event) || isFloatEvent(event);
}

export function decodeNumberEvent(event: DecoderEvent): number | bigint {
	if (event.eventData.eventType === DecoderEventTypes.Literal) {
		if (isIntegerMajorType(event.eventData.majorType)) {
			let number = decodeUInt(event.eventData.data as Uint8Array);
			if (event.eventData.majorType == MajorTypes.NegativeInteger) {
				if (typeof number === "bigint") {
					number = -1n - number;
				} else {
					number = -1 - number;
				}
			}
			return number;
		}
		if (
			event.eventData.majorType === MajorTypes.SimpleValue &&
			event.eventData.data instanceof Uint8Array
		) {
			return decodeFloat(event.eventData.data);
		}
	}
	throw new Error(
		`Could not decode number event with event type: ${event.eventData.eventType} and major type: ${event.eventData.majorType}`,
	);
}
