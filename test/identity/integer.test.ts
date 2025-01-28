import { assertRewrite } from "../../test_utils.ts";

Deno.test(async function positiveIntIdentityTest() {
    await assertRewrite(0);
    await assertRewrite(0xFF);
    await assertRewrite(0xFF+1);
    await assertRewrite(0xFFFF);
    await assertRewrite(0xFFFF+1);
    await assertRewrite(0xFFFF_FFFF);
    await assertRewrite(0xFFFF_FFFFn+1n);
    await assertRewrite(0xFFFF_FFFF_FFFF_FFFFn);
});

Deno.test(async function negativeIntIdentityTest() {
    await assertRewrite(-0);
    await assertRewrite(-0xFF);
    await assertRewrite(-0xFF-2);
    await assertRewrite(-0xFFFF);
    await assertRewrite(-0xFFFF-2);
    await assertRewrite(-0xFFFF_FFFF);
    await assertRewrite(-0xFFFF_FFFFn-2n);
    await assertRewrite(-0xFFFF_FFFF_FFFF_FFFFn);
});
