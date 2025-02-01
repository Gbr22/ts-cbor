import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function bigNumIdentityTest() {
    await assertWriteReadIdentity(2n**65n);
    await assertWriteReadIdentity((-2n)**65n);
});
