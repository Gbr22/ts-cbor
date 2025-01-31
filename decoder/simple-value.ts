import { DecoderEvent, DecoderLike, MajorType, SimpleValueLiteralEventData } from "../main.ts";

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

export function isSimpleValueEvent<Event extends DecoderEvent>(event: Event): event is Event & DecoderEvent<DecoderLike, SimpleValueLiteralEventData> {
    return event.eventData.eventType === "literal" && event.eventData.majorType === MajorType.SimpleValue && event.eventData.simpleValueType === "simple";
}
