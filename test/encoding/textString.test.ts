import { assertEquals } from "@std/assert/equals";
import { writeTextStream } from "../../main.ts";
import { byteWritableStream, hex, stringToBytes } from "../../test_utils.ts";
import { iterableToStream } from "../../utils.ts";

Deno.test(async function encodeTextStringStreamTest() {
    const chunks = [
        "Lorem á",
        "é ipsum",
        "dolor ű",
    ];
    const stream: ReadableStream<string> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeTextStream(writer,stream);
    const result = await getBytes();
    const expected = stringToBytes(hex`
    7F                       # text(*)
        68                   # text(8)
            4C6F72656D20C3A1 # "Lorem á"
        68                   # text(8)
            C3A920697073756D # "é ipsum"
        68                   # text(8)
            646F6C6F7220C5B1 # "dolor ű"
        FF                   # primitive(*)
    `);
    assertEquals(result,expected, "Expect correct bytes");
});
