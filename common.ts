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

export const numbericalTypes = [
	MajorType.UnsignedInteger,
	MajorType.NegativeInteger,
	MajorType.Tag,
];

export function isNumerical(type: number) {
	return (numbericalTypes as number[]).includes(type);
}