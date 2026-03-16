/**
 * AI 서술형 항목 작성 도우미
 * Firebase Functions의 Claude API 프록시를 통해 호출
 */
import { auth } from '@/firebase';

const WORKER_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://localhost:8787';

interface AiWriteRequest {
  field: 'debtHistory' | 'propertyChanges' | 'repayWillingness' | 'jobChange' | 'priorApplication';
  keywords: string;
  context?: {
    name?: string;
    totalDebt?: number;
    debtCount?: number;
    job?: string;
    income?: number;
    family?: number;
  };
}

export async function generateNarrative(req: AiWriteRequest): Promise<string> {
  if (!req.keywords.trim()) throw new Error('키워드를 입력해주세요');

  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다');
  const token = await user.getIdToken();

  const res = await fetch(`${WORKER_BASE}/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      field: req.field,
      keywords: req.keywords,
      context: req.context,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `AI 생성 실패 (${res.status})`);
  }

  const data = await res.json() as { text: string; stop_reason?: string };
  console.log('AI 응답:', { length: data.text?.length, stop_reason: data.stop_reason });
  return data.text;
}
