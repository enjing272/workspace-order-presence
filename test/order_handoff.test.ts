import assert from "node:assert/strict";
import test from "node:test";
import { handOffOrder, type RealtimePort } from "../src/order_handoff.js";

test("publishes fulfillment before reporting the online order crew", async () => {
  const calls: string[] = [];
  const realtime: RealtimePort = {
    async publishOrderUpdate(input) {
      calls.push(`publish:${input.channel}:${String(input.data.stage)}`);
      assert.equal(input.idempotencyKey, "order-1042:fulfillment:2");
      return {};
    },
    async getPresence(channel) {
      calls.push(`presence:${channel}`);
      return { members: [{ client_id: "receipt-editor" }, { client_id: "fulfillment-desk" }] };
    }
  };

  const result = await handOffOrder(realtime, {
    workspaceId: "creator-shop",
    orderId: "order-1042",
    accountId: "storefront",
    stage: "fulfillment",
    revision: 2
  });

  assert.deepEqual(calls, [
    "publish:workspace:creator-shop:orders:fulfillment",
    "presence:workspace:creator-shop:orders"
  ]);
  assert.deepEqual(result, {
    orderId: "order-1042",
    stage: "fulfillment",
    online: ["fulfillment-desk", "receipt-editor"]
  });
});
