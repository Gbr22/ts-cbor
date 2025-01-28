import { WritableValue } from "../../main.ts";
import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function mapIdentityTest() {
    await assertWriteReadIdentity(new Map<WritableValue,WritableValue>([
        ["alma","körte"],
        [2,"szilva"],
        [3,4],
    ]));
});
