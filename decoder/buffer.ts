import type { ReaderState } from "./common.ts";
import type { DecoderIterationState } from "./iterating.ts";

export function refreshBuffer(
	state: ReaderState,
	iterationState: DecoderIterationState,
): boolean | void | Promise<boolean | void> {
	if (state.index >= state.currentBuffer.length && !state.isReaderDone) {
		return iterationState.pull((result) => {
			state.index = 0;
			const { done, value } = result;
			if (done) {
				state.isReaderDone = true;
				state.currentBuffer = new Uint8Array();
			} else {
				state.currentBuffer = value;
			}
		});
	}
}
