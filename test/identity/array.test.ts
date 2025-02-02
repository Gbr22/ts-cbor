import { SimpleValue } from "../../mod.ts";
import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function arrayIdentityTest() {
	await assertWriteReadIdentity(["alma", "körte", "szilva"]);
	await assertWriteReadIdentity([1,2,3.4]);
	await assertWriteReadIdentity([new SimpleValue(1),new SimpleValue(2),new SimpleValue(3)]);
});

Deno.test(async function nestedArrayIdentityTest() {
	await assertWriteReadIdentity([
		"alma",
		"körte",
		"szilva",
		[1, 2, [3, 4, 5]],
	]);
});
