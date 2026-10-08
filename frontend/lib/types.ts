// Mirrors the frozen HTTP contract in docs/AIRLOCK_CONTEXT.md §6.4.

export type OverallRisk = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type EntityRisk = "LOW" | "MEDIUM" | "HIGH";
export type EntitySource = "rule" | "gemma";

export interface Health {
  ok: boolean;
  gemma_loaded: boolean;
  model_alias: string;
  cloud_configured: boolean;
}

export interface Entity {
  type: string;
  text: string;
  replacement: string;
  risk: EntityRisk;
  source: EntitySource;
  redacted: boolean;
  count: number;
  reason?: string;
}

export interface ScanResponse {
  scan_id: string;
  risk: OverallRisk;
  entities: Entity[];
  sanitized_text: string;
  gemma_used: boolean;
  timings_ms: { rules?: number; gemma?: number; total?: number };
}

export interface AskRequest {
  scan_id: string;
  question?: string;
}

export interface AskResponse {
  scan_id: string;
  cloud_model: string;
  cloud_saw: string;
  cloud_response_raw: string;
  response: string;
  timings_ms: { cloud?: number };
}

export interface AirlockApi {
  health(): Promise<Health>;
  scan(text: string): Promise<ScanResponse>;
  ask(req: AskRequest): Promise<AskResponse>;
}
