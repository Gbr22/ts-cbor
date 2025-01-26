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