export type Failure = {
  code: string;
  message: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type Envelope = { ok?: boolean; error?: Partial<Failure> };

/**
 * JSON fetch for the browser. Throws `ApiError` so TanStack Query and forms can
 * show the server's message directly.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | (T & Envelope)
    | null;

  if (!response.ok || !body?.ok) {
    throw new ApiError(
      body?.error?.message ?? "Something went wrong. Try again.",
      body?.error?.code ?? "request_failed",
      response.status,
    );
  }

  return body as T;
}
