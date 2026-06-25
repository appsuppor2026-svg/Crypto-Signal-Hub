import { Router } from "express";
import healthRouter from "./health.js";
import aiRouter from "./ai.js";
import marketRouter from "./market.js";
import stripeRouter from "./stripe.js";
import pushRouter from "./push.js";

const router: any = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/market", marketRouter);
router.use("/stripe", stripeRouter);
router.use("/push", pushRouter);

export default router;
