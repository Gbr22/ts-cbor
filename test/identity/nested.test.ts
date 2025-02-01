import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function nestedCollectionsIdentityTest() {
    await assertWriteReadIdentity(new Map<unknown,unknown>([
        ["alma",["körte",5,[7,8,9,10]]],
        [[2,9],"szilva"],
        [3,4],
    ]));
});
