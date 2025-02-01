import type { ReaderState } from "./common.ts";
import type { EndEventData } from "./events.ts";

export function checkCollectionEnd(state: ReaderState) {
	if (state.itemsToRead.length <= 0) {
		return [];
	}

	while (true) {
		if (state.itemsToRead.length === 0) {
			break;
		}
		state.itemsToRead[state.itemsToRead.length - 1]--;
		if (state.itemsToRead[state.itemsToRead.length - 1] > 0) {
			break;
		}
		const type = state.hierarchy.pop();
		state.itemsToRead.pop();
		state.enqueueEventData({
			eventType: "end",
			majorType: type as EndEventData["majorType"],
		});
	}
}
