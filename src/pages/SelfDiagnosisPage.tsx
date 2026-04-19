import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, ArrowRight, RotateCcw, ChevronRight } from 'lucide-react';

/* ───────────────────────────────────────────
   컬러 시스템 — 틸 + 웜화이트 + 코랄
   Primary:   #48B5A0 (틸)
   BG:        #FAFAF7 (웜화이트)
   CTA:       #E8836B (소프트 코랄)
   Text:      #2D3436 (다크 그레이)
   TextSub:   #636E72 (보조 그레이)
   ─────────────────────────────────────────── */

/* ───────────────────────────────────────────
   타입 & 상수
   ─────────────────────────────────────────── */

type IncomeType = '정규직' | '계약직' | '자영업' | '프리랜서·일용직' | '무직(구직중)' | '무직(미정)';
type FamilySize = 1 | 2 | 3 | 4 | 5;
type DebtCause = '생활비' | '사업실패' | '보증' | '도박·투자' | '의료비' | '기타';
type DiagnosisResult = 'green' | 'yellow' | 'red';

interface Answers {
  incomeType: IncomeType | null;
  monthlyIncome: number;
  familySize: FamilySize | null;
  totalDebt: number;
  hasSecuredDebt: boolean | null;
  securedDebtAmount: number;
  debtCauses: DebtCause[];
  hasPriorDischarge: boolean | null;
  priorDischargeYear: number | null;
}

const INITIAL_ANSWERS: Answers = {
  incomeType: null,
  monthlyIncome: 0,
  familySize: null,
  totalDebt: 0,
  hasSecuredDebt: null,
  securedDebtAmount: 0,
  debtCauses: [],
  hasPriorDischarge: null,
  priorDischargeYear: null,
};

// 기준중위소득 60% (2026년 추정, 만원)
const MEDIAN_INCOME_60: Record<number, number> = {
  1: 150,
  2: 250,
  3: 320,
  4: 390,
  5: 460,
};

const TOTAL_STEPS = 7;

/* ───────────────────────────────────────────
   진행률 바
   ─────────────────────────────────────────── */
function ProgressBar({ step }: { step: number }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-[#636E72]">{step + 1} / {TOTAL_STEPS}</span>
        <span className="text-xs text-[#636E72]">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#48B5A0] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   선택 버튼
   ─────────────────────────────────────────── */
function SelectButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border-2 px-5 py-4 text-left font-medium transition-all ${
        selected
          ? 'border-[#48B5A0] bg-[#48B5A0]/10 text-[#2D3436]'
          : 'border-gray-200 bg-white text-[#636E72] hover:border-[#48B5A0]/40 hover:bg-[#48B5A0]/5'
      }`}
    >
      {label}
    </button>
  );
}

/* ───────────────────────────────────────────
   슬라이더 + 직접입력
   ─────────────────────────────────────────── */
function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  unit,
  formatLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  formatLabel: (v: number) => string;
}) {
  const [inputMode, setInputMode] = useState(false);
  const [inputText, setInputText] = useState('');

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span className="text-3xl font-bold text-[#2D3436]">{formatLabel(value)}</span>
        <span className="ml-1 text-lg text-[#636E72]">{unit}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #48B5A0 ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%)`,
        }}
      />

      <div className="flex justify-between text-xs text-[#636E72]">
        <span>{formatLabel(min)}{unit}</span>
        <span>{formatLabel(max)}{unit}</span>
      </div>

      {!inputMode ? (
        <button
          onClick={() => { setInputMode(true); setInputText(String(value)); }}
          className="w-full text-center text-sm text-[#48B5A0] hover:underline"
        >
          직접 입력하기
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="number"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-center text-lg focus:border-[#48B5A0] focus:outline-none"
            placeholder={`${unit} 단위로 입력`}
            autoFocus
          />
          <button
            onClick={() => {
              const n = Number(inputText);
              if (!isNaN(n) && n >= 0) onChange(Math.min(n, max));
              setInputMode(false);
            }}
            className="shrink-0 rounded-xl bg-[#48B5A0] px-5 py-3 font-semibold text-white"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────
   각 스텝 컴포넌트
   ─────────────────────────────────────────── */

function Step1({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const options: IncomeType[] = ['정규직', '계약직', '자영업', '프리랜서·일용직', '무직(구직중)', '무직(미정)'];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">현재 소득이 있으신가요?</h2>
      <p className="text-sm text-[#636E72]">소득 유형을 선택해주세요.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <SelectButton
            key={opt}
            label={opt}
            selected={answers.incomeType === opt}
            onClick={() => setAnswers({ ...answers, incomeType: opt })}
          />
        ))}
      </div>
    </div>
  );
}

function Step2({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">월평균 소득은 얼마인가요?</h2>
      <p className="text-sm text-[#636E72]">세전 기준 월 소득을 선택해주세요.</p>
      <SliderInput
        value={answers.monthlyIncome}
        onChange={(v) => setAnswers({ ...answers, monthlyIncome: v })}
        min={0}
        max={1000}
        step={10}
        unit="만원"
        formatLabel={(v) => v.toLocaleString()}
      />
    </div>
  );
}

function Step3({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const options: { value: FamilySize; label: string }[] = [
    { value: 1, label: '1인 (본인만)' },
    { value: 2, label: '2인' },
    { value: 3, label: '3인' },
    { value: 4, label: '4인' },
    { value: 5, label: '5인 이상' },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">가구 구성원은 몇 명인가요?</h2>
      <p className="text-sm text-[#636E72]">본인을 포함한 인원수를 선택해주세요.</p>
      <div className="grid grid-cols-1 gap-3">
        {options.map((opt) => (
          <SelectButton
            key={opt.value}
            label={opt.label}
            selected={answers.familySize === opt.value}
            onClick={() => setAnswers({ ...answers, familySize: opt.value })}
          />
        ))}
      </div>
    </div>
  );
}

function Step4({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">총 채무액은 대략 얼마인가요?</h2>
      <p className="text-sm text-[#636E72]">은행, 카드, 사채 등 모든 빚을 합산해주세요.</p>
      <SliderInput
        value={answers.totalDebt}
        onChange={(v) => setAnswers({ ...answers, totalDebt: v })}
        min={0}
        max={150000}
        step={100}
        unit="만원"
        formatLabel={(v) => {
          if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}억`;
          return `${v.toLocaleString()}`;
        }}
      />
    </div>
  );
}

function Step5({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">담보대출(주택/자동차)이 있으신가요?</h2>
      <p className="text-sm text-[#636E72]">주택담보대출, 자동차 할부금 등이 해당됩니다.</p>
      <div className="grid grid-cols-2 gap-3">
        <SelectButton
          label="있음"
          selected={answers.hasSecuredDebt === true}
          onClick={() => setAnswers({ ...answers, hasSecuredDebt: true })}
        />
        <SelectButton
          label="없음"
          selected={answers.hasSecuredDebt === false}
          onClick={() => setAnswers({ ...answers, hasSecuredDebt: false, securedDebtAmount: 0 })}
        />
      </div>

      {answers.hasSecuredDebt === true && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[#2D3436]">담보대출 금액</p>
          <SliderInput
            value={answers.securedDebtAmount}
            onChange={(v) => setAnswers({ ...answers, securedDebtAmount: v })}
            min={0}
            max={150000}
            step={100}
            unit="만원"
            formatLabel={(v) => {
              if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}억`;
              return `${v.toLocaleString()}`;
            }}
          />
        </div>
      )}
    </div>
  );
}

function Step6({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const options: DebtCause[] = ['생활비', '사업실패', '보증', '도박·투자', '의료비', '기타'];

  const toggleCause = (cause: DebtCause) => {
    const causes = answers.debtCauses.includes(cause)
      ? answers.debtCauses.filter((c) => c !== cause)
      : [...answers.debtCauses, cause];
    setAnswers({ ...answers, debtCauses: causes });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">채무 발생 원인은?</h2>
      <p className="text-sm text-[#636E72]">해당하는 항목을 모두 선택해주세요. (복수 선택 가능)</p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <SelectButton
            key={opt}
            label={opt}
            selected={answers.debtCauses.includes(opt)}
            onClick={() => toggleCause(opt)}
          />
        ))}
      </div>
    </div>
  );
}

function Step7({ answers, setAnswers }: { answers: Answers; setAnswers: (a: Answers) => void }) {
  const currentYear = 2026;
  const yearOptions = Array.from({ length: 15 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">이전에 면책을 받은 적이 있으신가요?</h2>
      <p className="text-sm text-[#636E72]">개인회생 또는 파산 면책 이력을 확인합니다.</p>
      <div className="grid grid-cols-2 gap-3">
        <SelectButton
          label="있음"
          selected={answers.hasPriorDischarge === true}
          onClick={() => setAnswers({ ...answers, hasPriorDischarge: true })}
        />
        <SelectButton
          label="없음"
          selected={answers.hasPriorDischarge === false}
          onClick={() => setAnswers({ ...answers, hasPriorDischarge: false, priorDischargeYear: null })}
        />
      </div>

      {answers.hasPriorDischarge === true && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[#2D3436]">면책 받은 시기</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {yearOptions.map((year) => (
              <button
                key={year}
                onClick={() => setAnswers({ ...answers, priorDischargeYear: year })}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                  answers.priorDischargeYear === year
                    ? 'border-[#48B5A0] bg-[#48B5A0]/10 text-[#2D3436]'
                    : 'border-gray-200 bg-white text-[#636E72] hover:border-[#48B5A0]/40'
                }`}
              >
                {year}년
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────
   진단 로직
   ─────────────────────────────────────────── */

interface DiagnosisDetail {
  result: DiagnosisResult;
  reasons: string[];
  estimatedPayment?: number; // 예상 월 변제금 (만원)
}

function diagnose(answers: Answers): DiagnosisDetail {
  const reasons: string[] = [];
  let result: DiagnosisResult = 'green';

  const unsecuredDebt = answers.totalDebt - (answers.securedDebtAmount || 0);
  const familySize = answers.familySize || 1;
  const medianIncome60 = MEDIAN_INCOME_60[familySize] || 150;

  // 빨간색 조건
  if (answers.incomeType === '무직(미정)' && answers.monthlyIncome === 0) {
    reasons.push('현재 소득이 없고 구직 계획이 없는 경우 개인회생 신청이 어렵습니다. 안정적인 소득이 개인회생의 필수 요건입니다.');
    result = 'red';
  }

  if (unsecuredDebt > 100000) {
    reasons.push(`무담보 채무가 10억원을 초과합니다 (${(unsecuredDebt / 10000).toFixed(1)}억원). 개인회생 신청 한도를 초과할 수 있습니다.`);
    result = 'red';
  }

  if (answers.totalDebt > 150000) {
    reasons.push('담보 포함 총 채무가 15억원을 초과합니다. 개인회생 신청 한도를 초과할 수 있습니다.');
    result = 'red';
  }

  if (result === 'red') return { result, reasons };

  // 노란색 조건
  if (answers.monthlyIncome < medianIncome60) {
    reasons.push(`월 소득(${answers.monthlyIncome.toLocaleString()}만원)이 ${familySize}인 가구 기준중위소득 60%(${medianIncome60}만원)보다 낮습니다. 변제 능력에 대한 추가 검토가 필요합니다.`);
    if (result !== 'red') result = 'yellow';
  }

  if (answers.debtCauses.includes('도박·투자')) {
    reasons.push('도박 또는 투자로 인한 채무는 면책이 제한될 수 있으나, 재량면책이 가능한 경우도 있습니다. 변호사 상담을 권장합니다.');
    if (result !== 'red') result = 'yellow';
  }

  if (answers.hasPriorDischarge && answers.priorDischargeYear) {
    const yearsSince = 2026 - answers.priorDischargeYear;
    if (yearsSince < 5) {
      reasons.push(`이전 면책으로부터 ${yearsSince}년이 경과했습니다. 면책일로부터 5년 이내에는 재신청이 제한됩니다 (채무자회생법 제624조).`);
      if (result !== 'red') result = 'yellow';
    }
  }

  // 녹색 — 예상 월 변제금 계산
  let estimatedPayment: number | undefined;
  if (result === 'green') {
    const disposableIncome = Math.max(0, answers.monthlyIncome - medianIncome60);
    estimatedPayment = disposableIncome;
    reasons.push('개시결정을 위해 최소 3개월간 계속적 근로(소득) 사실이 소명되어야 합니다. 최근 취업하셨다면 3개월 후 신청을 권장합니다.');
  }

  return { result, reasons, estimatedPayment };
}

/* ───────────────────────────────────────────
   결과 화면
   ─────────────────────────────────────────── */
function ResultScreen({
  diagnosis,
  answers,
  onReset,
}: {
  diagnosis: DiagnosisDetail;
  answers: Answers;
  onReset: () => void;
}) {
  const familySize = answers.familySize || 1;
  const medianIncome60 = MEDIAN_INCOME_60[familySize] || 150;

  const config = {
    green: {
      bg: 'bg-[#E8F5F0]',
      border: 'border-[#48B5A0]',
      iconBg: 'bg-[#48B5A0]',
      title: '개인회생 가능성이 높습니다',
      emoji: '\u{1F7E2}',
    },
    yellow: {
      bg: 'bg-[#FFF8E1]',
      border: 'border-[#F9A825]',
      iconBg: 'bg-[#F9A825]',
      title: '확인이 필요한 사항이 있습니다',
      emoji: '\u{1F7E1}',
    },
    red: {
      bg: 'bg-[#FBE9E7]',
      border: 'border-[#E53935]',
      iconBg: 'bg-[#E53935]',
      title: '현재 조건으로는 어려울 수 있습니다',
      emoji: '\u{1F534}',
    },
  }[diagnosis.result];

  return (
    <div className="space-y-6">
      {/* 결과 카드 */}
      <div className={`rounded-2xl border-2 ${config.border} ${config.bg} p-6 md:p-8 text-center`}>
        <div className="text-4xl mb-4">{config.emoji}</div>
        <h2 className="text-xl font-bold text-[#2D3436] md:text-2xl">{config.title}</h2>
      </div>

      {/* 녹색: 예상 변제금 */}
      {diagnosis.result === 'green' && diagnosis.estimatedPayment !== undefined && (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
          <h3 className="font-bold text-[#2D3436]">예상 월 변제금</h3>
          <div className="text-center">
            <span className="text-3xl font-bold text-[#48B5A0]">
              약 {diagnosis.estimatedPayment.toLocaleString()}만원
            </span>
            <span className="text-[#636E72]"> / 월</span>
          </div>
          <div className="text-sm text-[#636E72] space-y-1">
            <p>월 소득 {answers.monthlyIncome.toLocaleString()}만원 - 기준중위소득 60% {medianIncome60}만원</p>
            <p className="text-xs">* 실제 변제금은 채무액, 청산가치 등에 따라 달라질 수 있습니다.</p>
          </div>
        </div>
      )}

      {/* 사유 목록 */}
      {diagnosis.reasons.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 space-y-3">
          <h3 className="font-bold text-[#2D3436]">
            {diagnosis.result === 'green' ? '참고 사항' : '확인 사항'}
          </h3>
          <div className="space-y-3">
            {diagnosis.reasons.map((reason, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <ChevronRight size={16} className="shrink-0 mt-0.5 text-[#636E72]" />
                <p className="text-[#2D3436]">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빨간색: 파산 안내 */}
      {diagnosis.result === 'red' && (
        <div className="rounded-2xl bg-[#F5F0EB] p-6">
          <h3 className="font-bold text-[#2D3436]">다른 방법도 있습니다</h3>
          <p className="mt-2 text-sm text-[#636E72]">
            개인회생이 어려운 경우, <strong>개인파산</strong>을 검토해볼 수 있습니다.
            개인파산은 소득 요건 없이 신청 가능하며, 면책 결정 시 채무 전액이 소멸됩니다.
            변호사 상담을 통해 적합한 방법을 확인해보세요.
          </p>
        </div>
      )}

      {/* 노란색: 변호사 상담 권장 */}
      {diagnosis.result === 'yellow' && (
        <div className="rounded-2xl bg-[#F5F0EB] p-6">
          <h3 className="font-bold text-[#2D3436]">변호사 상담을 권장합니다</h3>
          <p className="mt-2 text-sm text-[#636E72]">
            위 사항들은 개인회생 진행에 영향을 줄 수 있지만, 반드시 불가능하다는 의미는 아닙니다.
            전문가 상담을 통해 정확한 판단을 받아보시는 것을 권장합니다.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3">
        {diagnosis.result === 'green' && (
          <Link
            to="/login?mode=individual"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E8836B] px-6 py-4 text-lg font-bold text-white shadow-lg shadow-[#E8836B]/25 hover:bg-[#d4725c] transition-all"
          >
            지금 시작하기
            <ArrowRight size={18} />
          </Link>
        )}

        <button
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-6 py-4 font-semibold text-[#636E72] hover:border-[#48B5A0]/40 hover:text-[#2D3436] transition-all"
        >
          <RotateCcw size={16} />
          다시 진단하기
        </button>
      </div>

      {/* 면책 안내 */}
      <p className="text-center text-xs text-[#636E72]">
        본 진단 결과는 참고용이며 법률 자문이 아닙니다. 정확한 판단은 변호사 상담을 받으시기 바랍니다.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────
   메인 페이지
   ─────────────────────────────────────────── */
export default function SelfDiagnosisPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [showResult, setShowResult] = useState(false);

  // 파비콘 + 타이틀 변경
  useEffect(() => {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = '/favicon-self.svg';
    document.title = '자가진단 — 회생클릭';
    return () => {
      if (link) link.href = '/vite.svg';
      document.title = '회생원클릭 - 법률사무소 자동문서생성';
    };
  }, []);

  // 현재 스텝의 유효성 검사
  const isStepValid = useCallback((): boolean => {
    switch (step) {
      case 0: return answers.incomeType !== null;
      case 1: return true; // 슬라이더는 항상 유효 (0도 허용)
      case 2: return answers.familySize !== null;
      case 3: return true;
      case 4:
        if (answers.hasSecuredDebt === null) return false;
        if (answers.hasSecuredDebt === true && answers.securedDebtAmount === 0) return false;
        return true;
      case 5: return answers.debtCauses.length > 0;
      case 6:
        if (answers.hasPriorDischarge === null) return false;
        if (answers.hasPriorDischarge === true && answers.priorDischargeYear === null) return false;
        return true;
      default: return false;
    }
  }, [step, answers]);

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      setShowResult(true);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleReset = () => {
    setAnswers(INITIAL_ANSWERS);
    setStep(0);
    setShowResult(false);
  };

  const diagnosis = showResult ? diagnose(answers) : null;

  const renderStep = () => {
    switch (step) {
      case 0: return <Step1 answers={answers} setAnswers={setAnswers} />;
      case 1: return <Step2 answers={answers} setAnswers={setAnswers} />;
      case 2: return <Step3 answers={answers} setAnswers={setAnswers} />;
      case 3: return <Step4 answers={answers} setAnswers={setAnswers} />;
      case 4: return <Step5 answers={answers} setAnswers={setAnswers} />;
      case 5: return <Step6 answers={answers} setAnswers={setAnswers} />;
      case 6: return <Step7 answers={answers} setAnswers={setAnswers} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontSize: '16px', lineHeight: '1.7' }}>
      {/* 상단 네비게이션 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button
            onClick={() => navigate('/self')}
            className="flex items-center gap-2 text-[#636E72] hover:text-[#2D3436] transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">돌아가기</span>
          </button>
          <Link to="/self" className="flex items-center gap-2">
            <Heart size={22} className="text-[#48B5A0]" />
            <span className="text-lg font-bold text-[#2D3436]">회생클릭</span>
          </Link>
          <div className="w-[72px]" /> {/* 균형 맞추기 */}
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <div className="mx-auto max-w-lg px-5 py-8">
        {!showResult ? (
          <>
            {/* 진행률 바 */}
            <ProgressBar step={step} />

            {/* 질문 카드 */}
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
              {renderStep()}
            </div>

            {/* 네비게이션 버튼 */}
            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-6 py-4 font-semibold text-[#636E72] hover:border-[#48B5A0]/40 hover:text-[#2D3436] transition-all"
                >
                  <ArrowLeft size={16} />
                  이전
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 font-semibold transition-all ${
                  isStepValid()
                    ? 'bg-[#48B5A0] text-white hover:bg-[#3da08d] shadow-lg shadow-[#48B5A0]/25'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step === TOTAL_STEPS - 1 ? '진단 결과 보기' : '다음'}
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          diagnosis && (
            <ResultScreen diagnosis={diagnosis} answers={answers} onReset={handleReset} />
          )
        )}
      </div>
    </div>
  );
}
