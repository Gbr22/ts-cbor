import { hex } from "../../test_utils.ts";
import { encodeValueSync } from "../../encoder.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test(async function encodeBigNumOver64BitPositiveLimitTest() {
	const value = 18446744073709551616n;
	const bytes = encodeValueSync(value);
	await assertEquals(
		bytes,
		hex`
        C2                            # Tag 2
           49                         # Byte string of length 9
              0100 0000 0000 0000 00  # Bytes content
    `,
	);
});

Deno.test(async function encodeBigNumOver64BitNegativeLimitTest() {
	const value = -18446744073709551617n;
	const bytes = encodeValueSync(value);
	await assertEquals(
		bytes,
		hex`
        c349010000000000000000
    `,
	);
});
