import { useState } from "react";
import type { ApiResponse } from "../../types";

type ModalTarget = "redis" | "mongo" | null;

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
	const label = target === "redis" ? "Redis queue" : "MongoDB collection";
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
				<h3 className="text-base font-semibold text-white mb-2">
					Confirm Flush
				</h3>
				<p className="text-sm text-gray-400 mb-6">
					This will permanently clear the{" "}
					<span className="text-red-400 font-semibold">{label}</span>. This
					action cannot be undone.
				</p>
				<div className="flex gap-3 justify-end">
					<button
						onClick={onCancel}
						className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
					>
						Cancel
					</button>
					<button
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

export function ControlPanel() {
	const [seedUrl, setSeedUrl] = useState("");
	const [seedLoading, setSeedLoading] = useState(false);
	const [seedResult, setSeedResult] = useState<ApiResponse | null>(null);

	const [pauseLoading, setPauseLoading] = useState(false);
	const [pauseResult, setPauseResult] = useState<ApiResponse | null>(null);
	const [isPaused, setIsPaused] = useState(false);

	const [flushModal, setFlushModal] = useState<ModalTarget>(null);
	const [flushResult, setFlushResult] = useState<ApiResponse | null>(null);

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

	async function handleTogglePause() {
		setPauseLoading(true);
		setPauseResult(null);
		const endpoint = isPaused ? "/api/queue/resume" : "/api/queue/pause";
		try {
			const res = await fetch(endpoint, { method: "POST" });
			const json = (await res.json()) as ApiResponse;
			setPauseResult(json);
			if (json.success) setIsPaused(!isPaused);
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
		setFlushModal(null);
		setFlushResult(null);
		try {
			const res = await fetch("/api/queue/flush", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ target: flushModal }),
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

	return (
		<div className="space-y-6 max-w-2xl">
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">
					Control Panel &amp; Admin
				</h2>
				<p className="text-sm text-gray-500">
					Manage the crawler queue and seed new URLs
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
					{isPaused
						? "The queue is currently paused. Workers will not pick up new jobs."
						: "Pause the BullMQ queue globally. Active jobs will finish; no new ones start."}
				</p>
				<button
					onClick={handleTogglePause}
					disabled={pauseLoading}
					className={`px-6 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
						isPaused
							? "bg-emerald-700 hover:bg-emerald-600 text-white"
							: "bg-red-700 hover:bg-red-600 text-white"
					}`}
				>
					{pauseLoading
						? "Working…"
						: isPaused
							? "Resume Queue"
							: "Pause Queue"}
				</button>
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

			{/* Flush commands (dev-only) */}
			<div className="bg-gray-900 border border-yellow-700/40 rounded-xl p-5">
				<p className="text-xs font-semibold uppercase tracking-widest text-yellow-600 mb-1">
					Flush Commands — Development Only
				</p>
				<p className="text-sm text-gray-500 mb-4">
					Destructive actions. These cannot be undone.
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						onClick={() => setFlushModal("redis")}
						className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-900/60 hover:bg-orange-800/80 text-orange-300 border border-orange-700/40 transition-colors"
					>
						Clear Redis Queue
					</button>
					<button
						onClick={() => setFlushModal("mongo")}
						className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-900/60 hover:bg-orange-800/80 text-orange-300 border border-orange-700/40 transition-colors"
					>
						Drop MongoDB Collection
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
