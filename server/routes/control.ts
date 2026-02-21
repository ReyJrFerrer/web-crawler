import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Queue from "bull";
import { Router } from "express";
import { config } from "../../src/config";
import { Frontier } from "../../src/services/frontier";

const execFileAsync = promisify(execFile);

const router = Router();

// Lazy singletons — only connect when a control action is first triggered
let frontier: Frontier | null = null;
let pauseQueue: Queue.Queue | null = null;

function getFrontier(): Frontier {
	if (!frontier) {
		frontier = new Frontier();
	}
	return frontier;
}

function getPauseQueue(): Queue.Queue {
	if (!pauseQueue) {
		pauseQueue = new Queue("crawler-frontier", config.redisUrl);
	}
	return pauseQueue;
}

// POST /api/queue/seed  { url: string }
router.post("/seed", async (req, res) => {
	const body = req.body as { url?: string };
	const url = body.url?.trim();

	if (!url) {
		res.status(400).json({ success: false, message: "url is required" });
		return;
	}

	try {
		new URL(url); // validate
	} catch {
		res.status(400).json({ success: false, message: "Invalid URL format" });
		return;
	}

	try {
		await getFrontier().addUrl(url, 0);
		res.json({ success: true, message: "URL queued" });
	} catch (err) {
		console.error("[control] seed error:", err);
		res.status(503).json({
			success: false,
			message: "Queue unavailable — Redis may be offline",
		});
	}
});

// POST /api/queue/pause
router.post("/pause", async (_req, res) => {
	try {
		// Pass true to pause immediately (isLocal=true) rather than waiting for
		// in-flight jobs to drain. This sets the Redis pause key instantly so the
		// crawler's worker loop stops picking up new jobs on its next tick.
		await getPauseQueue().pause(true);
		res.json({ success: true, status: "paused" });
	} catch (err) {
		console.error("[control] pause error:", err);
		res.status(503).json({
			success: false,
			message: "Could not pause queue — Redis may be offline",
		});
	}
});

// POST /api/queue/resume
router.post("/resume", async (_req, res) => {
	try {
		await getPauseQueue().resume();
		res.json({ success: true, status: "running" });
	} catch (err) {
		console.error("[control] resume error:", err);
		res.status(503).json({
			success: false,
			message: "Could not resume queue — Redis may be offline",
		});
	}
});

// POST /api/queue/flush  { target: "redis" }  (dev-only)
// Runs `docker exec <container> redis-cli flushall` to wipe all Redis data,
// then falls back to Bull's queue.empty() if Docker is unavailable.
router.post("/flush", async (req, res) => {
	const body = req.body as { target?: string };
	const target = body.target;

	if (target !== "redis") {
		res.status(400).json({ success: false, message: "Unknown flush target" });
		return;
	}

	// Container name: override via REDIS_CONTAINER env var, otherwise derive
	// from the docker-compose default (project folder = "web-crawler", service = "redis").
	const container = process.env.REDIS_CONTAINER ?? "web-crawler-redis-1";

	try {
		const { stdout } = await execFileAsync("docker", [
			"exec",
			container,
			"redis-cli",
			"flushall",
		]);
		console.log(`[control] redis flushall via docker: ${stdout.trim()}`);
		res.json({ success: true, message: "Redis flushed (docker flushall)" });
	} catch (dockerErr) {
		// Docker unavailable or container not running — fall back to Bull queue.empty()
		console.warn(
			"[control] docker exec failed, falling back to queue.empty():",
			(dockerErr as Error).message,
		);
		try {
			await getPauseQueue().empty();
			res.json({
				success: true,
				message: "Redis queue emptied (Bull fallback — docker unavailable)",
			});
		} catch (bullErr) {
			console.error("[control] flush fallback error:", bullErr);
			res.status(503).json({ success: false, message: "Flush failed" });
		}
	}
});

export default router;
