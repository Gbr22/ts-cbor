import { MajorType } from "../common.ts";
import { handleByteStringData } from "./byte-string.ts";
import { ReaderState } from "./common.ts";
import { handleTextStringData } from "./text-string.ts";

export async function handleReadingDataMode(state: ReaderState) {
    if (state.majorType == MajorType.ByteString) {
        await handleByteStringData(state);
        return;
    }
    if (state.majorType == MajorType.TextString) {
        await handleTextStringData(state);
        return;
    }
    throw new Error(`Invalid major type ${state.majorType} in reading data mode`);
}
