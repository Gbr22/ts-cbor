This is a streamble CBOR parser/serializer that can be used synchronously or
asynchronously.

Simple non-streaming usage:

```ts
const bytes = encodeValueSync(inputValue);
const outputValue = decodeValue(bytes);
```

The second parameter of these functions is an array of `EncodingHandler` and
`DecodingHandler` objects respectively, which can be used to customize the
behaviour.

```ts
// Encoding
const stream: WritableStream<Uint8Array>;
const writer = intoAsyncWriter(stream.getWriter());
await writeValue(writer, value);
await writer.close();

// Decoding
const stream: ReadableStream<Uint8Array>;
const decoder = decoderFromStream(stream);
const value = await parseDecoder(decoder);

// If you need a more low-level API, you can iterate over the events of the decoder object.
const events = decoder.events();
for await (const event of events) {
	// Handle events
	if (isStartEvent(event, MajorTypes.TextString)) {
		const it = consumeTextString(event); // Returns an AsyncIterableIterator<string> or IterableIterator<string>
	}
}
```

Note: Multiple event iterators may exist simultaneously but events are only
consumed once. For `consumeTextString` and `consumeByteString` you should reach
the end of the string iterator before you continue to use an events iterator. If
you consume an event an then attempt to continue consuming a text/byte string,
the internal logic of the string consumption may break.

Iterables and Async iterables will be serialized as indefinite length arrays by
default.

You may override the default encoding/decoding handlers.

Example of an `EncodingHandler`:

```ts
export const mapEncodingHandler: EncodingHandler<Map<unknown, unknown>> = {
	match: (value) => value instanceof Map,
	write: writeMap, // WriteFunction
};
export function writeMap<Writer extends AnyWriter>(
	writer: Writer,
	value: Map<unknown, unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return sequentialWriteGenerator(writer, function* () {
		yield writeMapHeader(writer, value.size);
		for (const [key, item] of value) {
			yield writeValue(writer, key, encodingHandlers);
			yield writeValue(writer, item, encodingHandlers);
		}
	});
}
```

The above `WriteFunction` can be used both synchronously or asynchronously
depending on the type of Writer received. You may imagine await calls being
inserted at uses of the yield keyword.

If your WriteFunction needs to make use of async calls, you can use the
`mustUseAsyncWriter` helper function. When this function is called with a Writer
that does not support asynchronous writing an Error will be thrown.

```ts
export function writeAsyncIterable<Writer extends AnyWriter>(
	writer: Writer,
	value: AsyncIterable<unknown>,
	encodingHandlers: EncodingHandler[] = defaultEncodingHandlers,
): WriterReturnType<Writer> {
	return mustUseAsyncWriter(writer, async () => {
		await writeArrayHeader(writer);
		for await (const element of value as AsyncIterable<unknown>) {
			await writeValue(writer, element, encodingHandlers);
		}
		await writeBreak(writer);
	});
}
```

You may create your own `WriteFunction`, but there are plenty available in the
package.
