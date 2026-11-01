/** Small helpers for JSON responses and request bodies. */

export interface Env {
  readonly DB: D1Database;
  /** Sites allowed to call the API, separated by commas. */
  readonly ALLOWED_ORIGINS?: string;
  /** The moderator's token, for /admin. Without one, /admin is switched off. */
  readonly ADMIN_TOKEN?: string;
  /** Mixed into every hash of a key or IP address, so the hashes cannot be looked up. */
  readonly HASH_SALT?: string;
}

/** An error the caller can act on, with the HTTP status to send. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

/** Request bodies are small: programs are limited to a few kilobytes. */
export const MAX_BODY = 64 * 1024;

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ApiError(413, "That is too large to send.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "The request is not valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "The request must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

/** A required string field, trimmed, with a length limit. */
export function text(
  body: Record<string, unknown>,
  field: string,
  { min = 1, max, label = field }: { min?: number; max: number; label?: string },
): string {
  const value = body[field];
  if (typeof value !== "string") throw new ApiError(400, `${label} is missing.`);
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ApiError(400, min === 1 ? `${label} is empty.` : `${label} is too short.`);
  }
  if (trimmed.length > max) {
    throw new ApiError(400, `${label} is too long (at most ${max} characters).`);
  }
  return trimmed;
}

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, x-player-key, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
