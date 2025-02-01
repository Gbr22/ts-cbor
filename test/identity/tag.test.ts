import { TaggedValue } from "../../mod.ts";
import { assertWriteReadIdentity } from "../../test_utils.ts";

const unassignedTag = 18446744073709551614n;
Deno.test(async function taggedValueIdentityTest() {
	await assertWriteReadIdentity(new TaggedValue(unassignedTag, false));
});
