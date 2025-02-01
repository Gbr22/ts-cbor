import { TaggedValue } from "../../main.ts";
import { hex } from "../../test_utils.ts";
import { encodeValueSync } from "../../encoder.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test(async function encodeTaggedValueTest() {
    const value = new TaggedValue(100, 17896);
    const bytes = encodeValueSync(value);
    console.log(bytes);
    await assertEquals(bytes,hex`
        D8 64         # tag(100)
           19 45E8    # unsigned(17896)
    `);
});
