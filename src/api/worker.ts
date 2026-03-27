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
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string; code?: string; detail?: string };
    const parts = [body.error ?? `API 에러 ${res.status}`];
    if (body.code) parts.push(`[${body.code}]`);
    if (body.detail) parts.push(body.detail);
    throw new Error(parts.join(' '));
  }
  return res.json() as Promise<T>;
}

export interface CodefCollectRequest {
  clientId: string;
  authMethod: 'cert' | 'kakao' | 'pass' | 'finCert';
  credentials: { loginType: string; id: string; password: string; pfxFile?: string };
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
  // CODEF 연결 진단
  testConnection() {
    return request<{
      oauth: { ok: boolean; elapsed?: number; error?: string };
      api: { ok: boolean; elapsed?: number; code?: string; error?: string };
      config: { host: string; hasClientId: boolean; hasClientSecret: boolean; hasPublicKey: boolean };
    }>('/codef/test-connection', { method: 'POST' });
  },

  // 간편인증 시작
  simpleAuthStart(data: { userName: string; birthDate: string; phoneNo: string; provider?: string; banks: string[] }) {
    return request<{
      status: 'pending' | 'done';
      message?: string;
      connectedId?: string;
      twoWayInfo?: { jobIndex: number; threadIndex: number; jti: string; twoWayTimestamp: number };
      sandbox?: boolean;
    }>('/codef/simple-auth/start', { method: 'POST', body: JSON.stringify(data) });
  },

  // 간편인증 완료
  simpleAuthComplete(data: { twoWayInfo: object; banks: string[]; phoneNo: string; birthDate: string; userName: string; provider?: string }) {
    return request<{
      status: 'pending' | 'done';
      connectedId?: string;
      message?: string;
    }>('/codef/simple-auth/complete', { method: 'POST', body: JSON.stringify(data) });
  },

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

  // ── 공공기관 데이터 ──

  // 공공기관 통합 수집 (소득/건보/연금 한번에)
  collectPublicData(connectedId: string, identity?: string) {
    return request<{
      incomeProof: any;
      withholdingTax: any;
      healthInsurance: { qualification: any; dependents: Array<{ name: string; relation: string; birthDate: string }> };
      pension: any;
    }>('/codef/public-collect', {
      method: 'POST', body: JSON.stringify({ connectedId, identity }),
    });
  },

  // 소득금액증명원
  getIncomeProof(connectedId: string, identity?: string) {
    return request<{ success: boolean; data: any }>('/codef/public/income-proof', {
      method: 'POST', body: JSON.stringify({ connectedId, identity }),
    });
  },

  // 건강보험 자격득실 + 피부양자
  getHealthInsurance(connectedId: string, identity?: string) {
    return request<{ qualification: any; dependents: Array<{ name: string; relation: string; birthDate: string }> }>('/codef/public/health-insurance', {
      method: 'POST', body: JSON.stringify({ connectedId, identity }),
    });
  },

  // 국민연금
  getPension(connectedId: string, identity?: string) {
    return request<{ success: boolean; data: any }>('/codef/public/pension', {
      method: 'POST', body: JSON.stringify({ connectedId, identity }),
    });
  },

  // 사업자등록증명
  getBusinessRegistration(connectedId: string, identity?: string, businessNumber?: string) {
    return request<{ success: boolean; data: any }>('/codef/public/business-registration', {
      method: 'POST', body: JSON.stringify({ connectedId, identity, businessNumber }),
    });
  },

  // ── 금융 확장 수집 ──

  // 카드 승인내역
  getCardApprovals(connectedId: string, startDate: string, endDate: string) {
    return request<{ approvals: Array<{ date: string; amount: number; merchant: string; cardNo: string }> }>('/codef/card-approvals', {
      method: 'POST', body: JSON.stringify({ connectedId, startDate, endDate }),
    });
  },

  // 은행 거래내역
  getBankTransactions(connectedId: string, startDate: string, endDate: string) {
    return request<{ transactions: Array<{ date: string; amount: number; type: string; description: string; balance: number }> }>('/codef/bank-transactions', {
      method: 'POST', body: JSON.stringify({ connectedId, startDate, endDate }),
    });
  },

  // 증권 자산
  getStockAssets(connectedId: string) {
    return request<{ accounts: any[]; totalValue: number }>('/codef/stock-assets', {
      method: 'POST', body: JSON.stringify({ connectedId }),
    });
  },

  // 금융 확장 통합 수집
  collectExtendedFinance(connectedId: string, startDate: string, endDate: string) {
    return request<{
      cardApprovals: any[];
      bankTransactions: any[];
      stockAssets: any[];
    }>('/codef/finance-collect', {
      method: 'POST', body: JSON.stringify({ connectedId, startDate, endDate }),
    });
  },

  // ── CODEF 재산 조회 (차량등록원부 + 부동산 공시가격) ──

  // 차량등록원부 + 보험개발원 기준가액
  getVehicleInfo(carNumber: string, ownerName?: string, ownerBirthDate?: string) {
    return request<{
      carNumber: string; model: string; year: number; displacement: number; fuelType: string;
      basePrice: number; liquidation70: number; mortgage: number; seizure: number; netValue: number;
      mortgageDetails: Array<{ creditor: string; resAmount: number; resDate: string }>;
      seizureDetails: Array<{ resAmount: number }>;
      registrationDate: string; ownerCount: number; source: string;
    }>('/codef/vehicle-info', {
      method: 'POST', body: JSON.stringify({ carNumber, ownerName, ownerBirthDate }),
    });
  },

  // 부동산 공시가격 (CODEF 경유)
  getPropertyPrice2(address: string, propertyType?: string, dong?: string, ho?: string) {
    return request<{
      address: string; propertyType: string; rawPrice: number; area: number;
      liquidation75: number; standardDate: string; buildingName: string; dongHo: string; source: string;
      message?: string;
    }>('/codef/property-price', {
      method: 'POST', body: JSON.stringify({ address, propertyType, dong, ho }),
    });
  },

  // 통합 재산 조회 (차량 + 부동산 한번에)
  assetLookup(
    vehicles: Array<{ carNumber: string; ownerName?: string; ownerBirthDate?: string }>,
    properties: Array<{ address: string; propertyType?: string; dong?: string; ho?: string }>,
  ) {
    return request<{
      vehicles: Array<{ carNumber: string; model: string; year: number; basePrice: number; liquidation70: number; mortgage: number; seizure: number; netValue: number; source: string; error?: string }>;
      properties: Array<{ address: string; propertyType: string; rawPrice: number; liquidation75: number; buildingName: string; source: string; error?: string }>;
    }>('/codef/asset-lookup', {
      method: 'POST', body: JSON.stringify({ vehicles, properties }),
    });
  },

  // ── 공공데이터 (부동산/토지) ──

  // 토지대장
  getLandRegister(pnu: string) {
    return request<{ pnu: string; address: string; landCategory: string; area: number; useDistrict: string; source: string }>(
      `/public/land-register?pnu=${encodeURIComponent(pnu)}`
    );
  },

  // 건축물대장
  getBuildingRegister(params: { sigunguCd: string; bjdongCd: string; bun: string; ji?: string }) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<{ address: string; mainPurpose: string; totalArea: number; source: string }>(
      `/public/building-register?${qs}`
    );
  },

  // ── 상세 신고서 v2 (개선판) ──

  getStatementDataV2(connectedId: string) {
    return request<{
      newDebts: Array<{ date: string; creditor: string; type: string; amount: number; rate: number }>;
      largeTransfers: Array<{ date: string; account: string; amount: number; recipient: string; memo: string; category: string }>;
      cashWithdrawals: Array<{ date: string; account: string; amount: number; memo: string; method: string }>;
      largeCardUsage: Array<{ date: string; cardNo: string; amount: number; merchant: string; category: string }>;
      cancelledInsurance: Array<{ company: string; productName: string; cancelDate: string; monthlyPremium: number; refundAmount: number }>;
      stockLosses: Array<{ broker: string; stockName: string; buyAmount: number; sellAmount: number; loss: number; tradeDate: string }>;
    }>('/codef/statement-data-v2', {
      method: 'POST', body: JSON.stringify({ connectedId }),
    });
  },
};
