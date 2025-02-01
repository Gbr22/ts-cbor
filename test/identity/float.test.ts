import { assertEquals } from "@std/assert/equals";
import { decodeFloat, decoderFromStream, FloatLiteralEventData, MajorType, writeFloat16, writeFloat32, writeFloat64, decodeNumberEvent, AsyncWriter, DecoderLike, DecoderEvent } from "../../mod.ts";
import { assertNext, assertWriteReadIdentity, bytesToStream, byteWritableStream } from "../../test_utils.ts";
import { assertAlmostEquals } from "@std/assert/almost-equals";
import { intoAsyncWriter } from "../../encoder.ts";

async function floatTest(writeFloat: (writer: AsyncWriter, value: number)=>Promise<void>, value: number, tolerance: number) {
    const { getBytes, stream } = byteWritableStream();
    const writer = intoAsyncWriter(stream.getWriter());
    await writeFloat(writer,value);
    await writer.close();
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const next = await assertNext(decoder.events())
    assertEquals(next.eventData.eventType, "literal", "Expect literal event");
    assertEquals(next.eventData.majorType, MajorType.SimpleValue, "Expect SimpleValue major type");
    assertEquals((next as DecoderEvent<DecoderLike, FloatLiteralEventData>).eventData.simpleValueType, "float", "Expect simple value type");
    assertAlmostEquals(decodeFloat((next as DecoderEvent<DecoderLike, FloatLiteralEventData>).eventData.data), value, tolerance, "Expect correct value (data)");
    assertAlmostEquals(decodeNumberEvent(next) as number, value, tolerance, "Expect correct value (event)");
}

Deno.test(async function float16IdentityTest() {
    const tolerance = 0.001;
    await floatTest(writeFloat16, Math.PI, tolerance);
    await floatTest(writeFloat16, Math.E, tolerance);
});

Deno.test(async function float32IdentityTest() {
    const tolerance = 0.00001;
    await floatTest(writeFloat32, Math.PI, tolerance);
    await floatTest(writeFloat32, Math.E, tolerance);
});

Deno.test(async function float64IdentityTest() {
    const tolerance = 0.000000001;
    await floatTest(writeFloat64, Math.PI, tolerance);
    await floatTest(writeFloat64, Math.E, tolerance);
});

Deno.test(async function floatIdentityTest() {
    await assertWriteReadIdentity(0.123456789);
});
