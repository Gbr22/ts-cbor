export type MajorTypes = Readonly<{
	UnsignedInteger: 0;
	NegativeInteger: 1;
	ByteString: 2;
	TextString: 3;
	Array: 4;
	Map: 5;
	Tag: 6;
	SimpleValue: 7;
}>;
export const MajorTypes: MajorTypes = Object.freeze({
	UnsignedInteger: 0,
	NegativeInteger: 1,
	ByteString: 2,
	TextString: 3,
	Array: 4,
	Map: 5,
	Tag: 6,
	SimpleValue: 7,
});

export type MajorType = typeof MajorTypes[keyof MajorTypes];

export const integerTypes = Object.freeze([
	MajorTypes.UnsignedInteger,
	MajorTypes.NegativeInteger,
	MajorTypes.Tag,
]);

export function isIntegerMajorType(
	type: number,
): type is typeof integerTypes[number] {
	return (integerTypes as number[]).includes(type);
}

export const AdditionalInfo = Object.freeze({
	Length1: 24,
	Length2: 25,
	Length4: 26,
	Length8: 27,
	IndefiniteLength: 31,
});

export const BREAK_BYTE = 0xFF;

export function serialize(unknown: unknown): string {
	if (unknown === undefined) {
		return "undefined";
	}
	if (unknown === null) {
		return "null";
	}
	if (typeof unknown === "bigint") {
		return `${unknown}n`;
	}
	if (unknown instanceof Array) {
		return `[${unknown.map(serialize).join(", ")}]`;
	}
	try {
		let prefix = "";
		if (typeof unknown === "object" && unknown && "__proto__" in unknown) {
			const chain = [];
			let current = unknown.__proto__;
			chain.push(current);
			while (true) {
				if (
					typeof current === "object" && current &&
					"__proto__" in current
				) {
					chain.push(current.__proto__);
					current = current.__proto__;
					continue;
				}
				break;
			}
			prefix = `(${
				chain.map((proto) => proto?.constructor?.name).join(" -> ")
			})`;
		}
		return `${prefix}${JSON.stringify(unknown)}`;
	} catch (_err) {
		return `'${unknown}'`;
	}
}

export class TaggedValue<T = unknown> {
	public tag: number | bigint;
	public value: T;
	constructor(tag: number | bigint, value: T) {
		this.tag = tag;
		this.value = value;
	}
}
