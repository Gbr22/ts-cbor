import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function arrayIdentityTest() {
	await assertWriteReadIdentity(["alma", "körte", "szilva"]);
});

Deno.test(async function nestedArrayIdentityTest() {
	await assertWriteReadIdentity([
		"alma",
		"körte",
		"szilva",
		[1, 2, [3, 4, 5]],
	]);
});
