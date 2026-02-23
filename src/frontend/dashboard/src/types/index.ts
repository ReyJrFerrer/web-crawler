// ── Queue / Frontier ─────────────────────────────────────────────────────────

export interface QueueCounts {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
}

export interface TopDomain {
	domain: string;
	count: number;
}

export interface QueueMetrics {
	status: "connected" | "offline";
	isPaused?: boolean;
	counts: QueueCounts;
	currentRate: string;
	topDomainsWaiting: TopDomain[];
}

// ── Worker / System Health ───────────────────────────────────────────────────

export interface QueueJobEntry {
	id: string;
	url: string;
	state: "waiting" | "active" | "delayed" | "failed" | "completed";
	timestamp: string;
}

export interface MetricPoint {
	time: string;
	ram_mb: number;
	cpu_percent: number;
}

export interface WorkerInfo {
	id: string;
	name: string;
	status: "online" | "offline" | "busy" | "idle";
	urlsDiscovered: number;
	pagesFetched: number;
	queueBreakdown: QueueCounts;
	assignedDomains: string[];
	lastActive: string;
}

export interface WorkerHealth {
	workersOnline: number;
	workers: WorkerInfo[];
	metrics: MetricPoint[];
	dnsCacheEntries: number;
}

// ── Data Explorer ────────────────────────────────────────────────────────────

export interface DataRecord {
	id: string;
	url: string;
	status: number;
	title: string;
	linksFound: number;
	timestamp: string;
}

// ── Error Logs ───────────────────────────────────────────────────────────────

export interface ErrorLogEntry {
	url: string;
	error: string;
	attempts: number;
	ts?: string;
}

// ── Control Panel ────────────────────────────────────────────────────────────

export interface ApiResponse {
	success: boolean;
	message?: string;
	status?: string;
}
