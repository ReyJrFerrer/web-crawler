declare module "simhash-js" {
	export interface SimHashOptions {
		kshingles?: number;
		maxFeatures?: number;
	}

	export class SimHash {
		constructor(options?: SimHashOptions);
		hash(input: string): number;
	}

	export namespace Comparator {
		export function hammingDistance(x: string, y: string): number;
		export function similarity(x: string, y: string): number;
		export function hammingWeight(l: number): number;
	}

	export class Jenkins {
		hash32(input: string): string;
	}
}
