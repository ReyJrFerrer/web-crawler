import Queue from "bull";
import { Router } from "express";
import { config } from "../../src/config";
import { Frontier } from "../../src/services/frontier";

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
		await getPauseQueue().pause();
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

// POST /api/queue/flush  { target: "redis" | "mongo" }  (dev-only)
router.post("/flush", async (req, res) => {
	const body = req.body as { target?: string };
	const target = body.target;

	try {
		if (target === "redis") {
			await getPauseQueue().empty();
			res.json({ success: true, message: "Redis queue emptied" });
		} else {
			res.status(400).json({ success: false, message: "Unknown flush target" });
		}
	} catch (err) {
		console.error("[control] flush error:", err);
		res.status(503).json({ success: false, message: "Flush failed" });
	}
});

export default router;
