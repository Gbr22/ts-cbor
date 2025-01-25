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

export function decoderFromStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();

	const noYield = Symbol();
	let currentBuffer = new Uint8Array();
	let mode: number = Mode.ExpectingDataItem;
	let index = 0;
	let majorType: number = NaN;
	let additionalInfo: number = NaN;
	let numberOfBytesToRead = 0;
	let numberValue: number | bigint = 0;
	let isIndefinite = false;
	let byteArrayNumberOfBytesToRead = 0;
	let yieldValue: CborEvent | typeof noYield = noYield;

	return {
		[Symbol.asyncIterator]() {
			return async function* it(): AsyncIterableIterator<CborEvent,void,void> {
				function flushNumber() {
					if (isNumerical(majorType)) {
						mode = Mode.ExpectingDataItem;
						if (majorType === MajorType.NegativeInteger) {
							if (typeof numberValue === "bigint") {
								numberValue = (numberValue * -1n) -1n;
							} else {
								numberValue = (numberValue * -1) -1;
							}
						}
						yieldValue = {
							eventType: "literal",
							majorType: majorType as any,
							data: numberValue,
						};
					}
					if (majorType == MajorType.ByteString) {
						byteArrayNumberOfBytesToRead = Number(numberValue);
						if (numberValue > Number.MAX_SAFE_INTEGER) {
							throw new Error("Array too large");
						}
						yieldValue = {
							eventType: "start",
							majorType: MajorType.ByteString,
						};
					}
				}

				while (true) {
					if (yieldValue !== noYield) {
						yield yieldValue;
						yieldValue = noYield;
					}
					if (index >= currentBuffer.length) {
						const { done, value } = await reader.read();
						if (done) {
							return;
						}
						currentBuffer = value;
						index = 0;
					}
					if (mode == Mode.MajorType && majorType == MajorType.ByteString) {
						if (byteArrayNumberOfBytesToRead <= 0) {
							yieldValue = {
								eventType: "end",
								majorType: MajorType.ByteString,
							}
							continue;
						}
						const to = index + byteArrayNumberOfBytesToRead;
						const slice = currentBuffer.slice(index, to);
						index += byteArrayNumberOfBytesToRead;
						yieldValue = {
							eventType: "data",
							majorType: MajorType.ByteString,
							data: slice,
						}
						continue;
					}
					const byte = currentBuffer[index];
					if (mode == Mode.ExpectingDataItem) {
						majorType = byte >>> 5;
						mode = Mode.MajorType;
						additionalInfo = byte & 0b00011111;
						numberValue = 0;
						if (additionalInfo < 24) {
							numberOfBytesToRead = 0;
							numberValue = additionalInfo;
							flushNumber();
						}
						if (additionalInfo == 24) {
							numberOfBytesToRead = 1;
						}
						if (additionalInfo == 25) {
							numberOfBytesToRead = 2;
						}
						if (additionalInfo == 26) {
							numberOfBytesToRead = 4;
						}
						if (additionalInfo == 27) {
							numberValue = 0n;
							numberOfBytesToRead = 8;
						}
						if ([28,29,30].includes(additionalInfo)) {
							throw new Error("Reserved");
						}
						if (additionalInfo == 31) {
							isIndefinite = true;
							numberOfBytesToRead = 0;
						}
						if (isIndefinite && isNumerical(majorType)) {
							throw new Error(`Ill-formed Data Item of Major Type ${majorType}`);
						}
					} else if (mode == Mode.MajorType && numberOfBytesToRead > 0) {
						if (typeof numberValue == "bigint") {
							numberValue = (numberValue << 8n) | BigInt(byte);
						} else {
							numberValue = (numberValue << 8) | byte;
						}
						
						numberOfBytesToRead--;
						if (numberOfBytesToRead == 0) {
							flushNumber();
						}
					}

					index++;
				}
			}();
		}
	}
}