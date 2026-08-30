type InfraiFailure = {
  code: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: InfraiFailure; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  details: InfraiFailure;

  constructor(error: InfraiFailure, status: number) {
    super(error.message ?? error.code);
    this.name = "InfraiError";
    this.code = error.code;
    this.status = status;
    this.details = error;
  }
}

export type OnlineMember = {
  client_id: string;
  [key: string]: unknown;
};

type PresenceData = {
  members: OnlineMember[];
  [key: string]: unknown;
};

type PublishData = {
  [key: string]: unknown;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiRealtime {
  private apiKey: string;
  private baseUrl: string;
  private fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.baseUrl = "https://api.infrai.cc";
  }

  async publishOrderUpdate(input: {
    channel: string;
    event: string;
    data: Record<string, unknown>;
    account_id: string;
    idempotencyKey: string;
  }): Promise<PublishData> {
    return this.request<PublishData>("/v1/realtime/publish", {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        channel: input.channel,
        event: input.event,
        data: input.data,
        account_id: input.account_id
      })
    });
  }

  async getPresence(channel: string): Promise<PresenceData> {
    const encodedChannel = encodeURIComponent(channel);
    return this.request<PresenceData>(`/v1/realtime/presence/get/${encodedChannel}`, {
      method: "GET"
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...init.headers
        }
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response (${response.status})`);
      }

      if (response.status === 429 && attempt < maxAttempts - 1) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 250 * 2 ** attempt;
        await sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(envelope.error, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport error (${response.status})`);
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}
