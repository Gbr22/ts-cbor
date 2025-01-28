import { writeByteStream } from "../../main.ts";
import { assertWriteReadIdentity, writeThenAssertParsedValueEquals } from "../../test_utils.ts";
import { iterableToStream, concatBytes } from "../../utils.ts";

Deno.test(async function byteStringIdentityTest() {
    await assertWriteReadIdentity(new Uint8Array([1,2,3,4,5]));
});

Deno.test(async function largeByteStringIdentityTest() {
    const buffer = new Uint8Array(0xFF+1);
    for (let i=0; i < buffer.length; i++) {
        buffer[i] = i & 255;
    }
    await assertWriteReadIdentity(buffer);
});

Deno.test(async function byteStringStreamIdentityTest() {
    const chunks = [
        new Uint8Array([1,2,3]),
        new Uint8Array([4,5,6]),
        new Uint8Array([7,8,9]),
    ];
    const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
    await writeThenAssertParsedValueEquals(writeByteStream,[stream],concatBytes(...chunks));
});
