import { assertEquals } from "@std/assert/equals";
import { consumeTextString, decoderFromStream, writeTextStream } from "../../main.ts";
import { assertNext, assertRewrite, bytesToStream, byteWritableStream } from "../../test_utils.ts";
import { collect, iterableToStream } from "../../utils.ts";

Deno.test(async function textStringIdentityTest() {
    await assertRewrite("Helló világ");
});

Deno.test(async function textStringStreamIdentityTest() {
    const chunks = [
        "Lorem á",
        "é ipsum",
        "dolor ű",
    ];
    const stream: ReadableStream<string> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeTextStream(writer,stream);
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const next = await assertNext(decoder.events())
    assertEquals(next.eventType, "start", "Expect start event");
    const readResult = (await collect(consumeTextString(decoder))).join("");

    assertEquals(readResult, chunks.join(""), "Expect correct bytes");
});