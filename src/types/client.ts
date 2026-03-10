export type ClientStatus = 'new' | 'contacted' | 'collecting' | 'drafting' | 'submitted' | 'approved';
export type JobType = 'employed' | 'self' | 'freelance' | 'daily' | 'unemployed';
export type DebtType = '무담보' | '담보' | '사채';
export type AssetType = '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';

export interface Debt {
  id: string;
  name: string;
  creditor: string;
  type: DebtType;
  amount: number;
  rate: number;
  monthly: number;
  source: 'codef' | 'manual';
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  rawValue: number;
  liquidationRate: number;
  mortgage: number;
  value: number;
  source: 'codef' | 'api' | 'manual';
  meta?: { plate?: string; year?: number; address?: string; area?: number };
}

export interface Client {
  id: string;
  name: string;
  ssn: string;
  phone: string;
  address: string;
  job: string;
  jobType: JobType;
  family: number;
  court: string;
  income: number;
  income2: number;
  rent: number;
  education: number;
  medical: number;
  status: ClientStatus;
  collectionDone: boolean;
  connectedId?: string;
  debts: Debt[];
  assets: Asset[];
  memo: string;
  createdAt: Date;
  updatedAt: Date;
}
