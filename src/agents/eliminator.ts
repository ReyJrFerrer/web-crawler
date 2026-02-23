import { BloomFilter } from "bloomfilter";
import { config } from "../config";

/**
 * Custom 64-bit Simhash implementation to avoid the poor collision
 * resistance and bugs found in the 32-bit `simhash-js` library.
 */
class Simhash64 {
	private fnv1a64(str: string): bigint {
		let hash = 0xcbf29ce484222325n;
		for (let i = 0; i < str.length; i++) {
			hash ^= BigInt(str.charCodeAt(i));
			hash = BigInt.asUintN(64, hash * 0x100000001b3n);
		}
		return hash;
	}

	hash(text: string): bigint {
		// Use k-shingles (e.g. sequences of 3 words) or just words as tokens.
		// Using words directly is simpler and very robust for full HTML text.
		const tokens = text.toLowerCase().match(/\w+/g) || [];
		if (tokens.length === 0) return 0n;

		const v = new Int32Array(64);
		for (const token of tokens) {
			const h = this.fnv1a64(token);
			for (let i = 0; i < 64; i++) {
				if ((h & (1n << BigInt(i))) !== 0n) {
					v[i]++;
				} else {
					v[i]--;
				}
			}
		}

		let fingerprint = 0n;
		for (let i = 0; i < 64; i++) {
			if (v[i] > 0) {
				fingerprint |= 1n << BigInt(i);
			}
		}
		return fingerprint;
	}
}

export class DuplicateEliminator {
	private filter: BloomFilter;
	private simhashEngine: Simhash64;
	// Store recently processed simhashes to drop near-duplicates
	private recentHashes: bigint[] = [];
	private maxRecentHashes = 10000;

	constructor(size = 32 * 256 * 256, k = 16) {
		// defaults to 2MB filter size, roughly 10M URLs at 1% error
		this.filter = new BloomFilter(size, k);
		this.simhashEngine = new Simhash64();
	}

	isNew(url: string): boolean {
		if (this.filter.test(url)) {
			// Possible duplicate
			return false;
		}
		// Definitely new
		this.filter.add(url);
		return true;
	}

	/**
	 * Computes Simhash for extracted text and compares against recently stored content.
	 * Returns true if the content is a near-duplicate, false otherwise.
	 */
	isDuplicateContent(text: string): boolean {
		if (!text || text.trim().length === 0) return false;

		const currentHash = this.simhashEngine.hash(text);

		// Compare against recently stored content
		for (const storedHash of this.recentHashes) {
			const distance = this.hammingDistance(currentHash, storedHash);
			if (distance <= config.simhashThreshold) {
				return true; // Near-duplicate found
			}
		}

		// Not a duplicate, add to recent hashes
		this.recentHashes.push(currentHash);
		if (this.recentHashes.length > this.maxRecentHashes) {
			this.recentHashes.shift();
		}

		return false;
	}

	private hammingDistance(hash1: bigint, hash2: bigint): number {
		let xor = hash1 ^ hash2;
		let distance = 0;
		while (xor > 0n) {
			distance += Number(xor & 1n);
			xor >>= 1n;
		}
		return distance;
	}
}
