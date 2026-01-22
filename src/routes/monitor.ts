// import { ExpressAdapter } from "@bull-board/express";
// import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
// import { createBullBoard } from "@bull-board/api";
// import express from "express";
// import { payoutQueue } from "../queues/payoutQueue";

// const router = express.Router();
// const serverAdapter = new ExpressAdapter();

// createBullBoard({
//   queues: [new BullMQAdapter(payoutQueue)],
//   serverAdapter,
// });

// serverAdapter.setBasePath("/admin/queues");
// router.use("/admin/queues", serverAdapter.getRouter());

// export default router;



import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { createBullBoard } from "@bull-board/api";
import express from "express";
import { payoutQueue } from "../queues/payoutQueue";

const router = express.Router();
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(payoutQueue)],
  serverAdapter,
});

router.use("/admin/queues", serverAdapter.getRouter());

export default router;