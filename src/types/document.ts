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
