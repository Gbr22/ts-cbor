import { ReaderState } from "./common.ts";
import { flushHeaderAndArgument } from "./header.ts";

export async function handleReadingArgumentMode(state: ReaderState) {
    if (state.isReaderDone) {
        throw new Error(`Unexpected end of stream when ${state.numberOfBytesToRead} bytes are left to read`);
    }
    const byte = state.currentBuffer[state.index];
    state.index++;

    state.argumentBytes.push(byte);

    if (typeof state.numberValue == "bigint") {
        state.numberValue = (state.numberValue << 8n) | BigInt(byte);
    } else {
        state.numberValue = ((state.numberValue << 8) | byte) >>> 0;
    }
    
    state.numberOfBytesToRead--;
    if (state.numberOfBytesToRead == 0) {
        flushHeaderAndArgument(state);
    }
}