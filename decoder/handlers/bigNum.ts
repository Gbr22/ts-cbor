import type { TaggedValue } from "../../common.ts";
import type { DecodingHandler } from "../parse.ts";
import { createTaggedValueDecodingHandler, type TagEvent } from "./taggedValue.ts";

export const bigNumDecodingHandler: DecodingHandler<TagEvent> = createTaggedValueDecodingHandler((tag)=>{
    return tag === 2 || tag === 3;
}, (taggedValue: TaggedValue<unknown>) => {
    const bytes = (taggedValue as TaggedValue<Uint8Array>).value as Uint8Array;
    const isNegative = taggedValue.tag === 3;
    let value = 0n;
    for (const byte of bytes) {
        value = (value << 8n) | BigInt(byte);
    }
    if (isNegative) {
        value = -1n - value;
    }
    return value;
});
