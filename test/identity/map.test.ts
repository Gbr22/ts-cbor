import { WritableValue } from "../../main.ts";
import { assertRewrite } from "../../test_utils.ts";

Deno.test(async function mapIdentityTest() {
    await assertRewrite(new Map<WritableValue,WritableValue>([
        ["alma","körte"],
        [2,"szilva"],
        [3,4],
    ]));
});
