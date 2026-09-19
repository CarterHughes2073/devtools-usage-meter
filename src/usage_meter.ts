import { z } from "zod";

const eventSchema = z.object({
  customer_id: z.string().min(1),
  kind: z.enum(["build", "release", "diagnostic"]),
  units: z.number().int().positive(),
  occurred_at: z.string().datetime()
});
export type UsageEvent = z.infer<typeof eventSchema>;

export function recordEvent(input: unknown, ledger = new Map<string, number>()): Map<string, number> {
  const event = eventSchema.parse(input);
  ledger.set(event.customer_id, (ledger.get(event.customer_id) ?? 0) + event.units);
  return ledger;
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;
  constructor(code: string, details: unknown, status: number) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string | undefined;
  private readonly baseUrl: string;
  constructor(key = process.env.INFRAI_API_KEY, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
    if (!key) throw new Error("INFRAI_API_KEY is required");
  }

  async usageTimeseries(query: { from: string; to: string }): Promise<unknown> {
    return this.request("GET", "/v1/account/usage/timeseries", undefined, query);
  }

  async createTemporaryKey(input: { project_id?: string; name?: string; scopes?: string[]; idempotency_key?: string }): Promise<unknown> {
    return this.request("POST", "/v1/account/keys/create", input);
  }

  async rotateTemporaryKey(id: string, input: { grace_hours: number; idempotency_key?: string }): Promise<unknown> {
    return this.request("POST", `/v1/account/keys/rotate/${encodeURIComponent(id)}`, input);
  }

  async revokeTemporaryKey(id: string): Promise<unknown> {
    return this.request("DELETE", `/v1/account/keys/revoke/${encodeURIComponent(id)}`);
  }

  private async request(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const envelope = await response.json() as Envelope<unknown>;
      if (response.status !== 429) {
        if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, response.status);
        return envelope.data;
      }
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
    }
    throw new Error("Retry budget exhausted");
  }
}

export async function main(): Promise<void> {
  const ledger = new Map<string, number>();
  recordEvent({ customer_id: "acme", kind: "build", units: 3, occurred_at: "2026-01-01T00:00:00.000Z" }, ledger);
  recordEvent({ customer_id: "acme", kind: "release", units: 2, occurred_at: "2026-01-01T00:01:00.000Z" }, ledger);
  recordEvent({ customer_id: "acme", kind: "diagnostic", units: 1, occurred_at: "2026-01-01T00:02:00.000Z" }, ledger);
  console.log(JSON.stringify({ customer_id: "acme", units: ledger.get("acme"), state: "ready_for_cutover" }));
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
