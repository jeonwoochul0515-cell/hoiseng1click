export interface Env {
  DOCS_BUCKET: R2Bucket;
  TOKEN_CACHE: KVNamespace;
  CODEF_CLIENT_ID: string;
  CODEF_CLIENT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  PUBLIC_DATA_API_KEY: string;
}

export interface Debt {
  id: string;
  name: string;
  creditor: string;
  type: string;
  amount: number;
  rate: number;
  monthly: number;
  source: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  rawValue: number;
  liquidationRate: number;
  mortgage: number;
  value: number;
  source: string;
  meta?: { plate?: string; year?: number; address?: string; area?: number };
}
