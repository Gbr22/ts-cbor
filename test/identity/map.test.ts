import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function mapIdentityTest() {
	await assertWriteReadIdentity(
		new Map<unknown, unknown>([
			["alma", "körte"],
			[2, "szilva"],
			[3, 4],
		]),
	);
});

Deno.test(async function mapObjectTest() {
	await assertWriteReadIdentity({
		"alma": 1,
		"körte": 2,
		"szilva": 3,
	});
});
