import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import marketRouter from "./market";
import stripeRouter from "./stripe";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/market", marketRouter);
router.use("/stripe", stripeRouter);
router.use("/push", pushRouter);

export default router;
