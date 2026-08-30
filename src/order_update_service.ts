import { createServer } from "node:http";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { handOffOrder, orderUpdateSchema } from "./order_handoff.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const realtime = new InfraiRealtime(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/orders/handoff") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = orderUpdateSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid order update", issues: parsed.error.issues }));
      return;
    }
    const result = await handOffOrder(realtime, parsed.data);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.code, details: error.details }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "Unable to process order update" }));
  }
}).listen(port, () => console.log(`Order update service listening on http://localhost:${port}`));
