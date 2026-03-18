export type DocType = 'debt_list' | 'asset_list' | 'income_list' | 'application' | 'repay_plan' | 'statement';
export type DocFormat = 'docx' | 'hwpx';

export interface DocGenerateRequest {
  clientId: string;
  officeId: string;
  docType: DocType | 'all';
  format: DocFormat;
  clientData: import('./client').Client;
}

export interface DocGenerateResponse {
  downloadUrl: string;
  fileName: string;
}

export const DOC_LABELS: Record<DocType, string> = {
  debt_list: '채권자 목록',
  asset_list: '재산 목록',
  income_list: '수입지출 목록',
  application: '개인회생 신청서',
  repay_plan: '변제계획안',
  statement: '진술서',
};

/** 수집 서류 카테고리 */
export type DocCategory = 'basic' | 'bank' | 'card' | 'insurance' | 'asset' | 'income' | 'etc';

/** 업로드 서류 (Firestore: offices/{officeId}/clients/{clientId}/documents/{docId}) */
export interface ClientDocument {
  id: string;
  category: DocCategory;
  subCategory: string;
  institution: string;
  docType: string;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  ocrStatus: 'pending' | 'processing' | 'done' | 'failed';
  extractedData?: {
    rawText: string;
    amounts?: number[];
    dates?: string[];
    accountNumbers?: string[];
    structured?: Record<string, string>;
  };
  uploadedAt: Date | { toDate(): Date };
  uploadedBy: 'client' | 'office';
  codefAmount?: number;
  pdfAmount?: number;
  dataMismatch?: boolean;
}
