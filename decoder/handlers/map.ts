import { MajorTypes } from "../../common.ts";
import {
	bindIsStartEvent,
	DecoderEventTypes,
	type StartMapEvent,
} from "../events.ts";
import type {
	DecoderHandlerInstance,
	DecodingControl,
	DecodingHandler,
} from "../parse.ts";

type Entry = [unknown, unknown];
type MapData = Entry[];
export function createMapDecodingHandler(
	mapper: (entires: MapData) => unknown,
): DecodingHandler<StartMapEvent> {
	const handler = {
		match: bindIsStartEvent(MajorTypes.Map),
		handle(
			control: DecodingControl,
			event: StartMapEvent,
		): DecoderHandlerInstance {
			const map: MapData = new Array(Number(event.eventData.length || 0));
			let index = 0;
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
						return control.yield(mapper(map));
					}
				},
				onYield(value) {
					if (!hasKey) {
						key = value;
						hasKey = true;
						return;
					}
					map[index++] = [key, value];
					hasKey = false;
				},
			} as DecoderHandlerInstance;
		},
	} satisfies DecodingHandler<StartMapEvent>;
	return handler;
}

export const mapDecodingHandler: DecodingHandler<StartMapEvent> =
	createMapDecodingHandler((entires) => new Map(entires));
export const mapOrObjectDecodingHandler: DecodingHandler<StartMapEvent> =
	createMapDecodingHandler((entires) => {
		const isObject = entires.length > 0 &&
			entires.every((e) => typeof e[0] === "string");
		if (isObject) {
			return Object.fromEntries(entires);
		}
		return new Map(entires);
	});
