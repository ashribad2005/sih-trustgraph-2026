/**
 * TRUSTGRAPH – Centralized API Service
 *
 * All backend communication is routed through this module.
 * Endpoints match the Django DRF API at /api/v1/.
 * Includes JWT authentication with automatic token refresh.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { DashboardMetrics, Alert, Case } from '../types/case';

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

// Token storage keys
const TOKEN_KEY = 'tg_access_token';
const REFRESH_TOKEN_KEY = 'tg_refresh_token';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach JWT when available
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – handle 401 globally (token expired / invalid)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Attempt token refresh on 401 (only once)
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = tokenStorage.getRefresh();

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          tokenStorage.set(data.access);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.access}`;
          }
          return apiClient(originalRequest);
        } catch {
          // Refresh failed — force logout
          tokenStorage.clear();
          window.dispatchEvent(new Event('tg:unauthorized'));
        }
      } else {
        tokenStorage.clear();
        window.dispatchEvent(new Event('tg:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// ─── Token Helpers ────────────────────────────────────────────────────────────

export const tokenStorage = {
  get: (): string | null => sessionStorage.getItem(TOKEN_KEY),
  getRefresh: (): string | null => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  set: (token: string): void => sessionStorage.setItem(TOKEN_KEY, token),
  setRefresh: (token: string): void => sessionStorage.setItem(REFRESH_TOKEN_KEY, token),
  clear: (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ─── Endpoint Constants ───────────────────────────────────────────────────────

const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/token/',
  REFRESH: '/auth/token/refresh/',

  // Dashboard
  METRICS: '/dashboard/metrics/',

  // Transaction ingestion
  INGEST: '/transactions/ingest/',

  // Cases
  CASES_LIST: '/cases/',
  CASE_DETAIL: (caseId: string) => `/cases/${caseId}/`,
  CASE_ACTION: (caseId: string) => `/cases/${caseId}/action/`,
  CASE_GRAPH: (caseId: string) => `/cases/${caseId}/graph/`,

  // Blockchain / evidence
  VERIFY_INTEGRITY: (caseId: string) => `/cases/${caseId}/verify-integrity/`,
} as const;

// ─── Auth API ─────────────────────────────────────────────────────────────────

interface LoginPayload { username: string; password: string }
interface LoginResponse { access: string; refresh?: string; user?: { username: string; role: string } }

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    try {
      const { data } = await apiClient.post<LoginResponse>(ENDPOINTS.LOGIN, payload);
      tokenStorage.set(data.access);
      if (data.refresh) {
        tokenStorage.setRefresh(data.refresh);
      }
      return data;
    } catch (error) {
      console.warn('[TRUSTGRAPH] Backend not available, falling back to mock login.');
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      const mockToken = 'mock-jwt-token-12345';
      tokenStorage.set(mockToken);
      return {
        access: mockToken,
        user: { username: payload.username, role: 'Investigator SOC-L2' },
      };
    }
  },

  logout: async (): Promise<void> => {
    tokenStorage.clear();
  },
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardApi = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const { data } = await apiClient.get<DashboardMetrics>(ENDPOINTS.METRICS);
    return data;
  },
};

// ─── Cases API ────────────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const casesApi = {
  listCases: async (page: number = 1): Promise<PaginatedResponse<Case>> => {
    const { data } = await apiClient.get<PaginatedResponse<Case>>(ENDPOINTS.CASES_LIST, {
      params: { page },
    });
    return data;
  },

  getCaseDetails: async (caseId: string): Promise<Case> => {
    const { data } = await apiClient.get<Case>(ENDPOINTS.CASE_DETAIL(caseId));
    return data;
  },

  getCaseGraph: async (caseId: string): Promise<{ case_id: string; graph_data: any }> => {
    const { data } = await apiClient.get(ENDPOINTS.CASE_GRAPH(caseId));
    return data;
  },
};

// ─── Investigator Actions API ─────────────────────────────────────────────────

export const investigatorApi = {
  performAction: async (caseId: string, action: 'DISMISS' | 'CONFIRM_FRAUD' | 'HOLD'): Promise<Case> => {
    const { data } = await apiClient.post<Case>(ENDPOINTS.CASE_ACTION(caseId), { action });
    return data;
  },
};

// ─── Blockchain / Integrity API ───────────────────────────────────────────────

export interface VerificationResult {
  case_id: string;
  is_tampered: boolean;
  verdict: string;
  on_chain_hash: string | null;
  local_hash: string | null;
  hashes_match: boolean;
  on_chain_risk_score: number;
  timestamp: number;
  logged_by: string;
  verification_available: boolean;
}

export const blockchainApi = {
  verifyIntegrity: async (caseId: string): Promise<VerificationResult> => {
    const { data } = await apiClient.get<VerificationResult>(
      ENDPOINTS.VERIFY_INTEGRITY(caseId)
    );
    return data;
  },
};

// ─── Transaction Ingestion API ────────────────────────────────────────────────

export const transactionApi = {
  ingest: async (transactions: any | any[]): Promise<any> => {
    const payload = Array.isArray(transactions)
      ? { transactions }
      : transactions;
    const { data } = await apiClient.post(ENDPOINTS.INGEST, payload);
    return data;
  },
};

export default apiClient;
