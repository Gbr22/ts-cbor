import { arrayDecodingHandler } from "./handlers/array.ts";
import { bigNumDecodingHandler } from "./handlers/bigNum.ts";
import { byteStringDecodingHandler } from "./handlers/byteString.ts";
import { mapDecodingHandler, mapOrObjectDecodingHandler } from "./handlers/map.ts";
import { numberDecodingHandler } from "./handlers/number.ts";
import { simpleValueDecodingHandler } from "./handlers/simpleValue.ts";
import { taggedValueDecodingHandler } from "./handlers/taggedValue.ts";
import { textStringDecodingHandler } from "./handlers/textString.ts";
import type { DecodingHandler } from "./parse.ts";

export const defaultDecodingHandlers: DecodingHandler[] = [
    numberDecodingHandler,
    simpleValueDecodingHandler,
    arrayDecodingHandler,
    mapOrObjectDecodingHandler,
    textStringDecodingHandler,
    byteStringDecodingHandler,
    bigNumDecodingHandler,
    taggedValueDecodingHandler,
];

export {
    numberDecodingHandler,
    simpleValueDecodingHandler,
    arrayDecodingHandler,
    mapOrObjectDecodingHandler,
    mapDecodingHandler,
    textStringDecodingHandler,
    byteStringDecodingHandler,
    bigNumDecodingHandler,
    taggedValueDecodingHandler,
}