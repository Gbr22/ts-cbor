import { hex, parseTest } from "../../test_utils.ts";

Deno.test(async function parseTinyPositiveIntTest() {
    // Integers between [0; 23] are encoded as as themselves
    for (let i=0; i < 24; i++) {
        await parseTest(new Uint8Array([i]), i);
    }
});

Deno.test(async function parseTinyNegativeIntTest() {
    await parseTest(hex`20`,-1);
    await parseTest(hex`2C`,-13);
    await parseTest(hex`37`,-24);
});

Deno.test(async function parse1BytePositiveIntTest() {
    await parseTest(hex`18 7B`,123);
});

Deno.test(async function parse1ByteNegativeIntTest() {
    await parseTest(hex`38 7A`,-123);
});

Deno.test(async function parse2BytePositiveIntTest() {
    await parseTest(hex`19 3039`,12345);
});

Deno.test(async function parse2ByteNegativeIntTest() {
    await parseTest(hex`39 3038`,-12345);
});

Deno.test(async function parse4BytePositiveIntTest() {
    await parseTest(hex`1A 00FFE8A2`,16771234);
});

Deno.test(async function parse4ByteNegativeIntTest() {
    await parseTest(hex`3A 00FFE8A1`,-16771234);
});

Deno.test(async function parse8BytePositiveIntTest() {
    await parseTest(hex`1B 01B69B4BACD05F15`,123456789123456789n);
});

Deno.test(async function parse8ByteNegativeIntTest() {
    await parseTest(hex`3B 01B69B4BACD05F14`,-123456789123456789n);
});
