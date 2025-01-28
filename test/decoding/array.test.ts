import { hex, parseTest } from "../../test_utils.ts";

Deno.test(async function decodeDefiniteLengthArrayTest() {
    await parseTest(
        hex`85    # array(5)
            01 # unsigned(1)
            02 # unsigned(2)
            03 # unsigned(3)
            04 # unsigned(4)
            05 # unsigned(5)
        `,
        [1,2,3,4,5]
    );
});

Deno.test(async function decodeIndefiniteLengthArrayTest() {
    await parseTest(hex`
        9F      # Start indefinite-length array
            04  # 4
            05  # 5
            FF  # "break"
        `,
        [4,5]
    );
});
