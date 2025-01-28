import { writeByteStream } from "../../main.ts";
import { hex, writeThenAssertBytesEquals } from "../../test_utils.ts";
import { iterableToStream } from "../../utils.ts";

Deno.test(async function encodeByteStringStreamTest() {
    const chunks = [
        new Uint8Array([1,2,3]),
        new Uint8Array([4,5,6]),
        new Uint8Array([7,8,9]),
    ];
    await writeThenAssertBytesEquals(writeByteStream,[iterableToStream(chunks)],hex`
        5F         # bytes(*)
        43         # bytes(3)
            010203 # "\u0001\u0002\u0003"
        43         # bytes(3)
            040506 # "\u0004\u0005\u0006"
        43         # bytes(3)
            070809 # "\u0007\b\t"
        FF         # primitive(*)
    `);
});
