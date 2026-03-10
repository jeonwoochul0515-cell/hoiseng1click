import { auth } from '@/firebase';

const WORKER_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://localhost:8787';

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${WORKER_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `API 에러 ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface CodefCollectRequest {
  clientId: string;
  authMethod: 'cert' | 'kakao' | 'pass' | 'finCert';
  credentials: { loginType: string; id: string; password: string };
  banks: string[];
}

export interface CodefCollectResponse {
  debts: Array<{
    id: string;
    name: string;
    creditor: string;
    type: '무담보' | '담보' | '사채';
    amount: number;
    rate: number;
    monthly: number;
    source: 'codef';
  }>;
  assets: Array<{
    id: string;
    name: string;
    type: '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';
    rawValue: number;
    liquidationRate: number;
    mortgage: number;
    value: number;
    source: 'codef';
  }>;
  summary: {
    totalDebt: number;
    totalDebtCount: number;
    totalAsset: number;
    totalAssetCount: number;
  };
  connectedId: string;
}

export const workerApi = {
  codefCollect(data: CodefCollectRequest): Promise<CodefCollectResponse> {
    return request<CodefCollectResponse>('/codef/collect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPropertyPrice(address: string, type: string, area: number) {
    return request<{ rawPrice: number; address: string; liquidation75: number; source: string }>(
      `/public/property?address=${encodeURIComponent(address)}&type=${type}&area=${area}`
    );
  },

  getVehicleValue(params: { plate?: string; model?: string; year?: number; km?: number }) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request<{ model: string; year: number; basePrice: number; liquidation70: number }>(
      `/public/vehicle?${qs}`
    );
  },

  generateDoc(data: object) {
    return request<{ downloadUrl: string; fileName: string }>('/doc/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
