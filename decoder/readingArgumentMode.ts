import type { ReaderState } from "./common.ts";
import { flushHeaderAndArgument } from "./header.ts";

export function handleReadingArgumentMode(
	state: ReaderState,
) {
	if (state.isReaderDone) {
		throw new Error(
			`Unexpected end of stream when ${state.numberOfBytesToRead} bytes are left to read`,
		);
	}
	const byte = state.currentBuffer[state.index];
	state.index++;

	state
		.argumentBytes[state.argumentBytes.length - state.numberOfBytesToRead] =
			byte;

	state.numberOfBytesToRead--;
	if (state.numberOfBytesToRead == 0) {
		flushHeaderAndArgument(state);
	}
}
