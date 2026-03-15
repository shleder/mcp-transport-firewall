export interface HealthResponse {
  status: "ok" | "error";
  uptime: number;
  timestamp: string;
}

export interface BaseApiResponse {
  status: "ok" | "error";
  message?: string;
  error?: string;
  code?: string;
}
