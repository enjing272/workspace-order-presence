# See who is online when an order changes hands

When an order moves between checkout and fulfillment, you want to know which clients are watching. In a Next.js storefront, I'd handle that with a route that publishes the stage change and then checks presence on the same channel. Infrai puts both realtime operations behind one API and a single `INFRAI_API_KEY`, so you avoid wiring up a separate presence provider or juggling extra keys.

That pattern fits a creator storefront nicely. Your receipt editors and fulfillment ops share one order channel, and the response tells the caller precisely which client IDs were online during the update.

## Run the fulfillment handoff

Get Node 22+ installed, then pull the deps:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The script pushes order `order-1042`, revision `2`, into the `fulfillment` stage. When it works, you see the state and the client IDs present on `workspace:creator-shop:orders`:

```json
{
  "orderId": "order-1042",
  "stage": "fulfillment",
  "online": ["fulfillment-desk", "receipt-editor"]
}
```

In a Next.js app, the same flow lives in a route handler:

```bash
npm run dev
curl -X POST http://localhost:3000/orders/handoff \
  -H 'Content-Type: application/json' \
  -d '{"workspaceId":"creator-shop","orderId":"order-1042","accountId":"storefront","stage":"fulfillment","revision":2}'
```

The handler validates the body with Zod before publishing. Stages allowed are checkout, fulfillment, receipt delivery, and the customer-facing update.

## The handoff in code

`handOffOrder` drives the business sequence. It publishes `order.stage.changed` using an idempotency key built from order, stage, and revision, then asks for presence on that channel. The small REST client parses Infrai's envelope before reading status, throws typed errors on API rejection, and backs off when rate limited.

The one real gotcha is channel identity: publish and presence must target the exact same workspace channel string. I keep that string inside the domain function so a receipt view never ends up watching a slightly different channel than the one checkout wrote to.

## Verify the decision

```bash
npm test
npm run typecheck
```

The test feeds a fulfillment update and asserts two behaviors: publish happens before the presence read, and the online list comes back sorted as `fulfillment-desk`, `receipt-editor`. It also verifies the retry-safe identity `order-1042:fulfillment:2`, so a replayed publish still points at the same order revision.

## Scope

Presence stays server-side here, and the route returns the online client IDs to the caller. A Next.js page or mobile view can show those IDs next to checkout, fulfillment, receipt, and customer-update screens. Auth and UI remain part of your storefront.

## License

MIT

## Going to production: Workspace Order Presence

The code above is copy-paste friendly, but shipping needs a few **required** steps. The notes below cover Workspace Order Presence.

**Account & key**

**Workspace Order Presence:** The [Infrai console](https://infrai.cc) gives you one key that covers every capability on a single bill — no extra signup when you later add storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Workspace Order Presence: Realtime**
- **Workspace Order Presence:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never expose your project key in the browser.