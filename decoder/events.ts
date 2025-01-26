import { MajorType } from "../common.ts";

export type LiteralEvent = IntegerLiteralEvent | SimpleValueLiteralEvent | FloatLiteralEvent;
export type SimpleValueLiteralEvent = {
    eventType: "literal"
    majorType: typeof MajorType["SimpleValue"]
    numberValue: number
    data: number
};
export type FloatLiteralEvent = {
    eventType: "literal"
    majorType: typeof MajorType["SimpleValue"]
    bytes: number[]
    data: number
}
export type IntegerLiteralEvent = {
    eventType: "literal",
    majorType: typeof MajorType["NegativeInteger"] | typeof MajorType["UnsignedInteger"] | typeof MajorType["Tag"];
    data: number | bigint;
};
export type StartEvent = {
    eventType: "start",
    length: number | undefined,
    majorType: typeof MajorType["ByteString"],
};
export type EndEvent = {
    eventType: "end",
    majorType: typeof MajorType["ByteString"],
};
export type DataEvent = {
    eventType: "data",
    majorType: typeof MajorType["ByteString"];
    data: Uint8Array;
};

export type DecoderEvent = LiteralEvent | StartEvent | EndEvent | DataEvent;
