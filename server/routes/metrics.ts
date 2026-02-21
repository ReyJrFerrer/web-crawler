import { Router } from "express";
import { getQueueMetrics } from "../providers/queueMetrics";
import { getWorkerHealth } from "../providers/workerHealth";

const router = Router();

router.get("/queue", async (_req, res) => {
	const data = await getQueueMetrics();
	res.json(data);
});

router.get("/system", (_req, res) => {
	const data = getWorkerHealth();
	res.json(data);
});

export default router;
