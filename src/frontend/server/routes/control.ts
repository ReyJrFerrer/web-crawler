import { Router } from "express";
import { config } from "../../../config";
import { Frontier } from "../../../services/frontier";

const router = Router();

// Lazy singletons — only connect when a control action is first triggered
let frontier: Frontier | null = null;

function getFrontier(): Frontier {
	if (!frontier) {
		frontier = new Frontier();
	}
	return frontier;
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
		await getFrontier().pause(false);
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
		await getFrontier().resume(false);
		res.json({ success: true, status: "running" });
	} catch (err) {
		console.error("[control] resume error:", err);
		res.status(503).json({
			success: false,
			message: "Could not resume queue — Redis may be offline",
		});
	}
});

// POST /api/queue/stop
router.post("/stop", async (_req, res) => {
	try {
		await getFrontier().stop();
		res.json({ success: true, status: "stopped" });
	} catch (err) {
		console.error("[control] stop error:", err);
		res.status(503).json({
			success: false,
			message: "Could not stop queue — Redis may be offline",
		});
	}
});

// POST /api/queue/flush  { target: "redis" }  (dev-only)
// Runs `redis.flushall()` to wipe all Redis data.
router.post("/flush", async (req, res) => {
	const body = req.body as { target?: string };
	const target = body.target;

	if (target !== "redis") {
		res.status(400).json({ success: false, message: "Unknown flush target" });
		return;
	}

	try {
		const Redis = (await import("ioredis")).default;
		const redis = new Redis(config.redisUrl);
		await redis.flushall();
		redis.disconnect();
		res.json({ success: true, message: "Redis flushed successfully" });
	} catch (redisErr) {
		console.error("[control] flush fallback error:", redisErr);
		res.status(503).json({ success: false, message: "Flush failed" });
	}
});

export default router;
