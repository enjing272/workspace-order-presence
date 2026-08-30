import { z } from "zod";
import type { OnlineMember } from "./infrai_realtime.js";

export const orderUpdateSchema = z.object({
  workspaceId: z.string().min(1),
  orderId: z.string().min(1),
  accountId: z.string().min(1),
  stage: z.enum(["checkout", "fulfillment", "receipt_sent", "customer_updated"]),
  revision: z.number().int().positive()
});

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export interface RealtimePort {
  publishOrderUpdate(input: {
    channel: string;
    event: string;
    data: Record<string, unknown>;
    account_id: string;
    idempotencyKey: string;
  }): Promise<Record<string, unknown>>;
  getPresence(channel: string): Promise<{ members: OnlineMember[] }>;
}

export async function handOffOrder(
  realtime: RealtimePort,
  update: OrderUpdate
): Promise<{ orderId: string; stage: OrderUpdate["stage"]; online: string[] }> {
  const channel = `workspace:${update.workspaceId}:orders`;
  await realtime.publishOrderUpdate({
    channel,
    event: "order.stage.changed",
    data: {
      orderId: update.orderId,
      stage: update.stage,
      revision: update.revision
    },
    account_id: update.accountId,
    idempotencyKey: `${update.orderId}:${update.stage}:${update.revision}`
  });

  const presence = await realtime.getPresence(channel);
  return {
    orderId: update.orderId,
    stage: update.stage,
    online: presence.members.map((member) => member.client_id).sort()
  };
}
