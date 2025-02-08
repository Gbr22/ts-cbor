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

type StartEventMajorType =
	| MajorTypes["ByteString"]
	| MajorTypes["TextString"]
	| MajorTypes["Array"]
	| MajorTypes["Map"];
export type StartEventData<
	T extends StartEventMajorType = StartEventMajorType,
> = {
	eventType: DecoderEventTypes["Start"];
	length: number | bigint | undefined;
	majorType: T;
};
export type StartArrayEventData = StartEventData<MajorTypes["Array"]>;
export type StartMapEventData = StartEventData<MajorTypes["Map"]>;
export type StartByteStringEventData = StartEventData<MajorTypes["ByteString"]>;
export type StartTextStringEventData = StartEventData<MajorTypes["TextString"]>;

type EndEventMajorType =
	| MajorTypes["ByteString"]
	| MajorTypes["TextString"]
	| MajorTypes["Array"]
	| MajorTypes["Map"];

export type EndEventData<
	T extends EndEventMajorType = EndEventMajorType,
> = {
	eventType: DecoderEventTypes["End"];
	majorType: T;
};

export type EndArrayEventData = EndEventData & {
	majorType: MajorTypes["Array"];
};
export type EndMapEventData = EndEventData & {
	majorType: MajorTypes["Map"];
};
export type EndByteStringEventData = EndEventData & {
	majorType: MajorTypes["ByteString"];
};
export type EndTextStringEventData = EndEventData & {
	majorType: MajorTypes["TextString"];
};

type DataEventMajorType = MajorTypes["ByteString"] | MajorTypes["TextString"];

export type DataEventData<
	T extends DataEventMajorType = DataEventMajorType,
> =
	& ({
		eventType: DecoderEventTypes["Data"];
		majorType: MajorTypes["ByteString"];
		data: Uint8Array;
	} | {
		eventType: DecoderEventTypes["Data"];
		majorType: MajorTypes["TextString"];
		data: Uint8Array;
	})
	& {
		majorType: T;
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

export type TagEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	TagEventData,
	D
>;
export type LiteralEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	LiteralEventData,
	D
>;
export type IntegerEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	IntegerEventData,
	D
>;
export type FloatEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	FloatEventData,
	D
>;
export type NumberEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	NumberEventData,
	D
>;
export type SimpleValueEvent<D extends DecoderLike = DecoderLike> =
	DecoderEvent<SimpleValueEventData, D>;

export type StartArrayEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	StartArrayEventData,
	D
>;
export type StartMapEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	StartMapEventData,
	D
>;
export type StartByteStringEvent<D extends DecoderLike = DecoderLike> =
	DecoderEvent<StartByteStringEventData, D>;
export type StartTextStringEvent<D extends DecoderLike = DecoderLike> =
	DecoderEvent<StartTextStringEventData, D>;

export type EndArrayEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	EndArrayEventData,
	D
>;
export type EndMapEvent<D extends DecoderLike = DecoderLike> = DecoderEvent<
	EndMapEventData,
	D
>;
export type EndByteStringEvent<D extends DecoderLike = DecoderLike> =
	DecoderEvent<EndByteStringEventData, D>;
export type EndTextStringEvent<D extends DecoderLike = DecoderLike> =
	DecoderEvent<EndTextStringEventData, D>;

export type StartEvent<
	T extends StartEventMajorType = StartEventMajorType,
	D extends DecoderLike = DecoderLike,
> = DecoderEvent<StartEventData<T>, D>;
export type EndEvent<
	T extends EndEventMajorType = EndEventMajorType,
	D extends DecoderLike = DecoderLike,
> = DecoderEvent<EndEventData<T>, D>;
export type DataEvent<
	T extends DataEventMajorType = DataEventMajorType,
	D extends DecoderLike = DecoderLike,
> = DecoderEvent<DataEventData<T>, D>;
