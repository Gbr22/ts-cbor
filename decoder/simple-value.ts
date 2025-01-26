import { Decoder, DecoderEvent, MajorType, SimpleValueLiteralEvent } from "../main.ts";

export const UnknownSimpleValue = Symbol("UnknownSimpleValue");
export type UnknownSimpleValue = typeof UnknownSimpleValue;

export function decodeSimpleValue(numberValue: number): boolean | null | undefined | UnknownSimpleValue {
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
    return UnknownSimpleValue;
}

export function isSimpleValueEvent(event: DecoderEvent): event is SimpleValueLiteralEvent {
    return event.eventType === "literal" && event.majorType === MajorType.SimpleValue && event.simpleValueType === "simple";
}
