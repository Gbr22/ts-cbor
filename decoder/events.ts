import { type MajorType, MajorTypes } from "../common.ts";
import type { DecoderLike, SyncDecoderLike } from "./common.ts";
import { SyncDecoderSymbol } from "./common.ts";
import type { AsyncDecoderLike } from "./common.ts";
import { AsyncDecoderSymbol } from "./common.ts";

export type DecoderEventTypes = Readonly<{
	Literal: 1;
	Tag: 2;
	Start: 3;
	End: 4;
	Data: 5;
}>;

export const DecoderEventTypes: DecoderEventTypes = Object.freeze({
	Literal: 1,
	Tag: 2,
	Start: 3,
	End: 4,
	Data: 5,
});

export type DecoderEventType = DecoderEventTypes[keyof DecoderEventTypes];

export type DecoderEventSubTypes = Readonly<{
	SimpleValue: 1;
	Float: 2;
}>;

export const DecoderEventSubTypes: DecoderEventSubTypes = Object.freeze({
	SimpleValue: 1,
	Float: 2,
});

export type DecoderEventSubType =
	DecoderEventSubTypes[keyof DecoderEventSubTypes];

export type LiteralEventData =
	| IntegerEventData
	| SimpleValueEventData
	| FloatEventData;
export type TagEventData = {
	eventType: DecoderEventTypes["Tag"];
	majorType: MajorTypes["Tag"];
	data: Uint8Array;
};
export type SimpleValueEventData = {
	eventType: DecoderEventTypes["Literal"];
	majorType: MajorTypes["SimpleValue"];
	subType: DecoderEventSubTypes["SimpleValue"];
	data: number;
};
export type FloatEventData = {
	eventType: DecoderEventTypes["Literal"];
	majorType: MajorTypes["SimpleValue"];
	subType: DecoderEventSubTypes["Float"];
	data: Uint8Array;
};
export type IntegerEventData = {
	eventType: DecoderEventTypes["Literal"];
	majorType:
		| MajorTypes["NegativeInteger"]
		| MajorTypes["UnsignedInteger"]
		| MajorTypes["Tag"];
	data: Uint8Array;
};
export type StartEventData = {
	eventType: DecoderEventTypes["Start"];
	length: number | bigint | undefined;
	majorType:
		| MajorTypes["ByteString"]
		| MajorTypes["TextString"]
		| MajorTypes["Array"]
		| MajorTypes["Map"];
};
export type StartArrayEventData = StartEventData & {
	majorType: MajorTypes["Array"];
};
export type StartMapEventData = StartEventData & {
	majorType: MajorTypes["Map"];
};
export type StartByteStringEventData = StartEventData & {
	majorType: MajorTypes["ByteString"];
};
export type StartTextStringEventData = StartEventData & {
	majorType: MajorTypes["TextString"];
};
export type EndEventData = {
	eventType: DecoderEventTypes["End"];
	majorType:
		| MajorTypes["ByteString"]
		| MajorTypes["TextString"]
		| MajorTypes["Array"]
		| MajorTypes["Map"];
};
export type DataEventData = {
	eventType: DecoderEventTypes["Data"];
	majorType: MajorTypes["ByteString"];
	data: Uint8Array;
} | {
	eventType: DecoderEventTypes["Data"];
	majorType: MajorTypes["TextString"];
	data: string;
};

export type NumberEventData = IntegerEventData | FloatEventData;
export type DecoderEventData =
	| LiteralEventData
	| StartEventData
	| EndEventData
	| DataEventData
	| TagEventData;

export type DecoderEvent<
	EventData extends DecoderEventData = DecoderEventData,
	DecoderLikeType extends DecoderLike = DecoderLike,
> = {
	eventData: EventData;
} & DecoderLikeType;

export function wrapEventData<
	EventData extends DecoderEventData,
	Decoder extends DecoderLike = DecoderLike,
>(decoder: Decoder, eventData: EventData): DecoderEvent<EventData, Decoder> {
	const obj = {
		eventData,
	} as DecoderEvent<EventData, Decoder>;
	if (AsyncDecoderSymbol in decoder && decoder[AsyncDecoderSymbol]) {
		(obj as AsyncDecoderLike)[AsyncDecoderSymbol] =
			decoder[AsyncDecoderSymbol];
	}
	if (SyncDecoderSymbol in decoder && decoder[SyncDecoderSymbol]) {
		(obj as SyncDecoderLike)[SyncDecoderSymbol] =
			decoder[SyncDecoderSymbol];
	}
	return obj;
}

type MapMajorTypeFilterToMajorType<Filter extends MajorType | undefined> =
	Filter extends MajorType ? Filter
		: MajorType;
export function isStartEvent<Filter extends MajorType | undefined = undefined>(
	event: DecoderEvent,
	majorType?: Filter,
): event is DecoderEvent<
	StartEventData & { majorType: MapMajorTypeFilterToMajorType<Filter> },
	DecoderLike
> {
	return event.eventData.eventType === DecoderEventTypes.Start &&
			majorType === undefined ||
		event.eventData.majorType === majorType;
}

export function bindIsStartEvent<
	Filter extends MajorType | undefined = undefined,
>(filter: Filter): (
	event: DecoderEvent,
) => event is DecoderEvent<
	StartEventData & { majorType: MapMajorTypeFilterToMajorType<Filter> },
	DecoderLike
> {
	return function (
		event: DecoderEvent,
	): event is DecoderEvent<
		StartEventData & { majorType: MapMajorTypeFilterToMajorType<Filter> },
		DecoderLike
	> {
		return isStartEvent(event, filter);
	};
}

export function isEndEvent<Filter extends MajorType | undefined = undefined>(
	event: DecoderEvent,
	majorType?: Filter,
): event is DecoderEvent<
	EndEventData & { majorType: MapMajorTypeFilterToMajorType<Filter> },
	DecoderLike
> {
	return event.eventData.eventType === DecoderEventTypes.End &&
			majorType === undefined ||
		event.eventData.majorType === majorType;
}

export function bindIsEndEvent<
	Filter extends MajorType | undefined = undefined,
>(filter: Filter): (
	event: DecoderEvent,
) => event is DecoderEvent<
	EndEventData & { majorType: MapMajorTypeFilterToMajorType<Filter> },
	DecoderLike
> {
	return function (
		event: DecoderEvent,
	): event is DecoderEvent<
		EndEventData & { majorType: MapMajorTypeFilterToMajorType<Filter> },
		DecoderLike
	> {
		return isEndEvent(event, filter);
	};
}

export function isTagEvent(
	event: DecoderEvent,
): event is DecoderEvent<
	TagEventData,
	DecoderLike
> {
	return event.eventData.eventType === DecoderEventTypes.Tag &&
		event.eventData.majorType === MajorTypes.Tag;
}
