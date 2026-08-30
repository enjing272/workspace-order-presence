import { InfraiRealtime } from "../src/infrai_realtime.js";
import { handOffOrder } from "../src/order_handoff.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the handoff");

const result = await handOffOrder(new InfraiRealtime(apiKey), {
  workspaceId: process.env.WORKSPACE_ID ?? "clinic-east",
  orderId: "order-1042",
  accountId: "storefront",
  stage: "fulfillment",
  revision: 2
});

console.log(JSON.stringify(result, null, 2));
