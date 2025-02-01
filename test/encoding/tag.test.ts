import { encodeValueSync, TaggedValue } from "../../mod.ts";
import { hex } from "../../test_utils.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test(async function encodeTaggedValueTest() {
    const value = new TaggedValue(100, 17896);
    const bytes = encodeValueSync(value);
    await assertEquals(bytes,hex`
        D8 64         # tag(100)
           19 45E8    # unsigned(17896)
    `);
});
