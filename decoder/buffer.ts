import type { ReaderState } from "./common.ts";
import type { DecoderIterationState } from "./iterating.ts";

export function refreshBuffer(
	state: ReaderState,
	iterationState: DecoderIterationState,
): boolean {
	if (iterationState.pulled.length > 0) {
		const result = iterationState.pulled.shift()!;
		state.index = 0;
		const { done, value } = result;
		if (done) {
			state.isReaderDone = true;
			state.currentBuffer = new Uint8Array();
		} else {
			state.currentBuffer = value;
		}
		return false;
	}
	if (state.index >= state.currentBuffer.length && !state.isReaderDone) {
		iterationState.pull();
		return true;
	}
	return false;
}
