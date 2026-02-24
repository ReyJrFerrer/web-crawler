import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutBucketLifecycleConfigurationCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { config } from "../config";
import {
	type CompressionAlgo,
	compressData,
	decompressData,
} from "../utils/storage-optimizer";

export interface ObjectStorageAdapter {
	putObject(key: string, data: string, algo: CompressionAlgo): Promise<void>;
	getObject(key: string, algo: CompressionAlgo): Promise<string>;
	deleteObject(key: string): Promise<void>;
	setupLifecycle(): Promise<void>;
}

/**
 * Stub/Prepared implementation for AWS S3 Storage
 */
export class S3ObjectStorageAdapter implements ObjectStorageAdapter {
	private bucketName: string;
	private client: S3Client;

	constructor() {
		this.bucketName = config.s3BucketName;

		let endpoint = config.s3Endpoint || undefined;
		if (endpoint?.includes(`://${this.bucketName}.`)) {
			endpoint = endpoint.replace(`://${this.bucketName}.`, "://");
		}

		this.client = new S3Client({
			region: config.s3Region || "us-east-1",
			endpoint: endpoint,
			credentials: {
				accessKeyId: config.s3AccessKeyId,
				secretAccessKey: config.s3SecretAccessKey,
			},
			forcePathStyle: false, // DO Spaces usually works with virtual-hosted style
		});
	}

	async setupLifecycle(): Promise<void> {
		try {
			console.log(
				`[S3Adapter] Configuring 30-day lifecycle rule for ${this.bucketName}...`,
			);
			await this.client.send(
				new PutBucketLifecycleConfigurationCommand({
					Bucket: this.bucketName,
					LifecycleConfiguration: {
						Rules: [
							{
								ID: "DeleteOldHTML",
								Filter: { Prefix: "" },
								Status: "Enabled",
								Expiration: {
									Days: 30,
								},
							},
						],
					},
				}),
			);
			console.log(`[S3Adapter] Lifecycle rule configured successfully.`);
		} catch (error: unknown) {
			const err = error as {
				name?: string;
				message?: string;
				$metadata?: { httpStatusCode?: number };
			};
			if (
				err.name === "AccessDenied" ||
				err.$metadata?.httpStatusCode === 403
			) {
				console.warn(
					`[S3Adapter] WARN: Your DigitalOcean Spaces API key lacks permission to configure bucket lifecycle rules. Please log in to the DigitalOcean Control Panel and manually configure a 30-day file deletion rule for the '${this.bucketName}' space to prevent excessive storage costs.`,
				);
			} else {
				console.error(
					`[S3Adapter] Failed to configure lifecycle rule:`,
					err.message || error,
				);
			}
		}
	}

	async putObject(
		key: string,
		data: string,
		algo: CompressionAlgo = "brotli",
	): Promise<void> {
		// 1. Optimize data
		const compressedData = await compressData(data, algo);

		// 2. Put object to S3
		const command = new PutObjectCommand({
			Bucket: this.bucketName,
			Key: key,
			Body: compressedData,
			ContentType: "text/html",
			Metadata: {
				compression: algo,
			},
		});

		await this.client.send(command);
	}

	async getObject(
		key: string,
		algo: CompressionAlgo = "brotli",
	): Promise<string> {
		const command = new GetObjectCommand({
			Bucket: this.bucketName,
			Key: key,
		});

		const response = await this.client.send(command);
		if (!response.Body) {
			throw new Error(`[S3Adapter] Object body is empty for key: ${key}`);
		}

		// Read the stream into a buffer
		const stream = response.Body as NodeJS.ReadableStream;
		const chunks: Uint8Array[] = [];
		for await (const chunk of stream) {
			chunks.push(chunk as Uint8Array);
		}
		const buffer = Buffer.concat(chunks);

		// 2. Decompress data
		return decompressData(buffer, algo);
	}

	async deleteObject(key: string): Promise<void> {
		const command = new DeleteObjectCommand({
			Bucket: this.bucketName,
			Key: key,
		});
		await this.client.send(command);
	}
}

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

	async setupLifecycle(): Promise<void> {
		console.log(
			"[FallbackObjectStorageAdapter] Lifecycle setup skipped in fallback mode.",
		);
	}
}
