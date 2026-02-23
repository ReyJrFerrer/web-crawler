import { useEffect, useState } from "react";
import { useErrorLogs } from "../../providers/useErrorLogs";
import { useQueueJobs } from "../../providers/useQueueJobs";
import { useQueueMetrics } from "../../providers/useQueueMetrics";
import { useWorkerHealth } from "../../providers/useWorkerHealth";
import type { ApiResponse, WorkerInfo } from "../../types";
import { WorkerCard } from "../WorkerCard/WorkerCard";
import { WorkerDetailModal } from "../WorkerDetailModal/WorkerDetailModal";

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

export function GlobalStatus() {
	const { data: queue } = useQueueMetrics();
	const { data: workerHealth } = useWorkerHealth();
	const { data: errors } = useErrorLogs();
	const { data: liveJobs } = useQueueJobs();

	const [selectedWorker, setSelectedWorker] = useState<WorkerInfo | null>(null);
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
				<p className="text-sm text-gray-500">
					Manage workers and monitor crawler performance
				</p>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
				<div className="xl:col-span-8 space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-base font-semibold text-white">Worker Fleet</h3>
						<span className="text-xs text-gray-500">
							{workerHealth.workersOnline} worker(s) online
						</span>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
						{(workerHealth.workers || []).map((worker) => (
							<WorkerCard
								key={worker.id}
								worker={worker}
								onClick={() => setSelectedWorker(worker)}
							/>
						))}
						{(!workerHealth.workers || workerHealth.workers.length === 0) && (
							<div className="col-span-full bg-gray-900 border border-gray-800 border-dashed rounded-xl p-8 text-center">
								<p className="text-gray-500">No workers connected</p>
							</div>
						)}
					</div>

					<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
							Global Queue Breakdown
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

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

						<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
								Recent Fetch Errors
							</p>
							<div className="space-y-2 max-h-48 overflow-y-auto">
								{errors.length === 0 ? (
									<p className="text-sm text-gray-600">
										No errors recorded yet
									</p>
								) : (
									errors.slice(0, 10).map((entry, i) => (
										<div
											key={`${entry.url}-${i}`}
											className="bg-gray-800 rounded-lg px-3 py-2 text-xs font-mono"
										>
											<p className="text-red-400 truncate">{entry.url}</p>
											<p className="text-gray-400 mt-0.5">{entry.error}</p>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				</div>

				<div className="xl:col-span-4 space-y-4">
					<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
						<div className="flex items-center gap-2 mb-4">
							<span className={`w-2 h-2 rounded-full ${statusColor}`} />
							<h3 className="text-base font-semibold text-white">
								Queue Management
							</h3>
						</div>

						<div className="grid grid-cols-2 gap-3 mb-4">
							<div className="bg-gray-800 rounded-lg p-3 text-center">
								<p className={`text-xl font-bold ${statusColor}`}>
									{queue.status === "connected" ? "Running" : "Offline"}
								</p>
								<p className="text-xs text-gray-500">Status</p>
							</div>
							<div className="bg-gray-800 rounded-lg p-3 text-center">
								<p className="text-xl font-bold text-white">
									{totalDiscovered.toLocaleString()}
								</p>
								<p className="text-xs text-gray-500">URLs Total</p>
							</div>
							<div className="bg-gray-800 rounded-lg p-3 text-center">
								<p className="text-xl font-bold text-brand-400">
									{queue.counts.completed.toLocaleString()}
								</p>
								<p className="text-xs text-gray-500">Fetched</p>
							</div>
							<div className="bg-gray-800 rounded-lg p-3 text-center">
								<p
									className={`text-xl font-bold ${
										Number(errorRate) > 5 ? "text-red-400" : "text-emerald-400"
									}`}
								>
									{errorRate}%
								</p>
								<p className="text-xs text-gray-500">Error Rate</p>
							</div>
						</div>

						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
							Seed URL
						</p>
						<form onSubmit={handleSeed} className="space-y-3">
							<input
								type="url"
								placeholder="https://example.com"
								value={seedUrl}
								onChange={(e) => setSeedUrl(e.target.value)}
								required
								className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
							/>
							<button
								type="submit"
								disabled={seedLoading}
								className="w-full px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
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

						<div className="mt-4 pt-4 border-t border-gray-800">
							<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
								Control
							</p>
							<p className="text-xs text-gray-400 mb-3">
								{queueState === "paused"
									? "Queue is paused. Workers will not pick up new jobs."
									: queueState === "stopped"
										? "Queue is stopped and emptied."
										: "Queue is running normally."}
							</p>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() =>
										handleQueueAction(
											queueState === "running" ? "pause" : "resume",
										)
									}
									disabled={pauseLoading}
									className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
										queueState === "paused" || queueState === "stopped"
											? "bg-emerald-700 hover:bg-emerald-600 text-white"
											: "bg-yellow-700 hover:bg-yellow-600 text-white"
									}`}
								>
									{pauseLoading
										? "..."
										: queueState === "paused" || queueState === "stopped"
											? "Resume"
											: "Pause"}
								</button>
								<button
									type="button"
									onClick={() => handleQueueAction("stop")}
									disabled={pauseLoading || queueState === "stopped"}
									className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 bg-red-700 hover:bg-red-600 text-white"
								>
									Stop
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

						<div className="mt-4 pt-4 border-t border-gray-800">
							<button
								type="button"
								onClick={() => setFlushModal("redis")}
								className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-orange-900/60 hover:bg-orange-800/80 text-orange-300 border border-orange-700/40 transition-colors"
							>
								Clear Redis Queue
							</button>
							{flushResult && (
								<p
									className={`text-xs mt-2 ${
										flushResult.success ? "text-emerald-400" : "text-red-400"
									}`}
								>
									{flushResult.message ??
										(flushResult.success ? "Done" : "Failed")}
								</p>
							)}
						</div>
					</div>

					<div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
						<p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
							Live Queue Jobs
						</p>
						<div className="space-y-1 max-h-64 overflow-y-auto">
							{liveJobs.length === 0 ? (
								<p className="text-sm text-gray-600 text-center py-4">
									No recent jobs
								</p>
							) : (
								liveJobs.slice(0, 10).map((job) => (
									<div
										key={`${job.id}-${job.state}`}
										className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800/50 last:border-0"
									>
										<span className="text-gray-400 truncate max-w-[60%]">
											{job.id}
										</span>
										<span
											className={`px-1.5 py-0.5 rounded text-[10px] ${
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
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>

			<ConfirmModal
				target={flushModal}
				onConfirm={handleFlush}
				onCancel={() => setFlushModal(null)}
			/>

			{selectedWorker && (
				<WorkerDetailModal
					worker={selectedWorker}
					metrics={workerHealth.metrics}
					onClose={() => setSelectedWorker(null)}
				/>
			)}
		</div>
	);
}
