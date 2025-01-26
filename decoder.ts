import { isNumerical, MajorType } from "./common.ts";
import { DecoderEvent } from "./events.ts";
import { IterationControl } from "./iteration-control.ts";
import { collectBytes } from "./utils.ts";

export interface Decoder {
	[Symbol.asyncIterator](): AsyncIterator<DecoderEvent>;
}

const Mode = Object.freeze({
	ExpectingDataItem: 0,
	ReadingArgument: 1,
	ReadingData: 2,
});

const SubMode = Object.freeze({
	Normal: 0,
	ReadingIndefiniteByteString: 1,
});

export async function* consumeByteString(decoder: Decoder): AsyncIterableIterator<Uint8Array,void,void> {
	let counter = 1;

	for await (const value of decoder) {
		if (value.majorType != MajorType.ByteString) {
			throw new Error(`Unexpected major type ${value.majorType} while reading byte string`);
		}
		if (value.eventType === "start") {
            counter++;
        }
        if (value.eventType === "end") {
            counter--;
        }
        if (counter === 0) {
            return;
        }
        if (value.eventType === "data") {
			yield value.data;
        }
	}
	throw new Error(`Unexpected end of stream counter: ${counter}`);
}

export async function parseDecoder<T>(decoder: Decoder): Promise<T> {
	let rootObject;
	let currentObject;
	
	for await (const event of decoder) {
		if (event.eventType === "literal") {
			return event.data as T;
		}
		if (event.eventType === "start" && event.majorType === MajorType.ByteString) {
			const it = await consumeByteString(decoder);
			const bytes = await collectBytes(it);
			return bytes as T;
		}
	}

	return rootObject as T;
}

type ReaderState = {
	reader: ReadableStreamDefaultReader<Uint8Array>
	isReaderDone: boolean,
	currentBuffer: Uint8Array
	mode: number
	subMode: number
	index: number
	majorType: number
	additionalInfo: number
	numberOfBytesToRead: number
	numberValue: number | bigint
	argumentBytes: number[]
	isIndefinite: boolean
	byteArrayNumberOfBytesToRead: number
};

function createReaderState(reader: ReadableStreamDefaultReader<Uint8Array>): ReaderState {
	return {
		reader,
		isReaderDone: false,
		currentBuffer: new Uint8Array(),
		mode: Mode.ExpectingDataItem,
		subMode: NaN,
		index: 0,
		majorType: NaN,
		additionalInfo: NaN,
		numberOfBytesToRead: 0,
		numberValue: 0,
		argumentBytes: [],
		isIndefinite: false,
		byteArrayNumberOfBytesToRead: 0,
	}
}

function flushHeaderAndArgument(state: ReaderState) {
	if (isNumerical(state.majorType)) {
		state.mode = Mode.ExpectingDataItem;
		if (state.majorType === MajorType.NegativeInteger) {
			if (typeof state.numberValue === "bigint") {
				state.numberValue = (state.numberValue * -1n) -1n;
			} else {
				state.numberValue = (state.numberValue * -1) -1;
			}
		}
		IterationControl.yield({
			eventType: "literal",
			majorType: state.majorType,
			data: state.numberValue,
		});
	}
	if (state.majorType == MajorType.SimpleValue) {
		if (state.additionalInfo >= 25 && state.additionalInfo <= 27) {
			// TODO: Implement float
			IterationControl.yield({
				eventType: "literal",
				majorType: MajorType.SimpleValue,
				bytes: state.argumentBytes,
				data: state.numberValue,
			})
		}
		let numberValue = state.additionalInfo;
		if (state.argumentBytes.length > 0) {
			numberValue = state.argumentBytes[0];
		}
		let value: number | false | true | null | undefined = Number(numberValue);
		if (numberValue == 20) {
			value = false;
		}
		if (numberValue == 21) {
			value = true;
		}
		if (numberValue == 22) {
			value = null;
		}
		if (numberValue == 23) {
			value = undefined;
		}
		IterationControl.yield({
			eventType: "literal",
			majorType: MajorType.SimpleValue,
			numberValue: numberValue,
			data: value,
		});
	}
	if (state.majorType == MajorType.ByteString) {
		state.mode = Mode.ReadingData;
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error("Array too large");
		}
		IterationControl.yield({
			eventType: "start",
			length: state.byteArrayNumberOfBytesToRead,
			majorType: MajorType.ByteString,
		});
	}
	throw new Error("Invalid major type");
}

async function handleExpectingDataItemMode(state: ReaderState) {
	if (state.isReaderDone) {
		IterationControl.return();
	}
	const byte = state.currentBuffer[state.index];
	state.index++;
	
	state.majorType = byte >>> 5;
	state.mode = Mode.ReadingArgument;
	state.additionalInfo = byte & 0b00011111;
	state.numberValue = 0;
	state.numberOfBytesToRead = 0;
	state.argumentBytes = [];
	state.isIndefinite = false;

	if (state.additionalInfo < 24) {
		state.numberValue = state.additionalInfo;
		flushHeaderAndArgument(state);
	}
	if (state.additionalInfo == 24) {
		state.numberOfBytesToRead = 1;
	}
	if (state.additionalInfo == 25) {
		state.numberOfBytesToRead = 2;
	}
	if (state.additionalInfo == 26) {
		state.numberOfBytesToRead = 4;
	}
	if (state.additionalInfo == 27) {
		state.numberValue = 0n;
		state.numberOfBytesToRead = 8;
	}
	if ([28,29,30].includes(state.additionalInfo)) {
		throw new Error(`additionalInfo cannot be ${state.additionalInfo}`);
	}
	if (state.additionalInfo == 31) {
		state.isIndefinite = true;
		state.numberOfBytesToRead = 0;
		if (state.majorType == MajorType.ByteString) {
			state.mode = Mode.ExpectingDataItem;
			state.subMode = SubMode.ReadingIndefiniteByteString;
			IterationControl.yield({
				eventType: "start",
				length: undefined,
				majorType: MajorType.ByteString,
			});
		}
		if (state.majorType == MajorType.SimpleValue) {
			state.mode = Mode.ExpectingDataItem;
			if (state.subMode == SubMode.ReadingIndefiniteByteString) {
				IterationControl.yield({
					eventType: "end",
					majorType: MajorType.ByteString
				});
			}
			throw new Error(`Unexpected stop code`);
		}
		throw new Error(`Major Type ${state.majorType} cannot be isIndefinite`);
	}
}
async function handleReadingArgumentMode(state: ReaderState) {
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

async function handleByteStringData(state: ReaderState) {
	if (state.byteArrayNumberOfBytesToRead <= 0) {
		state.mode = Mode.ExpectingDataItem;
		IterationControl.yield({
			eventType: "end",
			majorType: MajorType.ByteString,
		});
	}
	if (state.isReaderDone) {
		throw new Error(`Unexpected end of stream when ${state.byteArrayNumberOfBytesToRead} bytes are left to read`);
	}
	const to = state.index + state.byteArrayNumberOfBytesToRead;
	const slice = state.currentBuffer.slice(state.index, to);
	state.index += state.byteArrayNumberOfBytesToRead;
	state.byteArrayNumberOfBytesToRead -= slice.length;
	if (slice.length > 0) {
		IterationControl.yield({
			eventType: "data",
			majorType: MajorType.ByteString,
			data: slice,
		});
	}
}

async function handleReadingDataMode(state: ReaderState) {
	if (state.majorType == MajorType.ByteString) {
		await handleByteStringData(state);
		return;
	}
	throw new Error(`Invalid major type ${state.majorType} in reading data mode`);
}

async function handleDecoderIterationData(state: ReaderState) {
	if (state.mode == Mode.ReadingData) {
		await handleReadingDataMode(state);
		return;
	}
	if (state.mode == Mode.ExpectingDataItem) {
		await handleExpectingDataItemMode(state);
		return;
	}
	if (state.mode == Mode.ReadingArgument) {
		await handleReadingArgumentMode(state);
		return;
	}
	throw new Error(`Invalid mode ${JSON.stringify(state.mode)}`);
}

async function refreshBuffer(state: ReaderState) {
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

async function handleDecoderIteration(state: ReaderState) {
	await refreshBuffer(state);
	await handleDecoderIterationData(state);
}

export function decoderFromStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const state = createReaderState(reader);

	return {
		[Symbol.asyncIterator]() {
			return IterationControl.createIterator<DecoderEvent>(async () => {
				await handleDecoderIteration(state);
			});
		}
	}
}
