import { assertEquals } from "@std/assert/equals";
import { consumeByteString, decoderFromStream, MajorType } from "../../mod.ts";
import { assertNext, b, bytesToStream, concat } from "../../test_utils.ts";
import { collectBytes } from "../../utils.ts";

Deno.test(async function decodeByteStringTest() {
    const byteArray = new Uint8Array([1,2,3,4,5]);
    const decoder = decoderFromStream(bytesToStream(concat`${b`010 00101`}${byteArray}`));
    const iterator = decoder.events();
    const event = await assertNext(iterator);
    assertEquals(event.eventData.eventType, "start", "Expect start event");
    assertEquals(event.eventData.majorType, MajorType.ByteString, "Expect correct major type");
    const bytes = await collectBytes(consumeByteString(event));
    assertEquals(bytes, byteArray, "Expect correct value");
});
