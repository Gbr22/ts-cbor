import { MajorTypes } from "../common.ts";
import type { DecoderEvent } from "../mod.ts";
import type { SimpleValueLiteralEventData } from "./events.ts";

export const UnknownSimpleValue = Symbol("UnknownSimpleValue");
export type UnknownSimpleValue = typeof UnknownSimpleValue;

export function decodeSimpleValue(
	numberValue: number,
): boolean | null | undefined | SimpleValue {
	if (numberValue == 20) {
		return false;
	}
	if (numberValue == 21) {
		return true;
	}
	if (numberValue == 22) {
		return null;
	}
	if (numberValue == 23) {
		return undefined;
	}
	return new SimpleValue(numberValue);
}

export function isSimpleValueEvent<Event extends DecoderEvent>(
	event: Event,
): event is Event & DecoderEvent<SimpleValueLiteralEventData> {
	return event.eventData.eventType === "literal" &&
		event.eventData.majorType === MajorTypes.SimpleValue &&
		event.eventData.simpleValueType === "simple";
}

export class SimpleValue {
	value: number;
	constructor(value: number) {
		this.value = value;
	}
}
