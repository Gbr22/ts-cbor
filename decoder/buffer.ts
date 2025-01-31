import { IterationControl } from "../iteration-control.ts";
import { ReaderState } from "./common.ts";
import { DecoderIterationState } from "./iterating.ts";

export function refreshBuffer(iterationState: DecoderIterationState, state: ReaderState) {
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
        return;
    }
    if (state.index >= state.currentBuffer.length && !state.isReaderDone) {
        iterationState.pull();
        IterationControl.continue();
    }
}
