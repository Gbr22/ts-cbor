import { WritableValue } from "../../main.ts";
import { assertRewrite } from "../../test_utils.ts";

Deno.test(async function nestedCollectionsIdentityTest() {
    await assertRewrite(new Map<WritableValue,WritableValue>([
        ["alma",["körte",5,[7,8,9,10]]],
        [[2,9],"szilva"],
        [3,4],
    ]));
});
