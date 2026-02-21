import { useEffect, useState } from "react";
import { useErrorLogs } from "../../providers/useErrorLogs";
import { useQueueJobs } from "../../providers/useQueueJobs";
import { useQueueMetrics } from "../../providers/useQueueMetrics";
import { useWorkerHealth } from "../../providers/useWorkerHealth";
import type { ApiResponse } from "../../types";

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Confirm modal (used by flush buttons)
// ---------------------------------------------------------------------------

type ModalTarget = "redis" | null;

function ConfirmModal({
	target,
	onConfirm,
	onCancel,
}: {
	target: ModalTarget;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	if (!target) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
				<h3 className="text-base font-semibold text-white mb-2">
					Confirm Flush
				</h3>
				<p className="text-sm text-gray-400 mb-6">
					This will permanently clear the{" "}
					<span className="text-red-400 font-semibold">Redis queue</span>. This
					action cannot be undone.
				</p>
				<div className="flex gap-3 justify-end">
					<button
						type="button"
						onClick={onCancel}
						className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors"
					>
						Yes, flush it
					</button>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GlobalStatus() {
	const { data: queue } = useQueueMetrics();
	const { data: worker } = useWorkerHealth();
	const { data: errors } = useErrorLogs();
	const { data: liveJobs } = useQueueJobs();

	// --- control panel state ---
	const [seedUrl, setSeedUrl] = useState("");
	const [seedLoading, setSeedLoading] = useState(false);
	const [seedResult, setSeedResult] = useState<ApiResponse | null>(null);

	const [pauseLoading, setPauseLoading] = useState(false);
	const [pauseResult, setPauseResult] = useState<ApiResponse | null>(null);
	const [queueState, setQueueState] = useState<
		"running" | "paused" | "stopped"
	>("running");

	const [flushModal, setFlushModal] = useState<ModalTarget>(null);
	const [flushResult, setFlushResult] = useState<ApiResponse | null>(null);

	// Sync paused state from backend to UI state on load or when another client pauses
	useEffect(() => {
		if (queue.isPaused !== undefined && queueState !== "stopped") {
			setQueueState(queue.isPaused ? "paused" : "running");
		}
	}, [queue.isPaused, queueState]);

	async function handleSeed(e: React.FormEvent) {
		e.preventDefault();
		if (!seedUrl.trim()) return;
		setSeedLoading(true);
		setSeedResult(null);
		try {
			const res = await fetch("/api/queue/seed", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: seedUrl.trim() }),
			});
			const json = (await res.json()) as ApiResponse;
			setSeedResult(json);
			if (json.success) setSeedUrl("");
		} catch {
			setSeedResult({ success: false, message: "Network error — BFF offline" });
		} finally {
			setSeedLoading(false);
		}
	}

	async function handleQueueAction(action: "pause" | "resume" | "stop") {
		setPauseLoading(true);
		setPauseResult(null);
		const endpoint = `/api/queue/${action}`;
		try {
			const res = await fetch(endpoint, { method: "POST" });
			const json = (await res.json()) as ApiResponse;
			setPauseResult(json);
			if (json.success) {
				if (action === "pause") setQueueState("paused");
				else if (action === "resume") setQueueState("running");
				else if (action === "stop") setQueueState("stopped");
			}
		} catch {
			setPauseResult({
				success: false,
				message: "Network error — BFF offline",
			});
		} finally {
			setPauseLoading(false);
		}
	}

	async function handleFlush() {
		if (!flushModal) return;
		const target = flushModal;
		setFlushModal(null);
		setFlushResult(null);
		try {
			const res = await fetch("/api/queue/flush", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ target }),
			});
			const json = (await res.json()) as ApiResponse;
			setFlushResult(json);
		} catch {
			setFlushResult({
				success: false,
				message: "Network error — BFF offline",
			});
		}
	}

	// --- derived stats ---
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
			{/* ------------------------------------------------------------------ */}
			{/* Page heading                                                         */}
			{/* ------------------------------------------------------------------ */}
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">
					Global Command Center
				</h2>
				<p className="text-sm text-gray-500">High-level crawler overview</p>
			</div>

			{/* ------------------------------------------------------------------ */}
			{/* Top stat cards                                                       */}
			{/* ------------------------------------------------------------------ */}
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

			{/* ------------------------------------------------------------------ */}
			{/* Queue breakdown bar                                                  */}
			{/* ------------------------------------------------------------------ */}
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

			{/* ------------------------------------------------------------------ */}
			{/* Domain backlog + recent failed jobs                                  */}
			{/* ------------------------------------------------------------------ */}
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
						Recent Fetch Errors
					</p>
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{errors.length === 0 ? (
							<p className="text-sm text-gray-600">No errors recorded yet</p>
						) : (
							errors.map((entry, i) => (
								<div
									key={`${entry.url}-${i}`}
									className="bg-gray-800 rounded-lg px-3 py-2 text-xs font-mono"
								>
									<p className="text-red-400 truncate">{entry.url}</p>
									<p className="text-gray-400 mt-0.5">{entry.error}</p>
									<div className="flex justify-between mt-0.5">
										<p className="text-gray-600">
											{entry.attempts} attempt{entry.attempts !== 1 ? "s" : ""}
										</p>
										{entry.ts && (
											<p className="text-gray-700">
												{new Date(entry.ts).toLocaleTimeString()}
											</p>
										)}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>

			{/* ------------------------------------------------------------------ */}
			{/* Live Queue Jobs                                                      */}
			{/* ------------------------------------------------------------------ */}
			<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
				<div className="flex justify-between items-end mb-3">
					<p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
						Live Queue Jobs
					</p>
					<span className="text-xs text-gray-600 font-mono">
						Latest 25 jobs
					</span>
				</div>
				<div className="overflow-auto max-h-[400px]">
					<table className="w-full text-left text-sm whitespace-nowrap">
						<thead className="sticky top-0 bg-gray-900 z-10 shadow-[0_1px_0_0_#1f2937]">
							<tr className="text-gray-500">
								<th className="py-2 px-3 font-medium">Job ID</th>
								<th className="py-2 px-3 font-medium">URL</th>
								<th className="py-2 px-3 font-medium">State</th>
								<th className="py-2 px-3 font-medium text-right">Updated</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-800/50 text-gray-300 font-mono">
							{liveJobs.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="py-4 text-center text-gray-600 font-sans"
									>
										No recent jobs available
									</td>
								</tr>
							) : (
								liveJobs.map((job) => (
									<tr
										key={`${job.id}-${job.state}`}
										className="hover:bg-gray-800/50 transition-colors"
									>
										<td className="py-2 px-3 text-gray-500">{job.id}</td>
										<td className="py-2 px-3 max-w-sm truncate text-brand-300">
											{job.url}
										</td>
										<td className="py-2 px-3">
											<span
												className={`px-2 py-0.5 rounded text-xs ${
													job.state === "completed"
														? "bg-emerald-900/40 text-emerald-400"
														: job.state === "failed"
															? "bg-red-900/40 text-red-400"
															: job.state === "active"
																? "bg-brand-900/40 text-brand-400"
																: job.state === "delayed"
																	? "bg-purple-900/40 text-purple-400"
																	: "bg-gray-800 text-gray-400"
												}`}
											>
												{job.state}
											</span>
										</td>
										<td className="py-2 px-3 text-right text-gray-600">
											{new Date(job.timestamp).toLocaleTimeString()}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* ------------------------------------------------------------------ */}
			{/* Queue Management section heading                                     */}
			{/* ------------------------------------------------------------------ */}
			<div className="pt-2">
				<div className="flex items-center gap-3 mb-1">
					<h3 className="text-base font-semibold text-white">
						Queue Management
					</h3>
					<div className="flex-1 h-px bg-gray-800" />
				</div>
				<p className="text-sm text-gray-500">
					Seed new URLs, pause/resume the queue, or flush data stores
				</p>
			</div>

			{/* Seed injector */}
			<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
					Seed Injector
				</p>
				<form onSubmit={handleSeed} className="flex flex-col gap-3">
					<input
						type="url"
						placeholder="https://example.com"
						value={seedUrl}
						onChange={(e) => setSeedUrl(e.target.value)}
						required
						className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
					/>
					<button
						type="submit"
						disabled={seedLoading}
						className="self-start px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
					>
						{seedLoading ? "Queuing…" : "Add to Queue"}
					</button>
					{seedResult && (
						<p
							className={`text-xs ${
								seedResult.success ? "text-emerald-400" : "text-red-400"
							}`}
						>
							{seedResult.success
								? "URL queued successfully"
								: seedResult.message}
						</p>
					)}
				</form>
			</div>

			{/* Kill switch */}
			<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
					Kill Switch
				</p>
				<p className="text-sm text-gray-400 mb-4">
					{queueState === "paused"
						? "The queue is currently paused. Workers will not pick up new jobs."
						: queueState === "stopped"
							? "The queue is currently stopped and emptied. You need to start and re-seed the queue."
							: "Control the queue state. Pause to temporarily halt workers. Stop to pause and empty the entire queue."}
				</p>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() =>
							handleQueueAction(queueState === "running" ? "pause" : "resume")
						}
						disabled={pauseLoading || queueState === "stopped"}
						className={`px-6 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
							queueState === "paused"
								? "bg-emerald-700 hover:bg-emerald-600 text-white"
								: "bg-yellow-700 hover:bg-yellow-600 text-white"
						}`}
					>
						{pauseLoading && queueState !== "stopped"
							? "Working…"
							: queueState === "paused"
								? "Resume Queue"
								: "Pause Queue"}
					</button>

					<button
						type="button"
						onClick={() => handleQueueAction("stop")}
						disabled={pauseLoading || queueState === "stopped"}
						className="px-6 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 bg-red-700 hover:bg-red-600 text-white"
					>
						{pauseLoading && queueState !== "paused" && queueState !== "running"
							? "Working…"
							: "Stop & Empty Queue"}
					</button>
				</div>
				{pauseResult && (
					<p
						className={`text-xs mt-2 ${
							pauseResult.success ? "text-emerald-400" : "text-red-400"
						}`}
					>
						{pauseResult.success
							? `Queue ${pauseResult.status ?? "updated"}`
							: pauseResult.message}
					</p>
				)}
			</div>

			{/* Flush commands */}
			<div className="bg-gray-900 border border-yellow-700/40 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-yellow-600 mb-1">
					Flush Commands — Development Only
				</p>
				<p className="text-sm text-gray-500 mb-4">
					Destructive actions. These cannot be undone.
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						onClick={() => setFlushModal("redis")}
						className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-900/60 hover:bg-orange-800/80 text-orange-300 border border-orange-700/40 transition-colors"
					>
						Clear Redis Queue
					</button>
				</div>
				{flushResult && (
					<p
						className={`text-xs mt-3 ${
							flushResult.success ? "text-emerald-400" : "text-red-400"
						}`}
					>
						{flushResult.message ?? (flushResult.success ? "Done" : "Failed")}
					</p>
				)}
			</div>

			<ConfirmModal
				target={flushModal}
				onConfirm={handleFlush}
				onCancel={() => setFlushModal(null)}
			/>
		</div>
	);
}
