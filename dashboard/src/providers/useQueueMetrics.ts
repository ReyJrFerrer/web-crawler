import { useCallback, useEffect, useState } from "react";
import type { QueueMetrics } from "../types";

const MOCK: QueueMetrics = {
	status: "connected",
	counts: {
		waiting: 0,
		active: 0,
		completed: 0,
		failed: 0,
		delayed: 0,
	},
	currentRate: "0.0 pages/sec",
	topDomainsWaiting: [],
};

export function useQueueMetrics(intervalMs = 3000) {
	const [data, setData] = useState<QueueMetrics>(MOCK);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/metrics/queue");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as QueueMetrics;
			setData(json);
			setIsOffline(json.status === "offline");
		} catch {
			setData(MOCK);
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
