export { createMapDecodingHandler } from "./decoder/handlers/map.ts";
export {
	defaultDecodingHandlers,
	numberDecodingHandler,
    simpleValueDecodingHandler,
    arrayDecodingHandler,
    mapOrObjectDecodingHandler,
    mapDecodingHandler,
    textStringDecodingHandler,
    byteStringDecodingHandler,
} from "./decoder/handlers.ts";
export {
	integerEncodingHandler,
	floatEncodingHandler,
	booleanEncodingHandler,
	nullEncodingHandler,
	undefinedEncodingHandler,
	stringEncodingHandler,
	bigintEncodingHandler,
	uint8ArrayEncodingHandler,
	arrayBufferEncodingHandler,
	mapEncodingHandler,
	arrayEncodingHandler,
	syncIterableEncodingHandler,
	asyncIterableEncodingHandler,
	objectEncodingHandler,
} from "./encoder/default-handlers.ts";
export {
	decodeSimpleValue,
	isSimpleValueEvent,
	UnknownSimpleValue,
} from "./decoder/simple-value.ts";
export {
	decodeUint,
	decodeFloat,
	decodeNumberEvent,
} from "./decoder/numbers.ts";
export {
	encodeValueSync,
	writeByteStream,
	writeByteString,
	writeTextStream,
	writeTextString,
	writeValue,
	writeFalse,
	writeTrue,
	writeNull,
	writeUndefined,
	writeInt,
	writeIntTiny,
	writeInt8,
	writeInt16,
	writeInt32,
	writeInt64,
	writeFloat16,
	writeFloat32,
	writeFloat64,
	writeArgument,
	writeArgument8,
	writeArgument16,
	writeArgument32,
	writeArgument64,
	writeHeader,
	writeBreak,
	writeArrayHeader,
	writeSimpleValue,
	writeMap,
	writeObject,
	writeArray,
	writeIterable,
	writeAsyncIterable,
	writeSyncIterable,
	type AsyncWriter,
	type AsyncWriterSymbol,
	type SyncWriter,
	type SyncWriterSymbol,
	type WriterReturnType,
	type WriterErrorType,
	intoAsyncWriter,
	intoSyncWriter,
	mustUseAsyncWriter,
	sequentialWriteFunctions,
	sequentialWriteGenerator,
	type EncodingHandler,
} from "./encoder.ts";
export {
	parseDecoder,
	decodeValue,
} from "./decoder/parse.ts";
export {
	consumeByteString,
} from "./decoder/byte-string.ts";
export {
	consumeTextString,
} from "./decoder/text-string.ts";
export {
	decoderFromStream,
	decoderFromIterable,
	type IteratorPullResult,
} from "./decoder/iterating.ts";
export {
	type AsyncDecoder,
	type SyncDecoder,
	type Decoder,
	AsyncDecoderSymbol,
	SyncDecoderSymbol,
	type AsyncDecoderLike,
	type SyncDecoderLike,
	type DecoderLike,
} from "./decoder/common.ts";
export {
	type DecoderEventData,
	type LiteralEventData,
	type IntegerLiteralEventData,
	type SimpleValueLiteralEventData,
	type StartEventData,
	type StartArrayEventData,
	type StartMapEventData,
	type StartByteStringEventData,
	type StartTextStringEventData,
	type EndEventData,
	type DataEventData,
	type NumberEventData,
	type FloatLiteralEventData,
	type DecoderEvent,
} from "./decoder/events.ts";
export {
	MajorType,
} from "./common.ts";
