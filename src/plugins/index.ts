import axios from "axios";
import type * as cheerio from "cheerio";
import type { ParsedResult, ParserPlugin } from "../agents/parser";

/**
 * MetadataExtractorPlugin
 * It extracts standard SEO metadata including OpenGraph tags, canonical URLs,
 * and standard description/keywords for downstream analytics and indexing.
 */
export class MetadataExtractorPlugin implements ParserPlugin {
	name = "metadata";

	extract(_url: string, _html: string, $: cheerio.CheerioAPI) {
		const getMeta = (nameOrProperty: string) => {
			return (
				$(`meta[name="${nameOrProperty}"]`).attr("content") ||
				$(`meta[property="${nameOrProperty}"]`).attr("content") ||
				""
			).trim();
		};

		return {
			description: getMeta("description") || getMeta("og:description"),
			keywords: getMeta("keywords"),
			author: getMeta("author"),
			ogTitle: getMeta("og:title"),
			ogImage: getMeta("og:image"),
			ogUrl: getMeta("og:url"),
			canonicalUrl: $('link[rel="canonical"]').attr("href")?.trim() || "",
			language: $("html").attr("lang") || getMeta("og:locale") || "en",
		};
	}
}

export interface ElasticsearchPluginConfig {
	node: string;
	index: string;
	apiKey?: string;
	timeout?: number;
}

/**
 * ElasticsearchIndexerPlugin
 * It takes the fully parsed and deduplicated result and securely pushes
 * it to a configured Elasticsearch cluster using its REST API.
 */
export class ElasticsearchIndexerPlugin implements ParserPlugin {
	name = "elasticsearchAdapter";
	private config: ElasticsearchPluginConfig;

	constructor(config: ElasticsearchPluginConfig) {
		this.config = config;
	}

	async index(result: ParsedResult) {
		if (!this.config.node) {
			console.debug(
				"[ElasticsearchAdapter] Skipping indexing (No endpoint configured).",
			);
			return;
		}

		try {
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			if (this.config.apiKey) {
				headers.Authorization = `ApiKey ${this.config.apiKey}`;
			}

			// Sanitize endpoint to avoid double slashes
			const baseUrl = this.config.node.replace(/\/+$/, "");
			const endpoint = `${baseUrl}/${this.config.index}/_doc`;

			const document = {
				url: result.url,
				title: result.title,
				content: result.text,
				metadata: result.extractedData?.metadata || {},
				links_count: result.links.length,
				timestamp: new Date().toISOString(),
			};

			await axios.post(endpoint, document, {
				headers,
				timeout: this.config.timeout || 10000,
			});

			console.log(
				`[ElasticsearchAdapter] Successfully indexed document for ${result.url}`,
			);
		} catch (error: unknown) {
			const errMsg = error instanceof Error ? error.message : String(error);
			console.error(
				`[ElasticsearchAdapter] Failed to index ${result.url}:`,
				errMsg,
			);
		}
	}
}
