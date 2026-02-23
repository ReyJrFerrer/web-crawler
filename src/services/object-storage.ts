import {
	type CompressionAlgo,
	compressData,
	decompressData,
} from "../utils/storage-optimizer";

export interface ObjectStorageAdapter {
	putObject(_key: string, _data: string, _algo: CompressionAlgo): Promise<void>;
	getObject(_key: string, _algo: CompressionAlgo): Promise<string>;
	deleteObject(_key: string): Promise<void>;
}

/**
 * Stub/Prepared implementation for AWS S3 Storage
 */
export class S3ObjectStorageAdapter implements ObjectStorageAdapter {
	private bucketName: string;

	constructor() {
		// Mock config variables for now
		this.bucketName = process.env.S3_BUCKET_NAME || "crawler-raw-html";

		// TODO: Initialize S3 Client (e.g. using @aws-sdk/client-s3)
	}

	async putObject(
		_key: string,
		_data: string,
		_algo: CompressionAlgo = "brotli",
	): Promise<void> {
		// 1. Optimize data
		const compressedData = await compressData(_data, _algo);

		// 2. Mock putting object to S3
		console.log(
			`[S3Adapter Stub] Storing ${compressedData.byteLength} bytes to s3://${this.bucketName}/${_key} (Algorithm: ${_algo})`,
		);
		// TODO: Implement actual S3 PutObjectCommand
	}

	async getObject(
		_key: string,
		_algo: CompressionAlgo = "brotli",
	): Promise<string> {
		// Mock getting object from S3
		console.log(
			`[S3Adapter Stub] Retrieving from s3://${this.bucketName}/${_key}`,
		);

		// 1. Mock fetch from S3
		const mockBuffer = Buffer.from(""); // TODO: replace with actual S3 GetObjectCommand response

		// 2. Decompress data
		return decompressData(mockBuffer, _algo);
	}

	async deleteObject(_key: string): Promise<void> {
		console.log(`[S3Adapter Stub] Deleting s3://${this.bucketName}/${_key}`);
		// TODO: Implement actual S3 DeleteObjectCommand
	}
}

/**
 * Temporary Local/Mongo fallback adapter so that tests/current functionality don't break
 * while we transition to Object Storage.
 */
export class FallbackObjectStorageAdapter implements ObjectStorageAdapter {
	// This adapter mimics Object Storage using an in-memory or alternative store
	// Or we will integrate this into the main StorageService instead of an isolated one.

	async putObject(
		_key: string,
		_data: string,
		_algo: CompressionAlgo = "brotli",
	): Promise<void> {
		// Mock fallback storing
	}

	async getObject(
		_key: string,
		_algo: CompressionAlgo = "brotli",
	): Promise<string> {
		return "";
	}

	async deleteObject(_key: string): Promise<void> {}
}
