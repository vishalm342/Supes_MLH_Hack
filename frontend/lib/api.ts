import { mockApi } from "./mock";
import type { AirlockApi, AskRequest, AskResponse, Health, ScanResponse } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const MOCK_BY_DEFAULT = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// Gemma can take several seconds per scan; the cloud call can be slow too.
const REQUEST_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function describeStatus(status: number, detail: string): string {
  switch (status) {
    case 404:
      return "The backend doesn't know this scan anymore (it may have restarted). Scan the text again.";
    case 502:
      return `The cloud model returned an error${detail ? `: ${detail}` : "."}`;
    case 503:
      return `The backend isn't ready${detail ? `: ${detail}` : "."}`;
    default:
      return `Backend error ${status}${detail ? `: ${detail}` : ""}`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError(`The backend took longer than ${REQUEST_TIMEOUT_MS / 1000}s to answer.`, null);
    }
    throw new ApiError(`Can't reach the Airlock backend at ${API_URL}. Is it running?`, null);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail ?? body);
    } catch {
      // Non-JSON error body; the status code alone will have to do.
    }
    throw new ApiError(describeStatus(res.status, detail), res.status);
  }
  return (await res.json()) as T;
}

const httpApi: AirlockApi = {
  health: () => request<Health>("/health"),
  scan: (text) => request<ScanResponse>("/scan", { method: "POST", body: JSON.stringify({ text }) }),
  ask: (req: AskRequest) => request<AskResponse>("/ask", { method: "POST", body: JSON.stringify(req) }),
};

export function getApi(useMock: boolean): AirlockApi {
  return useMock ? mockApi : httpApi;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
