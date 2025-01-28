import { MajorType } from "../common.ts";
import { Decoder, DecoderSymbol } from "./common.ts";

export type LiteralEvent = IntegerLiteralEvent | SimpleValueLiteralEvent | FloatLiteralEvent | TagLiteralEvent;
export type TagLiteralEvent = {
    eventType: "literal",
    majorType: typeof MajorType["Tag"],
    data: Uint8Array,
    [DecoderSymbol]: Decoder,
};
export type SimpleValueLiteralEvent = {
    eventType: "literal"
    majorType: typeof MajorType["SimpleValue"]
    simpleValueType: "simple"
    data: number,
    [DecoderSymbol]: Decoder,
};
export type FloatLiteralEvent = {
    eventType: "literal"
    majorType: typeof MajorType["SimpleValue"]
    simpleValueType: "float"
    data: Uint8Array,
    [DecoderSymbol]: Decoder,
}
export type IntegerLiteralEvent = {
    eventType: "literal",
    majorType: typeof MajorType["NegativeInteger"] | typeof MajorType["UnsignedInteger"] | typeof MajorType["Tag"],
    data: Uint8Array,
    [DecoderSymbol]: Decoder,
};
export type StartEvent = {
    eventType: "start",
    length: number | bigint | undefined,
    majorType: typeof MajorType["ByteString"] | typeof MajorType["TextString"] | typeof MajorType["Array"] | typeof MajorType["Map"],
    [DecoderSymbol]: Decoder,
};
export type EndEvent = {
    eventType: "end",
    majorType: typeof MajorType["ByteString"] | typeof MajorType["TextString"] | typeof MajorType["Array"] | typeof MajorType["Map"],
    [DecoderSymbol]: Decoder,
};
export type DataEvent = {
    eventType: "data",
    majorType: typeof MajorType["ByteString"],
    data: Uint8Array,
    [DecoderSymbol]: Decoder,
} | {
    eventType: "data",
    majorType: typeof MajorType["TextString"],
    data: string,
    [DecoderSymbol]: Decoder,
};

export type DecoderEvent = LiteralEvent | StartEvent | EndEvent | DataEvent;
export type NumberEvent = IntegerLiteralEvent | FloatLiteralEvent;
