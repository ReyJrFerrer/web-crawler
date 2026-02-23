import { useCallback, useEffect, useState } from "react";
import type { WorkerHealth, WorkerInfo } from "../types";

interface RawWorkerHealth {
	workersOnline: number;
	metrics?: { time: string; ram_mb: number; cpu_percent: number }[];
	dnsCacheEntries?: number;
	workers?: WorkerInfo[];
}

export function useWorkerHealth(intervalMs = 3000) {
	const [data, setData] = useState<WorkerHealth>({
		workersOnline: 0,
		workers: [],
		metrics: [],
		dnsCacheEntries: 0,
	});
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/metrics/system");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as RawWorkerHealth;

			let workers: WorkerInfo[] = [];

			if (json.workers && json.workers.length > 0) {
				workers = json.workers;
			} else if (json.workersOnline && json.workersOnline > 0) {
				workers = Array.from({ length: json.workersOnline }, (_, i) => ({
					id: `worker-${i + 1}`,
					name: `Fetcher-0${i + 1}`,
					status: "online" as const,
					urlsDiscovered: 0,
					pagesFetched: 0,
					queueBreakdown: {
						waiting: 0,
						active: 0,
						completed: 0,
						failed: 0,
						delayed: 0,
					},
					assignedDomains: [],
					lastActive: new Date().toISOString(),
				}));
			}

			setData({
				workersOnline: json.workersOnline || 0,
				workers,
				metrics: json.metrics || [],
				dnsCacheEntries: json.dnsCacheEntries || 0,
			});
			setIsOffline(false);
		} catch {
			setData({
				workersOnline: 0,
				workers: [],
				metrics: [],
				dnsCacheEntries: 0,
			});
			setIsOffline(true);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchData();
		const id = setInterval(() => void fetchData(), intervalMs);
		return () => clearInterval(id);
	}, [fetchData, intervalMs]);

	return { data, isOffline, loading };
}
