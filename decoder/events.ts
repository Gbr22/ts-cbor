import type { MajorType } from "../common.ts";
import type { DecoderLike, SyncDecoderLike } from "./common.ts";
import { SyncDecoderSymbol } from "./common.ts";
import type { AsyncDecoderLike } from "./common.ts";
import { AsyncDecoderSymbol } from "./common.ts";

export type LiteralEventData =
	| IntegerLiteralEventData
	| SimpleValueLiteralEventData
	| FloatLiteralEventData
	| TagLiteralEventData;
export type TagLiteralEventData = {
	eventType: "literal";
	majorType: typeof MajorType["Tag"];
	data: Uint8Array;
};
export type SimpleValueLiteralEventData = {
	eventType: "literal";
	majorType: typeof MajorType["SimpleValue"];
	simpleValueType: "simple";
	data: number;
};
export type FloatLiteralEventData = {
	eventType: "literal";
	majorType: typeof MajorType["SimpleValue"];
	simpleValueType: "float";
	data: Uint8Array;
};
export type IntegerLiteralEventData = {
	eventType: "literal";
	majorType:
		| typeof MajorType["NegativeInteger"]
		| typeof MajorType["UnsignedInteger"]
		| typeof MajorType["Tag"];
	data: Uint8Array;
};
export type StartEventData = {
	eventType: "start";
	length: number | bigint | undefined;
	majorType:
		| typeof MajorType["ByteString"]
		| typeof MajorType["TextString"]
		| typeof MajorType["Array"]
		| typeof MajorType["Map"];
};
export type StartArrayEventData = StartEventData & {
	majorType: typeof MajorType["Array"];
};
export type StartMapEventData = StartEventData & {
	majorType: typeof MajorType["Map"];
};
export type StartByteStringEventData = StartEventData & {
	majorType: typeof MajorType["ByteString"];
};
export type StartTextStringEventData = StartEventData & {
	majorType: typeof MajorType["TextString"];
};
export type EndEventData = {
	eventType: "end";
	majorType:
		| typeof MajorType["ByteString"]
		| typeof MajorType["TextString"]
		| typeof MajorType["Array"]
		| typeof MajorType["Map"];
};
export type DataEventData = {
	eventType: "data";
	majorType: typeof MajorType["ByteString"];
	data: Uint8Array;
} | {
	eventType: "data";
	majorType: typeof MajorType["TextString"];
	data: string;
};

export type NumberEventData = IntegerLiteralEventData | FloatLiteralEventData;
export type DecoderEventData =
	| LiteralEventData
	| StartEventData
	| EndEventData
	| DataEventData;

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
	return event.eventData.eventType === "start" && majorType === undefined ||
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
	return event.eventData.eventType === "start" && majorType === undefined ||
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
