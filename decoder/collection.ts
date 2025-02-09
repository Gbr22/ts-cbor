import type { ReaderState } from "./common.ts";

export function checkCollectionEnd(state: ReaderState) {
	if (state.handlerHierarchy.length <= 0) {
		return [];
	}

	while (true) {
		if (state.handlerHierarchy.length === 0) {
			break;
		}
		state.handlerHierarchy[state.handlerHierarchy.length - 1].itemsToRead--;
		if (
			state.handlerHierarchy[state.handlerHierarchy.length - 1]
				.itemsToRead > 0
		) {
			break;
		}
		state.getHandlers().onEnd(state.control);
		state.handlerHierarchy.pop();
	}
}
