import { writeTextStream } from "../../mod.ts";
import { hex, writeThenAssertBytesEquals } from "../../test_utils.ts";
import { iterableToStream } from "../../utils.ts";

Deno.test(async function encodeTextStringStreamTest() {
    const chunks = [
        "Lorem á",
        "é ipsum",
        "dolor ű",
    ];
    await writeThenAssertBytesEquals(writeTextStream,[iterableToStream(chunks)],hex`
        7F                       # text(*)
            68                   # text(8)
                4C6F72656D20C3A1 # "Lorem á"
            68                   # text(8)
                C3A920697073756D # "é ipsum"
            68                   # text(8)
                646F6C6F7220C5B1 # "dolor ű"
            FF                   # primitive(*)
    `)
});
