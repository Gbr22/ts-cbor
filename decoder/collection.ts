import { DecoderEvent } from "../main.ts";
import { ReaderState } from "./common.ts";
import { EndEvent } from "./events.ts";

export function checkCollectionEnd(state: ReaderState): DecoderEvent[] {
    if (state.itemsToRead.length <= 0) {
        return [];
    }
    state.itemsToRead[state.itemsToRead.length-1]--;
    if (state.itemsToRead[state.itemsToRead.length-1] <= 0) {
        const type = state.hierarchy.pop();
        state.itemsToRead.pop();
        return [
            {
                eventType: "end",
                majorType: type as EndEvent["majorType"],
            } satisfies EndEvent
        ]
    }
    return [];
}
