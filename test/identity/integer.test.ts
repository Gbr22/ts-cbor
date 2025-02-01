import { assertWriteReadIdentity } from "../../test_utils.ts";

Deno.test(async function positiveIntIdentityTest() {
	await assertWriteReadIdentity(0);
	await assertWriteReadIdentity(0xFF);
	await assertWriteReadIdentity(0xFF + 1);
	await assertWriteReadIdentity(0xFFFF);
	await assertWriteReadIdentity(0xFFFF + 1);
	await assertWriteReadIdentity(0xFFFF_FFFF);
	await assertWriteReadIdentity(0xFFFF_FFFFn + 1n);
	await assertWriteReadIdentity(0xFFFF_FFFF_FFFF_FFFFn);
});

Deno.test(async function negativeIntIdentityTest() {
	await assertWriteReadIdentity(-0);
	await assertWriteReadIdentity(-0xFF);
	await assertWriteReadIdentity(-0xFF - 2);
	await assertWriteReadIdentity(-0xFFFF);
	await assertWriteReadIdentity(-0xFFFF - 2);
	await assertWriteReadIdentity(-0xFFFF_FFFF);
	await assertWriteReadIdentity(-0xFFFF_FFFFn - 2n);
	await assertWriteReadIdentity(-0xFFFF_FFFF_FFFF_FFFFn);
});
