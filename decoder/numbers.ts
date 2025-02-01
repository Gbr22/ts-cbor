import { isIntegerMajorType, MajorTypes } from "../common.ts";
import type { DecoderLike } from "./common.ts";
import type { DecoderEvent, NumberEventData } from "./events.ts";

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
	throw new Error(
		`Could not decode Uint, invalid number of bytes: ${array.length}`,
	);
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

export function isNumberEvent<Event extends DecoderEvent>(
	event: Event,
): event is Event & DecoderEvent<NumberEventData, DecoderLike> {
	if (event.eventData.eventType != "literal") {
		return false;
	}
	const isInt = event.eventData.majorType === MajorTypes.UnsignedInteger ||
		event.eventData.majorType === MajorTypes.NegativeInteger;
	if (isInt) {
		return true;
	}
	const isFloat = event.eventData.majorType === MajorTypes.SimpleValue &&
		event.eventData.data instanceof Uint8Array;
	if (isFloat) {
		return true;
	}
	return false;
}

export function decodeNumberEvent(event: DecoderEvent): number | bigint {
	if (event.eventData.eventType === "literal") {
		if (isIntegerMajorType(event.eventData.majorType)) {
			let number = decodeUint(event.eventData.data as Uint8Array);
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
