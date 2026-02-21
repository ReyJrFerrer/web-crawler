import { useQueueMetrics } from "../../providers/useQueueMetrics";
import { useWorkerHealth } from "../../providers/useWorkerHealth";

function StatCard({
	label,
	value,
	sub,
	accent,
}: {
	label: string;
	value: string | number;
	sub?: string;
	accent?: string;
}) {
	return (
		<div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-1">
			<p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
				{label}
			</p>
			<p className={`text-3xl font-bold ${accent ?? "text-white"}`}>{value}</p>
			{sub && <p className="text-xs text-gray-500">{sub}</p>}
		</div>
	);
}

export function GlobalStatus() {
	const { data: queue } = useQueueMetrics();
	const { data: worker } = useWorkerHealth();

	const totalDiscovered =
		queue.counts.waiting +
		queue.counts.active +
		queue.counts.completed +
		queue.counts.failed +
		queue.counts.delayed;

	const errorRate =
		totalDiscovered > 0
			? ((queue.counts.failed / totalDiscovered) * 100).toFixed(1)
			: "0.0";

	const statusColor =
		queue.status === "connected" ? "text-emerald-400" : "text-red-400";

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">
					Global Command Center
				</h2>
				<p className="text-sm text-gray-500">High-level crawler overview</p>
			</div>

			<div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
				<StatCard
					label="Global Status"
					value={queue.status === "connected" ? "Running" : "Offline"}
					sub={`${worker.workersOnline} worker(s) online`}
					accent={statusColor}
				/>
				<StatCard
					label="URLs Discovered"
					value={totalDiscovered.toLocaleString()}
					sub="unique URLs in frontier"
				/>
				<StatCard
					label="Pages Fetched"
					value={queue.counts.completed.toLocaleString()}
					sub={queue.currentRate}
				/>
				<StatCard
					label="Global Error Rate"
					value={`${errorRate}%`}
					sub={`${queue.counts.failed} failed jobs`}
					accent={Number(errorRate) > 5 ? "text-red-400" : "text-emerald-400"}
				/>
			</div>

			{/* Summary bar */}
			<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
					Queue Breakdown
				</p>
				<div className="grid grid-cols-5 gap-3">
					{(
						[
							["Waiting", queue.counts.waiting, "text-yellow-400"],
							["Active", queue.counts.active, "text-brand-500"],
							["Completed", queue.counts.completed, "text-emerald-400"],
							["Failed", queue.counts.failed, "text-red-400"],
							["Delayed", queue.counts.delayed, "text-purple-400"],
						] as const
					).map(([label, count, color]) => (
						<div key={label} className="text-center">
							<p className={`text-2xl font-bold ${color}`}>
								{count.toLocaleString()}
							</p>
							<p className="text-xs text-gray-500 mt-0.5">{label}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
