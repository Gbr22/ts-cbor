import { assertRewrite } from "../../test_utils.ts";

Deno.test(async function arrayIdentityTest() {
    await assertRewrite(["alma","körte","szilva"]);
});

Deno.test(async function nestedArrayIdentityTest() {
    await assertRewrite([
        "alma","körte","szilva",
        [1,2,[3,4,5]],
    ]);
});
