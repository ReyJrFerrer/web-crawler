import { getQueueInstance } from "./queueMetrics";

export interface QueueJobEntry {
	id: string;
	url: string;
	state: "waiting" | "active" | "delayed" | "failed" | "completed";
	timestamp: string;
}

export async function getQueueJobs(limit = 50): Promise<QueueJobEntry[]> {
	try {
		const q = getQueueInstance();
		if (!q) return [];

		// Fetch all active, waiting, delayed
		const jobs = await q.getJobs(
			["active", "waiting", "delayed", "failed"],
			0,
			limit - 1,
			true,
		);

		const mappedJobs = (
			await Promise.all(
				jobs.map(async (job) => {
					if (!job) return null;
					const state = (await job.getState()) as QueueJobEntry["state"];
					return {
						id: String(job.id),
						url: (job.data as { url?: string })?.url || "unknown",
						state: state || "waiting",
						timestamp: new Date(job.timestamp).toISOString(),
					};
				}),
			)
		).filter((j): j is NonNullable<typeof j> => j !== null);

		return mappedJobs;
	} catch (e) {
		console.error("Error fetching jobs:", e);
		return [];
	}
}
