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

export type MajorType = typeof MajorType[keyof typeof MajorType];

export const integerTypes = Object.freeze([
	MajorType.UnsignedInteger,
	MajorType.NegativeInteger,
	MajorType.Tag,
]);

export function isIntegerMajorType(type: number): type is typeof integerTypes[number] {
	return (integerTypes as number[]).includes(type);
}

export const AdditionalInfo = Object.freeze({
	Length1: 24,
	Length2: 25,
	Length4: 26,
	Length8: 27,
	IndefiniteLength: 31,
});

export function serialize(unknown: unknown) {
	if (unknown === undefined) {
		return "undefined";
	}
	if (unknown === null) {
		return "null";
	}
	if (typeof unknown === "bigint") {
		return `${unknown}n`;
	}
	try {
		return JSON.stringify(unknown);
	} catch (err) {
		return `'${unknown}'`;
	}
}
