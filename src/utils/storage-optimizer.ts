import { promisify } from "node:util";
import zlib from "node:zlib";

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export type CompressionAlgo = "brotli" | "gzip" | "none";

/**
 * Compresses raw string data using the specified algorithm.
 */
export async function compressData(
	data: string,
	algo: CompressionAlgo = "brotli",
): Promise<Buffer> {
	if (algo === "brotli") {
		return await brotliCompress(data);
	}
	if (algo === "gzip") {
		return await gzip(data);
	}
	return Buffer.from(data);
}

/**
 * Decompresses buffer back to a string using the specified algorithm.
 */
export async function decompressData(
	buffer: Buffer,
	algo: CompressionAlgo = "brotli",
): Promise<string> {
	if (algo === "brotli") {
		const decompressed = await brotliDecompress(buffer);
		return decompressed.toString("utf-8");
	}
	if (algo === "gzip") {
		const decompressed = await gunzip(buffer);
		return decompressed.toString("utf-8");
	}
	return buffer.toString("utf-8");
}
