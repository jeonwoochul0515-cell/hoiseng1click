import type { SourceStatus } from '@/components/docgen/SourceBadge';

export type DocType =
  | 'application'  // 개인회생절차 개시신청서
  | 'debt-list'    // 채권자목록
  | 'asset-list'   // 재산목록
  | 'income-list'  // 수입 및 지출 목록
  | 'repay-plan';  // 변제계획안

/** 문서 내 필드 한 줄. 템플릿이 이걸 순차적으로 타이핑한다. */
export interface DocField {
  id: string;
  label: string;          // "성명", "주민등록번호"
  value: string;          // 실제 표시될 값
  sourceId?: string;      // SourceCatalog의 키
  highlight?: boolean;    // 굵게 표시
  block?: boolean;        // true면 블록 레벨 (제목 등)
  indent?: number;        // 들여쓰기 (0~3)
}

/** 문서 섹션 (제목 + 여러 필드) */
export interface DocSection {
  id: string;
  title: string;
  fields: DocField[];
}

/** 완성 템플릿: 섹션 배열 + 필요한 출처 집합 */
export interface DocTemplate {
  type: DocType;
  title: string;          // "개인회생절차 개시신청서"
  subtitle: string;       // "법원 제출용 · A4 1매"
  icon: string;
  description: string;
  requiredSources: string[]; // SourceCatalog 키 배열
  sections: DocSection[];
}

/** 출처 카탈로그 — 모든 API 소스의 마스터 정의 */
export interface SourceCatalogEntry {
  id: string;
  label: string;          // "홈택스 · 소득금액증명원"
  icon: string;
  /** 모의 호출 소요시간 (ms) — 실제 구현 시 서버 응답 시간으로 대체 */
  mockLatencyMs: number;
}

/** 생성 상태 */
export interface GenerationState {
  status: 'idle' | 'connecting' | 'generating' | 'paused' | 'editing' | 'done' | 'error';
  typedFieldCount: number;
  totalFieldCount: number;
  sourceStatus: Record<string, SourceStatus>;
  currentSectionId?: string;
  currentFieldId?: string;
}
