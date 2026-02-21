import { useErrorLogs } from "../../providers/useErrorLogs";
import { useQueueMetrics } from "../../providers/useQueueMetrics";

function CountBadge({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	return (
		<div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1">
			<p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
				{label}
			</p>
			<p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
		</div>
	);
}

export function QueueAnalytics() {
	const { data: queue } = useQueueMetrics();
	const { data: errors } = useErrorLogs();

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">
					Queue &amp; Frontier Analytics
				</h2>
				<p className="text-sm text-gray-500">
					BullMQ job counts &amp; domain backlog
				</p>
			</div>

			{/* Count cards */}
			<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
				<CountBadge
					label="Waiting"
					value={queue.counts.waiting}
					color="text-yellow-400"
				/>
				<CountBadge
					label="Active"
					value={queue.counts.active}
					color="text-brand-500"
				/>
				<CountBadge
					label="Completed"
					value={queue.counts.completed}
					color="text-emerald-400"
				/>
				<CountBadge
					label="Failed"
					value={queue.counts.failed}
					color="text-red-400"
				/>
				<CountBadge
					label="Delayed"
					value={queue.counts.delayed}
					color="text-purple-400"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{/* Top domains */}
				<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
						Domains with Largest Backlog
					</p>
					{queue.topDomainsWaiting.length === 0 ? (
						<p className="text-sm text-gray-600">No data yet</p>
					) : (
						<ul className="space-y-2">
							{queue.topDomainsWaiting.map(({ domain, count }) => {
								const max = queue.topDomainsWaiting[0]?.count ?? 1;
								const pct = Math.round((count / max) * 100);
								return (
									<li key={domain}>
										<div className="flex justify-between text-sm mb-1">
											<span className="text-gray-300 font-mono truncate max-w-[70%]">
												{domain}
											</span>
											<span className="text-gray-400">
												{count.toLocaleString()}
											</span>
										</div>
										<div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
											<div
												className="h-full bg-brand-600 rounded-full transition-all duration-500"
												style={{ width: `${pct}%` }}
											/>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{/* Recent error log */}
				<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
						Recent Failed Jobs (Dead-Letter)
					</p>
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{errors.map((entry, i) => (
							<div
								key={i}
								className="bg-gray-800 rounded-lg px-3 py-2 text-xs font-mono"
							>
								<p className="text-red-400 truncate">{entry.url}</p>
								<p className="text-gray-400 mt-0.5">{entry.error}</p>
								<p className="text-gray-600 mt-0.5">
									{entry.attempts} attempt{entry.attempts !== 1 ? "s" : ""}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
