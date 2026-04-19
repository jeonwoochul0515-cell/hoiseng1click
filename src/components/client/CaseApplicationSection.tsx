// 전자소송 개인회생 개시신청서 양식 기반 상세 입력 섹션
// ClientForm.tsx의 새 탭 또는 B2C 자가진단 마지막 단계에서 재사용
import { useState } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { COURTS, CASE_TYPES, REFUND_BANKS, RELATION_TYPES, DEFAULT_APPLICATION_PURPOSE } from '@/utils/legalConstants';
import type { IncomeType, RelatedCase, DocVisibility } from '@/types/client';
import { toast } from '@/utils/toast';
import { auth } from '@/firebase';

const WORKER_BASE = (import.meta.env.VITE_WORKER_BASE_URL as string | undefined) ?? '';

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function emptyRelatedCase(): RelatedCase {
  return {
    id: generateId(),
    relation: '배우자',
    relationName: '',
    court: '',
    caseYear: new Date().getFullYear(),
    caseType: '개회',
    caseNumber: '',
  };
}

export interface CaseApplicationState {
  // 사건기본정보
  incomeType?: IncomeType;
  repayPeriodMonths?: number;
  repayStartDate?: string;
  repayStartAfterAuthorization?: boolean;
  repayDayOfMonth?: number;
  monthlyPaymentOverride?: number;
  refundBank?: string;
  refundAccount?: string;
  refundAccountHolder?: string;
  court?: string;
  // 당사자정보
  nationality?: string;
  nameForeign?: string;
  residentAddress?: string;
  residentAddressDetail?: string;
  residentZonecode?: string;
  actualAddress?: string;
  actualAddressDetail?: string;
  actualZonecode?: string;
  sameAsResident?: boolean;
  deliveryAddress?: string;
  deliveryAddressDetail?: string;
  deliveryZonecode?: string;
  sameDeliveryAsResident?: boolean;
  tel?: string;
  fax?: string;
  email?: string;
  docVisibility?: DocVisibility;
  // 관련사건
  relatedCases?: RelatedCase[];
  // 신청취지/이유
  applicationPurpose?: string;
  applicationReason?: string;
}

interface Props {
  value: CaseApplicationState;
  onChange: (next: CaseApplicationState) => void;
  /** AI 자동 생성 시 참고할 신청인 정보 */
  aiContext?: {
    name?: string;
    totalDebt?: number;
    debtCount?: number;
    job?: string;
    income?: number;
    family?: number;
  };
}

export function CaseApplicationSection({ value, onChange, aiContext }: Props) {
  const [aiLoading, setAiLoading] = useState(false);

  const generateReason = async () => {
    if (aiLoading || !WORKER_BASE) {
      if (!WORKER_BASE) toast.error('AI 엔드포인트가 설정되지 않았습니다');
      return;
    }
    setAiLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const keywords = [
        aiContext?.job && `직업: ${aiContext.job}`,
        aiContext?.totalDebt && `총 채무: ${aiContext.totalDebt.toLocaleString()}원`,
        aiContext?.debtCount && `채권자 ${aiContext.debtCount}곳`,
        aiContext?.family && `가족 ${aiContext.family}명`,
        value.incomeType === 'salary' ? '급여소득' : value.incomeType === 'business' ? '영업소득' : null,
      ].filter(Boolean).join(', ') || '생활비 부족 및 이자 부담 누적';

      const res = await fetch(`${WORKER_BASE}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          field: 'applicationReason',
          keywords,
          context: aiContext,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `AI 생성 실패 (${res.status})`);
      }
      const { text } = (await res.json()) as { text: string };
      if (!text) throw new Error('AI 응답이 비어있습니다');
      onChange({ ...value, applicationReason: text });
      toast.success('신청이유가 자동 생성되었습니다');
    } catch (err: any) {
      console.error('신청이유 AI 생성 실패:', err);
      toast.error(err?.message ?? 'AI 생성에 실패했습니다');
    } finally {
      setAiLoading(false);
    }
  };
  const v = value;
  const set = <K extends keyof CaseApplicationState>(k: K, val: CaseApplicationState[K]) =>
    onChange({ ...v, [k]: val });
  const vis = v.docVisibility ?? {};
  const setVis = (k: keyof DocVisibility, val: boolean) =>
    onChange({ ...v, docVisibility: { ...vis, [k]: val } });

  const relatedCases = v.relatedCases ?? [];
  const updateRelatedCase = (id: string, patch: Partial<RelatedCase>) => {
    onChange({
      ...v,
      relatedCases: relatedCases.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };
  const addRelatedCase = () =>
    onChange({ ...v, relatedCases: [...relatedCases, emptyRelatedCase()] });
  const removeRelatedCase = (id: string) =>
    onChange({ ...v, relatedCases: relatedCases.filter((r) => r.id !== id) });

  return (
    <div className="space-y-8">
      {/* ── 사건기본정보 ── */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-text-primary border-l-4 border-brand-gold pl-3">
          사건기본정보
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="소득구분" required>
            <select
              className="input"
              value={v.incomeType ?? ''}
              onChange={(e) => set('incomeType', (e.target.value || undefined) as IncomeType)}
            >
              <option value="">선택</option>
              <option value="salary">급여소득으로 변제</option>
              <option value="business">영업소득으로 변제</option>
              <option value="mixed">급여소득 + 영업소득으로 변제</option>
            </select>
          </Field>

          <Field label="변제기간 (개월)" required hint="60개월 초과 불가">
            <input
              type="number"
              min={12}
              max={60}
              className="input"
              value={v.repayPeriodMonths ?? ''}
              onChange={(e) => set('repayPeriodMonths', e.target.value ? Number(e.target.value) : undefined)}
            />
          </Field>

          <Field label="변제시작일자" required hint="신청일로부터 2~3개월 후 이내">
            <input
              type="date"
              className="input"
              value={v.repayStartDate ?? ''}
              onChange={(e) => set('repayStartDate', e.target.value)}
            />
          </Field>

          <Field label="월변제일자 (매월)" required hint="1~28 권장">
            <input
              type="number"
              min={1}
              max={31}
              className="input"
              value={v.repayDayOfMonth ?? ''}
              onChange={(e) => set('repayDayOfMonth', e.target.value ? Number(e.target.value) : undefined)}
            />
          </Field>

          <Field label="월변제금액 (원)" required hint="월평균 수입 − 월평균 생계비">
            <input
              type="number"
              min={0}
              className="input"
              value={v.monthlyPaymentOverride ?? ''}
              onChange={(e) => set('monthlyPaymentOverride', e.target.value ? Number(e.target.value) : undefined)}
            />
          </Field>

          <Field label="제출법원" required>
            <select
              className="input"
              value={v.court ?? ''}
              onChange={(e) => set('court', e.target.value)}
            >
              <option value="">선택</option>
              {COURTS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={!!v.repayStartAfterAuthorization}
              onChange={(e) => set('repayStartAfterAuthorization', e.target.checked)}
            />
            변제계획안이 인가되는 날의 다음달 {v.repayDayOfMonth ?? '__'}일부터 변제 시작
            <span className="text-text-muted">(압류적립금 투여로 인가 전 월변제금액을 납부할 수 없는 경우)</span>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-4 rounded-lg bg-bg-elev p-4">
          <Field label="환급은행" required>
            <select
              className="input"
              value={v.refundBank ?? ''}
              onChange={(e) => set('refundBank', e.target.value)}
            >
              <option value="">선택</option>
              {REFUND_BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="환급계좌번호" required hint="'-' 없이 숫자만">
            <input
              className="input"
              value={v.refundAccount ?? ''}
              onChange={(e) => set('refundAccount', e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label="예금주" required>
            <input
              className="input"
              value={v.refundAccountHolder ?? ''}
              onChange={(e) => set('refundAccountHolder', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* ── 당사자기본정보 ── */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-text-primary border-l-4 border-brand-gold pl-3">
          당사자기본정보 <span className="text-xs text-text-muted font-normal">(신청인 = 채무자, 자연인)</span>
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="국적" required>
            <select
              className="input"
              value={v.nationality ?? '한국'}
              onChange={(e) => set('nationality', e.target.value)}
            >
              <option value="한국">한국</option>
              <option value="기타">기타 (외국인)</option>
            </select>
          </Field>
          <Field label="외국어이름" hint="외국인/법인인 경우만">
            <input
              className="input"
              value={v.nameForeign ?? ''}
              onChange={(e) => set('nameForeign', e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">주민등록지 주소 <span className="text-red-500">*</span></label>
            <div className="grid gap-2 md:grid-cols-[120px_1fr]">
              <input
                className="input"
                placeholder="우편번호"
                value={v.residentZonecode ?? ''}
                onChange={(e) => set('residentZonecode', e.target.value)}
              />
              <input
                className="input"
                placeholder="기본주소"
                value={v.residentAddress ?? ''}
                onChange={(e) => set('residentAddress', e.target.value)}
              />
              <input
                className="input md:col-span-2"
                placeholder="상세주소 — 동·호수 등 + (동명, 아파트/건물명)"
                value={v.residentAddressDetail ?? ''}
                onChange={(e) => set('residentAddressDetail', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-3">
              실거주지 주소
              <label className="flex items-center gap-1 text-xs font-normal">
                <input
                  type="checkbox"
                  checked={!!v.sameAsResident}
                  onChange={(e) => set('sameAsResident', e.target.checked)}
                />
                위 주소와 동일
              </label>
            </label>
            {!v.sameAsResident && (
              <div className="grid gap-2 md:grid-cols-[120px_1fr]">
                <input className="input" placeholder="우편번호"
                  value={v.actualZonecode ?? ''}
                  onChange={(e) => set('actualZonecode', e.target.value)} />
                <input className="input" placeholder="기본주소"
                  value={v.actualAddress ?? ''}
                  onChange={(e) => set('actualAddress', e.target.value)} />
                <input className="input md:col-span-2" placeholder="상세주소"
                  value={v.actualAddressDetail ?? ''}
                  onChange={(e) => set('actualAddressDetail', e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 flex items-center gap-3">
              송달장소
              <label className="flex items-center gap-1 text-xs font-normal">
                <input
                  type="checkbox"
                  checked={!!v.sameDeliveryAsResident}
                  onChange={(e) => set('sameDeliveryAsResident', e.target.checked)}
                />
                위 주소와 동일
              </label>
            </label>
            {!v.sameDeliveryAsResident && (
              <div className="grid gap-2 md:grid-cols-[120px_1fr]">
                <input className="input" placeholder="우편번호"
                  value={v.deliveryZonecode ?? ''}
                  onChange={(e) => set('deliveryZonecode', e.target.value)} />
                <input className="input" placeholder="기본주소"
                  value={v.deliveryAddress ?? ''}
                  onChange={(e) => set('deliveryAddress', e.target.value)} />
                <input className="input md:col-span-2" placeholder="상세주소"
                  value={v.deliveryAddressDetail ?? ''}
                  onChange={(e) => set('deliveryAddressDetail', e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <VisibilityInput label="전화번호 (선택)" value={v.tel ?? ''}
            visible={!!vis.tel} onChange={(val) => set('tel', val)} onVisibleChange={(b) => setVis('tel', b)} />
          <VisibilityInput label="팩스 (선택)" value={v.fax ?? ''}
            visible={!!vis.fax} onChange={(val) => set('fax', val)} onVisibleChange={(b) => setVis('fax', b)} />
          <VisibilityInput label="이메일" value={v.email ?? ''}
            visible={!!vis.email} onChange={(val) => set('email', val)} onVisibleChange={(b) => setVis('email', b)} type="email" />
        </div>
      </section>

      {/* ── 관련사건목록 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text-primary border-l-4 border-brand-gold pl-3">
            관련사건목록
          </h3>
          <button
            type="button"
            onClick={addRelatedCase}
            className="flex items-center gap-1 text-sm px-3 py-1 rounded bg-brand-gold text-white hover:opacity-90"
          >
            <Plus size={14} /> 관련사건 추가
          </button>
        </div>
        <p className="text-xs text-text-muted mb-3">
          배우자(또는 주채무자·보증채무자·연대채무자)가 이미 법원에 회생절차 개시신청, 파산신청 또는 개인회생절차 개시신청을 한 경우 내지 동시에 신청한 경우에 입력합니다.
        </p>

        {relatedCases.length === 0 ? (
          <div className="rounded border border-dashed border-border-subtle p-6 text-center text-sm text-text-muted">
            관련사건이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {relatedCases.map((rc, idx) => (
              <div key={rc.id} className="rounded-lg border border-border-subtle p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">관련사건 #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRelatedCase(rc.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <select
                    className="input"
                    value={rc.relation}
                    onChange={(e) => updateRelatedCase(rc.id, { relation: e.target.value as RelatedCase['relation'] })}
                  >
                    {RELATION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="관계인명"
                    value={rc.relationName}
                    onChange={(e) => updateRelatedCase(rc.id, { relationName: e.target.value })}
                  />
                  <select
                    className="input"
                    value={rc.court}
                    onChange={(e) => updateRelatedCase(rc.id, { court: e.target.value })}
                  >
                    <option value="">제출법원</option>
                    {COURTS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      className="input w-20"
                      placeholder="YYYY"
                      value={rc.caseYear}
                      onChange={(e) => updateRelatedCase(rc.id, { caseYear: Number(e.target.value) })}
                    />
                    <select
                      className="input w-20"
                      value={rc.caseType}
                      onChange={(e) => updateRelatedCase(rc.id, { caseType: e.target.value })}
                    >
                      {CASE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.value}</option>
                      ))}
                    </select>
                    <input
                      className="input flex-1"
                      placeholder="번호"
                      value={rc.caseNumber}
                      onChange={(e) => updateRelatedCase(rc.id, { caseNumber: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 신청취지 & 신청이유 ── */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-text-primary border-l-4 border-brand-gold pl-3">
          신청취지 · 신청이유
        </h3>
        <div className="space-y-4">
          <Field label="신청취지" required>
            <textarea
              className="input min-h-[80px]"
              value={v.applicationPurpose ?? DEFAULT_APPLICATION_PURPOSE}
              onChange={(e) => set('applicationPurpose', e.target.value)}
              maxLength={6000}
            />
            <div className="text-xs text-text-muted text-right mt-1">
              {(v.applicationPurpose ?? DEFAULT_APPLICATION_PURPOSE).length} / 6000
            </div>
          </Field>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">
                신청이유 <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-text-muted font-normal">AI가 자동 생성 (2000자 이내)</span>
              </label>
              <button
                type="button"
                onClick={generateReason}
                disabled={aiLoading}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-brand-gold px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles size={14} />
                {aiLoading ? 'AI 작성 중...' : (v.applicationReason ? 'AI로 다시 생성' : 'AI로 자동 생성')}
              </button>
            </div>
            <textarea
              className="input min-h-[220px]"
              value={v.applicationReason ?? ''}
              onChange={(e) => set('applicationReason', e.target.value)}
              maxLength={2000}
              placeholder="AI로 자동 생성 버튼을 누르면 채무·소득·가족 정보를 기반으로 자동 작성됩니다. 생성 후 자유롭게 수정 가능합니다."
            />
            <div className="text-xs text-text-muted text-right mt-1">
              {(v.applicationReason ?? '').length} / 2000
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-xs text-text-muted mt-1">{hint}</div>}
    </div>
  );
}

function VisibilityInput({
  label,
  value,
  visible,
  onChange,
  onVisibleChange,
  type = 'text',
}: {
  label: string;
  value: string;
  visible: boolean;
  onChange: (val: string) => void;
  onVisibleChange: (v: boolean) => void;
  type?: 'text' | 'email';
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 flex items-center gap-2">
        {label}
        <label className="flex items-center gap-1 text-xs font-normal text-text-muted">
          <input type="checkbox" checked={visible} onChange={(e) => onVisibleChange(e.target.checked)} />
          제출문서에 보임
        </label>
      </label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
