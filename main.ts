import { IterationControl } from "./iteration-control.ts";

export const MajorType = Object.freeze({
	UnsignedInteger: 0,
	NegativeInteger: 1,
	ByteString: 2,
	TextString: 3,
	Array: 4,
	Map: 5,
	Tag: 6,
	SimpleValue: 7,
});

export type LiteralEvent = {
	eventType: "literal",
	majorType: typeof MajorType["NegativeInteger"] | typeof MajorType["UnsignedInteger"] | typeof MajorType["Tag"];
	data: number | bigint;
};
type StartEvent = {
	eventType: "start",
	majorType: typeof MajorType["ByteString"],
};
type EndEvent = {
	eventType: "end",
	majorType: typeof MajorType["ByteString"],
};
type DataEvent = {
	eventType: "data",
	majorType: typeof MajorType["ByteString"];
	data: Uint8Array;
};
type CborEvent = LiteralEvent | StartEvent | EndEvent | DataEvent;

export interface Decoder {
	[Symbol.asyncIterator](): AsyncIterator<CborEvent>;
}

const Mode = Object.freeze({
	ExpectingDataItem: -1,
	MajorType: 0,
});

const numbericalTypes = [
	MajorType.UnsignedInteger,
	MajorType.NegativeInteger,
	MajorType.Tag,
];

function isNumerical(type: number) {
	return (numbericalTypes as number[]).includes(type);
}

export async function* consumeByteString(iterator: AsyncIterableIterator<CborEvent,void,void>): AsyncIterableIterator<Uint8Array,void,void> {
	let counter = 1;
    while (true) {
        const { done, value } = await iterator.next();
        if (done) {
            break;
        }
        if (value.eventType === "start") {
            counter++;
        }
        if (value.eventType === "end") {
            counter--;
        }
        if (counter === 0) {
            break;
        }
        if (value.eventType === "data") {
			yield value.data;
        }
    }
}

type ReaderState = {
	reader: ReadableStreamDefaultReader<Uint8Array>
	currentBuffer: Uint8Array
	mode: number
	index: number
	majorType: number
	additionalInfo: number
	numberOfBytesToRead: number
	numberValue: number | bigint
	isIndefinite: boolean
	byteArrayNumberOfBytesToRead: number
};

function createReaderState(reader: ReadableStreamDefaultReader<Uint8Array>): ReaderState {
	return {
		reader,
		currentBuffer: new Uint8Array(),
		mode: Mode.ExpectingDataItem,
		index: 0,
		majorType: NaN,
		additionalInfo: NaN,
		numberOfBytesToRead: 0,
		numberValue: 0,
		isIndefinite: false,
		byteArrayNumberOfBytesToRead: 0,
	}
}

function flushNumber(state: ReaderState) {
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
			majorType: state.majorType as any,
			data: state.numberValue,
		});
	}
	if (state.majorType == MajorType.ByteString) {
		state.byteArrayNumberOfBytesToRead = Number(state.numberValue);
		if (state.numberValue > Number.MAX_SAFE_INTEGER) {
			throw new Error("Array too large");
		}
		IterationControl.yield({
			eventType: "start",
			majorType: MajorType.ByteString,
		});
	}
}

async function handleReadDataItemFirstByte(state: ReaderState) {
	const byte = state.currentBuffer[state.index];
	state.index++;
	state.majorType = byte >>> 5;
	state.mode = Mode.MajorType;
	state.additionalInfo = byte & 0b00011111;
	state.numberValue = 0;
	if (state.additionalInfo < 24) {
		state.numberOfBytesToRead = 0;
		state.numberValue = state.additionalInfo;
		flushNumber(state);
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
		throw new Error("Reserved");
	}
	if (state.additionalInfo == 31) {
		state.isIndefinite = true;
		state.numberOfBytesToRead = 0;
	}
	if (state.isIndefinite && isNumerical(state.majorType)) {
		throw new Error(`Ill-formed Data Item of Major Type ${state.majorType}`);
	}
}
async function handleReadExtendedCount(state: ReaderState) {
	const byte = state.currentBuffer[state.index];
	state.index++;
	if (typeof state.numberValue == "bigint") {
		state.numberValue = (state.numberValue << 8n) | BigInt(byte);
	} else {
		state.numberValue = (state.numberValue << 8) | byte;
	}
	
	state.numberOfBytesToRead--;
	if (state.numberOfBytesToRead == 0) {
		flushNumber(state);
	}
}

async function handleByteStringData(state: ReaderState) {
	if (state.byteArrayNumberOfBytesToRead <= 0) {
		IterationControl.yield({
			eventType: "end",
			majorType: MajorType.ByteString,
		});
	}
	const to = state.index + state.byteArrayNumberOfBytesToRead;
	const slice = state.currentBuffer.slice(state.index, to);
	state.index += state.byteArrayNumberOfBytesToRead;
	IterationControl.yield({
		eventType: "data",
		majorType: MajorType.ByteString,
		data: slice,
	});
}

async function handleDecoderIterationData(state: ReaderState) {
	if (state.mode == Mode.MajorType && state.majorType == MajorType.ByteString) {
		await handleByteStringData(state);
	}
	else if (state.mode == Mode.ExpectingDataItem) {
		await handleReadDataItemFirstByte(state);
	}
	else if (state.mode == Mode.MajorType && state.numberOfBytesToRead > 0) {
		await handleReadExtendedCount(state);
	}
}

async function handleDecoderIteration(state: ReaderState) {
	if (state.index >= state.currentBuffer.length) {
		const { done, value } = await state.reader.read();
		if (done) {
			IterationControl.return();
		}
		state.currentBuffer = value;
		state.index = 0;
	}
	await handleDecoderIterationData(state);
}

export function decoderFromStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const state = createReaderState(reader);

	return {
		[Symbol.asyncIterator]() {
			return IterationControl.createIterator<CborEvent>(async () => {
				await handleDecoderIteration(state);
			});
		}
	}
}
