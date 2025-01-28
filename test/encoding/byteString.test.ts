import { assertEquals } from "@std/assert/equals";
import { writeByteStream } from "../../main.ts";
import { byteWritableStream, hex, stringToBytes } from "../../test_utils.ts";
import { iterableToStream } from "../../utils.ts";

Deno.test(async function encodeByteStringFromStreamTest() {
    const chunks = [
        new Uint8Array([1,2,3]),
        new Uint8Array([4,5,6]),
        new Uint8Array([7,8,9]),
    ];
    const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeByteStream(writer,stream);
    const result = await getBytes();
    const expected = stringToBytes(hex`
        5F         # bytes(*)
        43         # bytes(3)
            010203 # "\u0001\u0002\u0003"
        43         # bytes(3)
            040506 # "\u0004\u0005\u0006"
        43         # bytes(3)
            070809 # "\u0007\b\t"
        FF         # primitive(*)
    `);
    assertEquals(result,expected, "Expect correct bytes");
});