import { assertEquals } from "@std/assert/equals";
import { consumeTextString, decoderFromStream, writeTextStream } from "../../main.ts";
import { assertNext, assertWriteReadIdentity, bytesToStream, byteWritableStream } from "../../test_utils.ts";
import { collect, iterableToStream } from "../../utils.ts";
import { intoAsyncWriter } from "../../encoder.ts";

Deno.test(async function textStringIdentityTest() {
    await assertWriteReadIdentity("Helló világ");
});

Deno.test(async function textStringStreamIdentityTest() {
    const chunks = [
        "Lorem á",
        "é ipsum",
        "dolor ű",
    ];
    const stream: ReadableStream<string> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = intoAsyncWriter(writerStream.getWriter());
    await writeTextStream(writer,stream);
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const event = await assertNext(decoder.events())
    assertEquals(event.eventType, "start", "Expect start event");
    const readResult = (await collect(consumeTextString(event))).join("");

    assertEquals(readResult, chunks.join(""), "Expect correct bytes");
});
