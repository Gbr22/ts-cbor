import { ReaderState } from "./common.ts";

export async function refreshBuffer(state: ReaderState) {
    while (state.index >= state.currentBuffer.length && !state.isReaderDone) {
        state.index = 0;
        const { done, value } = await state.reader.read();
        if (done) {
            state.isReaderDone = true;
            state.currentBuffer = new Uint8Array();
        } else {
            state.currentBuffer = value;
        }
    }
}
