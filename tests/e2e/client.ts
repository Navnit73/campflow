import { inject } from "vitest";

/** Minimal HTTP client with a cookie jar (one per simulated user/browser). */
export class Client {
  private cookie = "";
  constructor(private readonly ip = `10.${Math.floor(Math.random() * 250)}.0.1`) {}

  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${inject("baseUrl")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": this.ip,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const m = setCookie.match(/rv_session_token=([^;]*)/);
      if (m) this.cookie = m[1] ? `rv_session_token=${m[1]}` : "";
    }
    const type = res.headers.get("content-type") || "";
    const json = type.includes("application/json") ? await res.json() : null;
    return { status: res.status, json, res };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown, h?: Record<string, string>) => this.req("POST", p, b ?? {}, h);
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  del = (p: string) => this.req("DELETE", p);
}

export const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
};
