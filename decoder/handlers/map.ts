import { MajorTypes } from "../../common.ts";
import {
	bindIsStartEvent,
	type DecoderEvent,
	DecoderEventTypes,
	type StartMapEventData,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

type MapStartEvent = DecoderEvent<StartMapEventData>;

type Entry = [unknown, unknown];
type MapData = Entry[];
export function createMapDecodingHandler(
	mapper: (entires: MapData) => unknown,
): DecodingHandler<MapStartEvent> {
	const handler = {
		match: bindIsStartEvent(MajorTypes.Map),
		handle(control: DecodingControl): DecoderHandlerInstance {
			const map: MapData = [];
			let hasKey = false;
			let key: unknown | undefined = undefined;
			return {
				onEvent(event) {
					if (event.eventData.eventType === DecoderEventTypes.End) {
						control.pop();
						if (hasKey) {
							throw new Error(
								"Unexpected end of map; expected a value for key",
							);
						}
						control.yield(mapper(map));
					}
				},
				onYield(value) {
					if (!hasKey) {
						key = value;
						hasKey = true;
						return;
					}
					map.push([key, value]);
					hasKey = false;
				},
			} as DecoderHandlerInstance;
		},
	} satisfies DecodingHandler<MapStartEvent>;
	return handler;
}

export const mapDecodingHandler: DecodingHandler<MapStartEvent> =
	createMapDecodingHandler((entires) => new Map(entires));
export const mapOrObjectDecodingHandler: DecodingHandler<MapStartEvent> =
	createMapDecodingHandler((entires) => {
		const isObject = entires.length > 0 &&
			entires.every((e) => typeof e[0] === "string");
		if (isObject) {
			return Object.fromEntries(entires);
		}
		return new Map(entires);
	});
