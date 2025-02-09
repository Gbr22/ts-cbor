import { assertEquals } from "@std/assert/equals";
import {
	consumeTextString,
	DecoderEventTypes,
	decoderFromStream,
} from "../../mod.ts";
import { assertNext } from "../../test_utils.ts";
import { collect, iterableToStream } from "../../utils.ts";
import { defaultEventDecodingHandlers } from "../../decoder/handlers.ts";

Deno.test(async function decodeUnicodeCodepointInMultipleChunksTest() {
	const chunks = [
		new Uint8Array([0x66]), // String header
		new Uint8Array([0x6B, 0xC3]), // kö
		new Uint8Array([0xB6, 0x72, 0x74, 0x65]), // örte
	];

	const expectedText = "körte";
	const stream: ReadableStream<Uint8Array> = iterableToStream(chunks);
	const decoder = decoderFromStream(defaultEventDecodingHandlers, stream);
	const event = await assertNext(decoder.events());
	assertEquals(
		event.eventData.eventType,
		DecoderEventTypes.Start,
		"Expect start event",
	);
	const parts = await collect(consumeTextString(event));
	const resultText = parts.join("");
	assertEquals(resultText, expectedText, "Expect correct text");
});
