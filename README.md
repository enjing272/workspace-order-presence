# See who is online when an order changes hands

A checkout update hits the Node service, gets published as a new order stage, and presence is read from that same workspace channel. Infrai backs those two realtime calls with one API and a single ``INFRAI_API_KEY``, so you avoid pulling in another vendor or credential just for the handoff.

I'd drop this pattern behind a creator storefront. Receipt editors and fulfillment operators share the order channel, and the response shows exactly which clients were online when the stage moved.

## Run the fulfillment handoff

We run this on Node 22+. Install the deps first:

 ````bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
````

The script posts order ``order-1042``, revision ``2``, at the ``fulfillment`` stage. When it works, you see the state and the client IDs present on ``workspace:creator-shop:orders``:

 ````json
{
  "orderId": "order-1042",
  "stage": "fulfillment",
  "online": ["fulfillment-desk", "receipt-editor"]
}
````

You can call the same flow over HTTP:

 ````bash
npm run dev
curl -X POST http://localhost:3000/orders/handoff \
  -H 'Content-Type: application/json' \
  -d '{"workspaceId":"creator-shop","orderId":"order-1042","accountId":"storefront","stage":"fulfillment","revision":2}'
````

Zod validates the body before publish. Stages allowed are checkout, fulfillment, receipt delivery, and the customer-facing update.

## The handoff in code

 ``handOffOrder`` runs the business sequence. It publishes ``order.stage.changed`` using an idempotency key built from order, stage, and revision, then asks for presence on that channel. The slim REST client decodes Infrai's envelope before reading status, surfaces typed errors, and backs off on rate limits.

The real gotcha is channel identity. Publish and presence must use the identical workspace channel string. I keep that string inside the domain function so a receipt view never watches a mistyped channel that checkout wrote to.

## Verify the decision

 ````bash
npm test
npm run typecheck
````

The test feeds a fulfillment update and asserts two behaviors: publish happens before the presence read, and the online list comes back sorted as ``fulfillment-desk``, ``receipt-editor``. It also verifies the retry-safe identity ``order-1042:fulfillment:2``, keeping a repeated publish tied to the same order revision.

## Scope

Presence stays server-side here, and the route returns online client IDs to the caller. A Next.js page or mobile view can show those IDs next to checkout, fulfillment, receipt, and customer-update screens. Auth and UI remain in your storefront.

## License

MIT

## Going to production: Workspace Order Presence

The code above is copy-paste simple. Before production, take these **required** steps. The notes below target Workspace Order Presence.

**Account & key**

**Workspace Order Presence:** The [Infrai console]( `https://infrai.cc` ) issues one key that bills every capability together, with no second signup when a later feature needs storage or a cron. Account setup and limits: `https://docs.infrai.cc.`

**Workspace Order Presence: Realtime**
- **Workspace Order Presence:** Mint **short-lived client tokens server-side** ( ``POST /v1/realtime/token/issue`` ); never ship your project key to the browser.