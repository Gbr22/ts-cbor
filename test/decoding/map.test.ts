import { hex, parseTest } from "../../test_utils.ts";

Deno.test(async function decodeIndefiniteLengthMapTest() {
    // Example from Section 3.2.2. of the CBOR specification

    await parseTest(hex`
        BF             # Start indefinite-length map
            63         # First key, UTF-8 string length 3
                46756e #   "Fun"
            F5         # First value, true
            63         # Second key, UTF-8 string length 3
                416d74 #   "Amt"
            21         # Second value, -2
            FF         # "break"
        `,
        new Map<unknown,unknown>([
            ["Fun", true],
            ["Amt", -2],
        ])
    );
});
