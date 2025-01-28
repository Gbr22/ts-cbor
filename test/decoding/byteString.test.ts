import { assertEquals } from "@std/assert/equals";
import { consumeByteString, decoderFromStream, MajorType } from "../../main.ts";
import { assertNext, b, byteStringToStream, concat } from "../../test_utils.ts";
import { collectBytes } from "../../utils.ts";

Deno.test(async function byteStringDecodeTest() {
    const byteArray = new Uint8Array([1,2,3,4,5]);
    const decoder = decoderFromStream(byteStringToStream(concat`${b`010 00101`}${byteArray}`));
    const iterator = decoder.events();
    const next = await assertNext(iterator);
    assertEquals(next.eventType, "start", "Expect start event");
    assertEquals(next.majorType, MajorType.ByteString, "Expect correct major type");
    const bytes = await collectBytes(consumeByteString(decoder));
    assertEquals(bytes, byteArray, "Expect correct value");
});
