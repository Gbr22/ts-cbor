import { assertEquals } from "@std/assert/equals";
import { decodeFloat, decoderFromStream, FloatLiteralEvent, MajorType, writeFloat16, writeFloat32, writeFloat64, decodeNumberEvent } from "../../main.ts";
import { assertNext, assertRewrite, bytesToStream, byteWritableStream } from "../../test_utils.ts";
import { assertAlmostEquals } from "@std/assert/almost-equals";

async function floatTest(writeFloat: (writer: WritableStreamDefaultWriter<Uint8Array>, value: number)=>Promise<void>, value: number, tolerance: number) {
    const { getBytes, stream: writerStream } = byteWritableStream();
    const writer = writerStream.getWriter();
    await writeFloat(writer,value);
    const writeResult = await getBytes();
    const decoder = decoderFromStream(bytesToStream(writeResult));
    const next = await assertNext(decoder.events())
    assertEquals(next.eventType, "literal", "Expect literal event");
    assertEquals(next.majorType, MajorType.SimpleValue, "Expect SimpleValue major type");
    assertEquals((next as FloatLiteralEvent).simpleValueType, "float", "Expect simple value type");
    assertAlmostEquals(decodeFloat((next as FloatLiteralEvent).data), value, tolerance, "Expect correct value (data)");
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
    await assertRewrite(0.123456789);
});
