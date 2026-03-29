import { useCollectionStore } from '@/store/collectionStore';
import { useAuthStore } from '@/store/authStore';
import { CheckSquare, Square } from 'lucide-react';
import CreditPdfUpload from './CreditPdfUpload';

const CONSENT_LABELS = [
  '서비스 이용약관 동의',
  '개인정보 수집·이용 동의 (개인회생 서류 작성 목적 한정)',
  '개인신용정보 전송요구권 행사 동의 (신용정보법 제33조의2)',
  'CODEF 중계기관을 통한 금융데이터 수집 동의',
  '크레딧포유 개인신용정보 조회 동의',
];

interface ConsentStepProps {
  clientName: string;
  clientId?: string;
}

export default function ConsentStep({ clientName, clientId }: ConsentStepProps) {
  const { consents, setConsent, setStep } = useCollectionStore();
  const office = useAuthStore((s) => s.office);
  const allChecked = consents.every(Boolean);

  function handleToggleAll() {
    const next = !allChecked;
    consents.forEach((_, i) => setConsent(i, next));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Info */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">금융데이터 수집 동의</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          의뢰인 <span className="text-[var(--color-brand-gold)] font-medium">{clientName}</span>님의
          개인회생 신청을 위한 금융데이터를 CODEF를 통해 수집합니다.
          아래 동의 항목을 모두 확인해 주세요.
        </p>
      </div>

      {/* Checkboxes */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6 space-y-4">
        {/* Select All */}
        <button
          type="button"
          onClick={handleToggleAll}
          className="flex items-center gap-3 w-full text-left pb-4 border-b border-gray-200"
        >
          {allChecked ? (
            <CheckSquare className="h-5 w-5 text-[var(--color-brand-gold)] shrink-0" />
          ) : (
            <Square className="h-5 w-5 text-gray-500 shrink-0" />
          )}
          <span className="text-gray-900 font-semibold">전체 동의</span>
        </button>

        {/* Individual */}
        {CONSENT_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setConsent(i, !consents[i])}
            className="flex items-start gap-3 w-full text-left"
          >
            {consents[i] ? (
              <CheckSquare className="h-5 w-5 text-[var(--color-brand-gold)] shrink-0 mt-0.5" />
            ) : (
              <Square className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
            )}
            <span className={consents[i] ? 'text-gray-700' : 'text-gray-600'}>{label}</span>
          </button>
        ))}
      </div>

      {/* Credit PDF Upload (동의 완료 후 표시) */}
      {allChecked && clientId && office && (
        <CreditPdfUpload
          clientId={clientId}
          officeId={office.id}
          onParsed={() => setStep(2)}
          onSkip={() => setStep(2)}
        />
      )}

      {/* Next Button (PDF 미사용 시) */}
      {!allChecked && (
        <div className="flex justify-end">
          <button
            disabled
            className="rounded-lg px-8 py-3 font-semibold text-sm transition-colors
              disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            동의 항목을 모두 확인해 주세요
          </button>
        </div>
      )}
    </div>
  );
}
