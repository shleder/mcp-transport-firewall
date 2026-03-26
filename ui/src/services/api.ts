import type {
  ProxyStats,
  AdminHealth,
  AdminRoute,
  CacheStats,
  CircuitBreakerStats,
  AdminSIEMConfig,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:9090' : '');

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  async getHealth(): Promise<AdminHealth> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  },

  async getStats(): Promise<ProxyStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getRoutes(): Promise<{ routes: AdminRoute[]; total: number }> {
    const res = await fetch(`${API_BASE}/routes`);
    if (!res.ok) throw new Error('Failed to fetch routes');
    return res.json();
  },

  async registerRoute(data: Omit<AdminRoute, 'name'> & { toolName: string }): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to register route');
    return res.json();
  },

  async removeRoute(toolName: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/routes/${encodeURIComponent(toolName)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove route');
    return res.json();
  },

  async getCacheStats(): Promise<{ cache: CacheStats | null; message?: string }> {
    const res = await fetch(`${API_BASE}/cache/stats`);
    if (!res.ok) throw new Error('Failed to fetch cache stats');
    return res.json();
  },

  async clearCache(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/cache`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear cache');
    return res.json();
  },

  async getCircuitBreakers(): Promise<{ circuitBreakers: CircuitBreakerStats[] }> {
    const res = await fetch(`${API_BASE}/circuit-breakers`);
    if (!res.ok) throw new Error('Failed to fetch circuit breakers');
    return res.json();
  },

  async getPreflightStats(): Promise<{ preflight: { pending: number; consumed: number } }> {
    const res = await fetch(`${API_BASE}/preflight/stats`);
    if (!res.ok) throw new Error('Failed to fetch preflight stats');
    return res.json();
  },

  async getRateLimitStats(): Promise<{ rateLimit: { global: { entries: number }; tenants: unknown[] } }> {
    const res = await fetch(`${API_BASE}/rate-limit/stats`);
    if (!res.ok) throw new Error('Failed to fetch rate limit stats');
    return res.json();
  },

  async getSIEMConfig(): Promise<AdminSIEMConfig> {
    const res = await fetch(`${API_BASE}/siem/config`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch SIEM config');
    return res.json();
  },

  async updateSIEMConfig(config: AdminSIEMConfig): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/siem/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update SIEM config');
    return res.json();
  },

  setToken(token: string): void {
    localStorage.setItem('admin_token', token);
  },

  clearToken(): void {
    localStorage.removeItem('admin_token');
  },

  hasToken(): boolean {
    return !!localStorage.getItem('admin_token');
  },
};
