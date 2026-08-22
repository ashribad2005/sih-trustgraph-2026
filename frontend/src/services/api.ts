import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { Case, CaseDossier, DashboardMetrics } from '../types/case';
import type { GraphData } from '../types/graph';
import type { Transaction } from '../types/transaction';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = configuredApiBaseUrl || (
  import.meta.env.DEV
    ? 'http://localhost:8000/api/v1'
    : 'https://trustgraph-api.onrender.com/api/v1'
);

// ─── Token Storage ────────────────────────────────────────────────────────────
export const tokenStorage = {
  get: (): string | null => localStorage.getItem('access_token'),
  getRefresh: (): string | null => localStorage.getItem('refresh_token'),
  set: (access: string, refresh?: string) => {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },
  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

// ─── Axios Client ─────────────────────────────────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.get();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStorage.clear();
      window.dispatchEvent(new Event('tg:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ─── Core API Service ─────────────────────────────────────────────────────────
export const apiService = {
  // Cases API
  async getCases(): Promise<Case[]> {
    const response = await apiClient.get<Case[] | { results: Case[] }>('/cases/');
    const payload = response.data;
    return Array.isArray(payload) ? payload : payload.results;
  },

  async getCaseById(caseId: string | number): Promise<CaseDossier> {
    const response = await apiClient.get<CaseDossier>(`/cases/${caseId}/`);
    return response.data;
  },

  // Graph Data API
  async getCaseGraph(caseId: string | number): Promise<GraphData> {
    const response = await apiClient.get<GraphData>(`/cases/${caseId}/graph/`);
    return response.data;
  },

  // Ingestion API
  async ingestTransaction(payload: Partial<Transaction>): Promise<unknown> {
    const response = await apiClient.post('/transactions/ingest/', payload);
    return response.data;
  },

  // Blockchain Verification API
  async actionCase(caseId: string | number, action: 'DISMISS' | 'CONFIRM_FRAUD' | 'HOLD'): Promise<CaseDossier> {
    const response = await apiClient.post<CaseDossier>(`/cases/${caseId}/action/`, { action });
    return response.data;
  },

  async verifyAuditHash(caseId: string | number): Promise<{
    is_tampered: boolean;
    verdict: string;
    on_chain_hash: string | null;
    local_hash: string;
    hashes_match: boolean;
    verification_available: boolean;
  }> {
    const response = await apiClient.get(`/cases/${caseId}/verify-integrity/`);
    return response.data;
  },
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  async login(credentials: { username: string; password: string }): Promise<{ user?: { username: string; role: string } }> {
    const response = await apiClient.post<{ access: string; refresh: string }>('/auth/token/', credentials);
    tokenStorage.set(response.data.access, response.data.refresh);
    return { user: { username: credentials.username, role: 'Investigator SOC-L2' } };
  },

  async logout(): Promise<void> {
    tokenStorage.clear();
  },
};

// ─── Dashboard API ────────────────────────────────────────────────────────────
export const dashboardApi = {
  async getMetrics(): Promise<DashboardMetrics> {
    const response = await apiClient.get<DashboardMetrics>('/dashboard/metrics/');
    return response.data;
  },
};

// ─── Cases API (for Dashboard) ────────────────────────────────────────────────
export const casesApi = {
  async getCaseDetails(caseId: string): Promise<Case> {
    const response = await apiClient.get<Case>(`/cases/${caseId}/`);
    return response.data;
  },
};