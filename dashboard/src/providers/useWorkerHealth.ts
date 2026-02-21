import { useCallback, useEffect, useState } from "react";
import type { WorkerHealth } from "../types";

const MOCK: WorkerHealth = {
	workersOnline: 3,
	metrics: [
		{ time: "10:00", ram_mb: 120, cpu_percent: 15 },
		{ time: "10:01", ram_mb: 125, cpu_percent: 22 },
		{ time: "10:02", ram_mb: 123, cpu_percent: 18 },
		{ time: "10:03", ram_mb: 128, cpu_percent: 30 },
		{ time: "10:04", ram_mb: 121, cpu_percent: 12 },
	],
	dnsCacheEntries: 842,
};

export function useWorkerHealth(intervalMs = 3000) {
	const [data, setData] = useState<WorkerHealth>(MOCK);
	const [isOffline, setIsOffline] = useState(false);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		try {
			const res = await fetch("/api/metrics/system");
			if (!res.ok) throw new Error("non-2xx");
			const json = (await res.json()) as WorkerHealth;
			setData(json);
			setIsOffline(false);
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
