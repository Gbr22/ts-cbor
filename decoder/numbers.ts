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
		return array[0];
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
