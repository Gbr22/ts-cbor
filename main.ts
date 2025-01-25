type LiteralEvent = {
	eventType: "literal",
	majorType: number;
	data: number | bigint;
};
type CborEvent = LiteralEvent;

export interface Decoder {
	[Symbol.asyncIterator](): AsyncIterator<CborEvent>;
}

const Mode = Object.freeze({
	ExpectingDataItem: -1,
	MajorType: 0,
});
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
const numbericalTypes = [
	MajorType.UnsignedInteger,
	MajorType.NegativeInteger,
	MajorType.Tag,
];

function isNumerical(type: number) {
	return (numbericalTypes as number[]).includes(type);
}

export function decoderFromStream(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();

	return {
		[Symbol.asyncIterator]() {
			const noYield = Symbol();
			return async function* it(): AsyncIterableIterator<CborEvent,void,void> {
				let currentBuffer = new Uint8Array();
				let mode: number = Mode.ExpectingDataItem;
				let index = 0;
				let majorType: number = NaN;
				let additionalInfo: number = NaN;
				let numberOfBytesToRead = 0;
				let numberOfBytesToReadTotal = 0;
				let numberValue: number | bigint = 0;
				let isIndefinite = false;

				let yieldValue: CborEvent | typeof noYield = noYield;

				function flushNumber() {
					if (majorType === MajorType.NegativeInteger) {
						if (typeof numberValue === "bigint") {
							numberValue = (numberValue * -1n) -1n;
						} else {
							numberValue = (numberValue * -1) -1;
						}
					}
					yieldValue = {
						eventType: "literal",
						majorType,
						data: numberValue,
					};
				}

				while (true) {
					if (yieldValue !== noYield) {
						yield yieldValue;
						yieldValue = noYield;
					}
					if (currentBuffer.length-index <= 0) {
						const { done, value } = await reader.read();
						if (done) {
							return;
						}
						currentBuffer = value;
						index = 0;
					}
					while (true) {
						if (index >= currentBuffer.length) {
							break;
						}
						if (yieldValue != noYield) {
							yield yieldValue;
							yieldValue = noYield;
						}
						const byte = currentBuffer[index];
						if (mode == Mode.ExpectingDataItem) {
							majorType = byte >>> 5;
							mode = Mode.MajorType;
							additionalInfo = byte & 0b00011111;
							numberValue = 0;
							if (additionalInfo < 24) {
								numberOfBytesToRead = numberOfBytesToReadTotal = 0;
								numberValue = additionalInfo;
								flushNumber();
							}
							if (additionalInfo == 24) {
								numberOfBytesToRead = numberOfBytesToReadTotal = 1;
							}
							if (additionalInfo == 25) {
								numberOfBytesToRead = numberOfBytesToReadTotal = 2;
							}
							if (additionalInfo == 26) {
								numberOfBytesToRead = numberOfBytesToReadTotal = 4;
							}
							if (additionalInfo == 27) {
								numberValue = 0n;
								numberOfBytesToRead = numberOfBytesToReadTotal = 8;
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
						} else if (mode == Mode.MajorType && isNumerical(majorType)) {
							if (typeof numberValue == "bigint") {
								numberValue = (numberValue << 8n) | BigInt(byte);
							} else {
								numberValue = (numberValue << 8) | byte;
							}
							
							numberOfBytesToRead--;
							if (numberOfBytesToRead == 0) {
								mode = Mode.ExpectingDataItem;
								flushNumber();
							}
						}

						index++;
					}
				}
			}();
		}
	}
}