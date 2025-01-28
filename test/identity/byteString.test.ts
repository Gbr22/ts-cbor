import { assertEquals } from "@std/assert/equals";
import { consumeByteString, decoderFromStream, writeByteStream } from "../../main.ts";
import { assertNext, assertRewrite, bytesToStream, byteWritableStream } from "../../test_utils.ts";
import { collectBytes, iterableToStream, joinBytes } from "../../utils.ts";

Deno.test(async function byteStringIdentityTest() {
    await assertRewrite(new Uint8Array([1,2,3,4,5]));
});

Deno.test(async function largeByteStringIdentityTest() {
    const buffer = new Uint8Array(0xFF+1);
    for (let i=0; i < buffer.length; i++) {
        buffer[i] = i & 255;
    }
    await assertRewrite(buffer);
});

Deno.test(async function byteStringStreamIdentityTest() {
    const chunks = [
        new Uint8Array([1,2,3]),
        new Uint8Array([4,5,6]),
        new Uint8Array([7,8,9]),
    ];
    const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeByteStream(writer,stream);
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const next = await assertNext(decoder.events())
    assertEquals(next.eventType, "start", "Expect start event");
    const readResult = await collectBytes(consumeByteString(decoder));

    assertEquals(readResult,joinBytes(...chunks), "Expect correct bytes");
});
