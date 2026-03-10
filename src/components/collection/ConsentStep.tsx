import { useCollectionStore } from '@/store/collectionStore';
import { CheckSquare, Square } from 'lucide-react';

const CONSENT_LABELS = [
  '서비스 이용약관 동의',
  '개인정보 수집·이용 동의 (개인회생 서류 작성 목적 한정)',
  '개인신용정보 전송요구권 행사 동의 (신용정보법 제33조의2)',
  'CODEF 중계기관을 통한 금융데이터 수집 동의',
];

interface ConsentStepProps {
  clientName: string;
}

export default function ConsentStep({ clientName }: ConsentStepProps) {
  const { consents, setConsent, setStep } = useCollectionStore();
  const allChecked = consents.every(Boolean);

  function handleToggleAll() {
    const next = !allChecked;
    consents.forEach((_, i) => setConsent(i, next));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Info */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-2">금융데이터 수집 동의</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          의뢰인 <span className="text-[var(--color-brand-gold)] font-medium">{clientName}</span>님의
          개인회생 신청을 위한 금융데이터를 CODEF를 통해 수집합니다.
          아래 동의 항목을 모두 확인해 주세요.
        </p>
      </div>

      {/* Checkboxes */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6 space-y-4">
        {/* Select All */}
        <button
          type="button"
          onClick={handleToggleAll}
          className="flex items-center gap-3 w-full text-left pb-4 border-b border-gray-700"
        >
          {allChecked ? (
            <CheckSquare className="h-5 w-5 text-[var(--color-brand-gold)] shrink-0" />
          ) : (
            <Square className="h-5 w-5 text-gray-500 shrink-0" />
          )}
          <span className="text-white font-semibold">전체 동의</span>
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
            <span className={consents[i] ? 'text-gray-200' : 'text-gray-400'}>{label}</span>
          </button>
        ))}
      </div>

      {/* Next Button */}
      <div className="flex justify-end">
        <button
          disabled={!allChecked}
          onClick={() => setStep(2)}
          className="rounded-lg px-8 py-3 font-semibold text-sm transition-colors
            enabled:bg-[var(--color-brand-gold)] enabled:text-[var(--color-brand-navy)]
            enabled:hover:brightness-110
            disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          다음
        </button>
      </div>
    </div>
  );
}
