import { MajorTypes } from "../common.ts";
import { handleByteStringData } from "./byte-string.ts";
import type { ReaderState } from "./common.ts";
import { handleTextStringData } from "./text-string.ts";

export function handleReadingDataMode(
	state: ReaderState,
) {
	if (state.majorType == MajorTypes.ByteString) {
		handleByteStringData(state);
	} else if (state.majorType == MajorTypes.TextString) {
		handleTextStringData(state);
	} else {
		throw new Error(
			`Invalid major type ${state.majorType} in reading data mode`,
		);
	}
}
