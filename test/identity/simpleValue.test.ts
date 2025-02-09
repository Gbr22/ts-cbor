import { assertEquals } from "@std/assert/equals";
import type {
	DecoderEvent,
	DecoderLike,
	SimpleValueEventData,
} from "../../mod.ts";
import {
	DecoderEventSubTypes,
	DecoderEventTypes,
	decoderFromStream,
	intoAsyncWriter,
	SimpleValue,
	writeSimpleValue,
} from "../../mod.ts";
import {
	assertNext,
	assertWriteReadIdentity,
	bytesToStream,
	byteWritableStream,
} from "../../test_utils.ts";
import { MajorTypes } from "../../common.ts";
import { defaultEventDecodingHandlers } from "../../decoder/handlers.ts";

Deno.test(async function simpleValueNumericIdentityTest() {
	for (let index = 0; index <= 255; index++) {
		const isReserved = index >= 24 && index <= 31;
		if (isReserved) {
			continue;
		}
		const simpleValue = index;
		const { getBytes, stream: writerStream } = byteWritableStream();
		const writer = intoAsyncWriter(writerStream.getWriter());
		await writeSimpleValue(writer, simpleValue);
		await writer.close();
		const writeResult = await getBytes();
		const decoder = decoderFromStream(
			defaultEventDecodingHandlers,
			bytesToStream(writeResult),
		);
		const next = await assertNext(decoder.events());
		assertEquals(
			next.eventData.eventType,
			DecoderEventTypes.Literal,
			"Expect literal event",
		);
		assertEquals(
			next.eventData.majorType,
			MajorTypes.SimpleValue,
			"Expect SimpleValue major type",
		);
		assertEquals(
			(next as DecoderEvent<SimpleValueEventData, DecoderLike>)
				.eventData
				.subType,
			DecoderEventSubTypes.SimpleValue,
			"Expect simple value type",
		);
		assertEquals(
			(next as DecoderEvent<SimpleValueEventData, DecoderLike>)
				.eventData
				.data,
			simpleValue,
			"Expect correct value",
		);
		const withinDefinedRange = simpleValue >= 20 && simpleValue <= 23;
		if (!withinDefinedRange) {
			await assertWriteReadIdentity(new SimpleValue(simpleValue));
		}
	}
});

Deno.test(async function simpleValueInterpretedIdentityTest() {
	await assertWriteReadIdentity(false);
	await assertWriteReadIdentity(true);
	await assertWriteReadIdentity(null);
	await assertWriteReadIdentity(undefined);
});
