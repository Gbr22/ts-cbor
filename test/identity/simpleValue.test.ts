import { assertEquals } from "@std/assert/equals";
import { decoderFromStream, MajorType, SimpleValueLiteralEvent, writeSimpleValue } from "../../main.ts";
import { assertNext, assertWriteReadIdentity, bytesToStream, byteWritableStream } from "../../test_utils.ts";
import { intoAsyncWriter } from "../../encoder.ts";

Deno.test(async function simpleValueInterpretedIdentityTest() {
    await assertWriteReadIdentity(false);
    await assertWriteReadIdentity(true);
    await assertWriteReadIdentity(null);
    await assertWriteReadIdentity(undefined);
});

Deno.test(async function simpleValueNumericIdentityTest() {
    for (let index=0; index <= 255; index++) {
        const isReserved = index >= 24 && index <= 31;
        if (isReserved) {
            continue;
        }
        const simpleValue = index;
        const { getBytes, stream: writerStream } = byteWritableStream();
        const writer = intoAsyncWriter(writerStream.getWriter());
        await writeSimpleValue(writer,simpleValue);
        await writer.close();
        const writeResult = await getBytes();
        const decoder = decoderFromStream(bytesToStream(writeResult));
        const next = await assertNext(decoder.events())
        assertEquals(next.eventType, "literal", "Expect literal event");
        assertEquals(next.majorType, MajorType.SimpleValue, "Expect SimpleValue major type");
        assertEquals((next as SimpleValueLiteralEvent).simpleValueType, "simple", "Expect simple value type");
        assertEquals((next as SimpleValueLiteralEvent).data, simpleValue, "Expect correct value");
    }
});