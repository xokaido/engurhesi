/** Bridge DOM and Workers runtime type differences in server-only code. */
export function toBody(body: unknown): BodyInit | null {
	return body as BodyInit | null;
}

export function toImageInputStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		}
	}) as unknown as ReadableStream<Uint8Array>;
}
