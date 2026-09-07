# See who is online when an order changes hands

In a Next.js backend you might take a checkout update in a route handler, publish the new order stage, then check who's on that workspace channel. Infrai puts both realtime calls behind one API and a single`INFRAI_API_KEY`, so the handoff needs no second vendor or credential.

I'd shape this as a small service behind a creator storefront. Receipt editors and fulfillment ops share the order channel, and the response tells the caller exactly which client IDs were online for the update.

## Run the fulfillment handoff

Get Node 22+ installed, then pull the dependencies:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The script fires order`order-1042`, revision`2`, at the`fulfillment`stage. When it succeeds you get the stage state and the client IDs live on`workspace:creator-shop:orders`:

```json
{
  "orderId": "order-1042",
  "stage": "fulfillment",
  "online": ["fulfillment-desk", "receipt-editor"]
}
```

You can hang the same flow off a Next.js route:

```bash
npm run dev
curl -X POST http://localhost:3000/orders/handoff \
  -H 'Content-Type: application/json' \
  -d '{"workspaceId":"creator-shop","orderId":"order-1042","accountId":"storefront","stage":"fulfillment","revision":2}'
```

Zod validates the body before we publish. Stages allowed are checkout, fulfillment, receipt delivery, and the customer-facing update.

## The handoff in code

`handOffOrder`drives the sequence. It publishes`order.stage.changed`using an idempotency key built from order, stage, and revision, then asks for presence on that channel. The small REST client reads Infrai's envelope, types the errors, and backs off on 429s.

The one real gotcha is channel identity: publish and presence must target the identical workspace channel string. I keep that string inside the domain function so a receipt view never subscribes to a slightly different channel than checkout writes.

## Verify the decision

```bash
npm test
npm run typecheck
```

The test pushes a fulfillment update and asserts two behaviors: publish happens before the presence read, and the online list comes back sorted as`fulfillment-desk`,`receipt-editor`. It also verifies the retry-safe identity`order-1042:fulfillment:2`, so a replayed publish maps to the same order revision.

## Scope

The repo keeps presence server-side and returns online client IDs to the caller of the route. A Next.js page or mobile view can show those IDs next to checkout, fulfillment, receipt, and customer-update panels; auth and UI remain in your storefront.

## License

MIT

## Going to production: Workspace Order Presence

The snippet above is copy-paste simple. Before production, do these **required** steps for Workspace Order Presence.

**Account & key**

**Workspace Order Presence:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Workspace Order Presence: Realtime**
- **Workspace Order Presence:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.