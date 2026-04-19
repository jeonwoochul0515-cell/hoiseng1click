import { useState } from 'react';
import {
  MapPin, ClipboardList, ArrowRight, ChevronDown, ChevronUp,
  Building2, FileText, CreditCard, Receipt, HelpCircle,
  Monitor, Calculator, ShieldBan, FileEdit, Gavel, Users,
  Award, Banknote, BadgeCheck, HeartHandshake, AlertTriangle,
} from 'lucide-react';

// Step 1 방문 접수 상세
const VISIT_DETAILS = [
  '평일 09:00~18:00 (점심시간 12:00~13:00 제외)',
  '혼잡한 월요일/금요일보다 화~목요일 오전 방문 권장',
  '법원 건물 안내데스크에서 "개인회생 접수"라고 말씀하시면 됩니다',
];

// Step 1 전자소송 접수 상세
const ECOURT_DETAILS = [
  '대법원 전자소송 포털 (ecfs.scourt.go.kr) 접속',
  '24시간 접수 가능',
  '공동인증서(구 공인인증서) 필요',
  '인지대 10% 할인 (30,000원 → 27,000원)',
  '송달료 6회분 초과 면제',
  '서류제출 > 개인회생 메뉴에서 진행',
];

// 접수 절차 단계
const STEPS = [
  {
    step: 1,
    icon: Building2,
    title: '접수 방법',
    description: '방문 접수 또는 전자소송으로 접수합니다.',
    details: [], // Step 1은 탭 UI로 별도 렌더링
    hasTab: true,
  },
  {
    step: 2,
    icon: FileText,
    title: '서류 제출',
    description: '준비한 서류를 접수창구에 제출합니다.',
    details: [
      '신청서 및 첨부서류 각 1부씩 + 부본 1부 (상대방용)',
      '서류는 A4 크기로 출력하여 순서대로 정리',
      '담당 직원이 서류를 확인하고 부족한 부분을 안내해 줍니다',
      '접수 전 서류 사본을 꼭 보관해 두세요',
    ],
  },
  {
    step: 3,
    icon: CreditCard,
    title: '수수료 납부',
    description: '인지대와 송달료를 납부합니다.',
    details: [
      '인지대: 30,000원 (전자소송 시 27,000원)',
      '송달료: (기본 10 + 채권자 수 x 8) x 5,500원',
      '법원 내 은행 창구 또는 무인발매기에서 수입인지 구매 가능',
      '영수증을 꼭 받으세요',
    ],
  },
  {
    step: 4,
    icon: Receipt,
    title: '접수증 수령',
    description: '접수가 완료되면 접수증(사건번호)을 받습니다.',
    details: [
      '사건번호 형식: 20XX회단XXXX (예: 2026회단1234)',
      '접수증에 담당 재판부 번호가 기재됩니다',
      '사건번호는 향후 모든 절차에 필요하니 반드시 보관하세요',
      '보정명령까지 약 1~4주, 개시결정까지 1~5개월 (법원에 따라 다를 수 있습니다)',
    ],
  },
];

// 관할 법원 안내
const COURT_DISTRICTS = [
  { region: '서울', court: '서울회생법원', address: '서울 서초구 법원로 3', phone: '02-530-1114' },
  { region: '경기 남부', court: '수원지방법원', address: '경기 수원시 영통구 법조로 20', phone: '031-210-1114' },
  { region: '경기 북부', court: '의정부지방법원', address: '경기 의정부시 녹양로 80', phone: '031-820-1114' },
  { region: '인천', court: '인천지방법원', address: '인천 미추홀구 석정로 78', phone: '032-860-1114' },
  { region: '부산', court: '부산지방법원', address: '부산 연제구 법원로 31', phone: '051-590-1114' },
  { region: '대구', court: '대구지방법원', address: '대구 수성구 동대구로 364', phone: '053-757-1114' },
  { region: '대전', court: '대전지방법원', address: '대전 서구 둔산북로 78', phone: '042-480-1114' },
  { region: '광주', court: '광주지방법원', address: '광주 동구 준법로 7-12', phone: '062-239-1114' },
];

// 접수 후 절차 단계
const POST_STEPS = [
  {
    step: 5,
    icon: ShieldBan,
    title: '금지명령 발령',
    timeline: '접수 후 3~7일',
    description: '접수 후 약 1주 내 금지명령이 발령됩니다.',
    details: [
      '이때부터 독촉, 추심, 가압류가 중단됩니다',
      '이자도 카드값도 안 내도 됩니다',
      '금지명령 발령 사실을 채권자에게 통지할 수 있습니다',
    ],
    warning: null,
  },
  {
    step: 6,
    icon: FileEdit,
    title: '보정 권고',
    timeline: '1~5회',
    description: '법원이 서류 보완을 요청합니다.',
    details: [
      '법원이 부족하거나 수정이 필요한 부분을 안내합니다',
      '14일 이내 답변이 필수입니다',
      'SELF+ 플랜: 보정 대응 가이드를 제공합니다',
      '보정명령은 일반적인 절차이니 걱정하지 마세요',
    ],
    warning: null,
  },
  {
    step: 7,
    icon: Gavel,
    title: '개시결정',
    timeline: '접수 후 3~5개월',
    description: '보정 완료 후 개시결정이 내려집니다.',
    details: [
      '이때부터 변제금 납부가 시작됩니다',
      '개시결정문은 법원에서 송달됩니다',
    ],
    warning: null,
  },
  {
    step: 8,
    icon: Users,
    title: '채권자 집회',
    timeline: '개시결정 후 2~3개월',
    description: '변제계획에 대해 설명하는 자리입니다.',
    details: [
      '대부분의 채권자는 출석하지 않으므로 크게 걱정하지 않으셔도 됩니다',
      '보통 10~20분이면 끝납니다',
      '준비물: 신분증, 사건번호',
    ],
    warning: '본인이 반드시 출석해야 합니다',
  },
  {
    step: 9,
    icon: Award,
    title: '인가결정',
    timeline: '채권자 집회 후',
    description: '법원이 변제계획을 최종 인가합니다.',
    details: [
      '채권자 집회 후 법원이 변제계획을 최종 인가합니다',
      '인가 후 확정된 변제계획대로 납부하면 됩니다',
    ],
    warning: null,
  },
  {
    step: 10,
    icon: Banknote,
    title: '변제금 납부',
    timeline: '3~5년',
    description: '법원이 부여한 가상계좌로 매월 이체합니다.',
    details: [
      '월급 받으면 바로 이체하세요',
      '변제금을 못 낼 상황이 되면 즉시 법원에 변제계획 변경을 신청하세요',
    ],
    warning: '3회 밀리면 폐지될 수 있습니다 -- 반드시 기한 내 납부하세요',
  },
  {
    step: 11,
    icon: BadgeCheck,
    title: '면책결정',
    timeline: '변제 완료 후',
    description: '면책결정 = 남은 채무 탕감이 확정됩니다.',
    details: [
      '변제 완료 후 면책신청서를 제출합니다',
      '면책결정이 나면 남은 채무가 탕감됩니다',
      '비면책채권(세금, 벌금, 양육비)은 면책되지 않습니다',
    ],
    warning: null,
  },
  {
    step: 12,
    icon: HeartHandshake,
    title: '신용회복',
    timeline: '면책 후',
    description: '정상적인 금융생활로 복귀합니다.',
    details: [
      '면책 후 법원이 신용정보원에 통지합니다',
      '공공기록(회생)이 삭제됩니다',
      '1~2년 후: 소액 신용카드/대출 가능',
      '3~5년 후: 주택담보대출 가능',
      '정상적인 금융생활로 복귀할 수 있습니다',
    ],
    warning: null,
  },
];

// FAQ
const FAQ_ITEMS = [
  {
    q: '보정명령이 뭔가요?',
    a: '보정명령은 법원이 제출된 서류에 부족하거나 수정이 필요한 부분이 있을 때 보완을 요구하는 명령입니다. 보통 접수 후 1~2주 내에 나오며, 지정된 기간(보통 14일) 내에 보정하면 됩니다. 보정명령이 나왔다고 걱정할 필요는 없습니다 -- 대부분의 사건에서 1~2회 보정은 일반적입니다.',
  },
  {
    q: '개인회생 접수부터 인가까지 얼마나 걸리나요?',
    a: '통상적으로 접수부터 개시결정까지 1~2개월, 개시결정부터 인가결정까지 3~6개월 정도 소요됩니다. 법원과 사건에 따라 차이가 있으며, 보정 횟수에 따라 달라질 수 있습니다.',
  },
  {
    q: '변호사/법무사 없이 직접 신청해도 되나요?',
    a: '네, 개인회생은 본인이 직접 신청(본인소송)할 수 있습니다. 다만 서류 작성과 절차가 복잡할 수 있으므로, 회생원클릭 서류 자동생성 서비스를 활용하시면 훨씬 수월하게 진행하실 수 있습니다.',
  },
  {
    q: '접수비용은 얼마인가요?',
    a: '인지대 30,000원(전자소송 시 27,000원) + 송달료(채권자 수에 따라 약 15만~70만원)가 필요합니다. 법률구조공단을 통해 인지대/송달료 면제를 받을 수도 있습니다.',
  },
  {
    q: '접수 후 채권자의 추심이 멈추나요?',
    a: '개시결정이 내려지면 "중지명령"이 함께 발령되어 채권자의 추심행위(전화, 문자, 방문 등)가 법적으로 금지됩니다. 개시결정 전이라도 법원에 중지명령 신청을 별도로 할 수 있습니다.',
  },
  {
    q: '준비물 중 빠진 서류가 있으면 어떻게 되나요?',
    a: '접수 자체는 가능하지만, 법원에서 보정명령을 통해 부족한 서류의 보완을 요구할 수 있습니다. 가능하면 모든 서류를 준비해서 방문하시는 것이 좋습니다.',
  },
  {
    q: '채권자 집회에 꼭 가야 하나요?',
    a: '네, 본인 출석이 필수입니다. 대부분 10~20분이면 끝납니다. 변제계획에 대해 간단히 설명하는 자리이며, 대부분의 채권자는 출석하지 않으므로 크게 걱정하지 않으셔도 됩니다.',
  },
  {
    q: '변제금을 못 내면 어떻게 되나요?',
    a: '3회 밀리면 폐지될 수 있습니다. 어려운 상황이면 즉시 법원에 변제계획 변경을 신청하세요. 변제계획 변경은 소득 감소, 질병 등 정당한 사유가 있으면 인정됩니다.',
  },
  {
    q: '면책 후 대출은 언제 가능한가요?',
    a: '면책 후 1~2년부터 소액 대출이 가능하고, 3~5년 후 주택담보대출도 가능합니다. 면책 후 신용정보원에 통지되면 공공기록이 삭제되며, 정상적인 금융생활로 점진적으로 복귀할 수 있습니다.',
  },
];

// 접수 준비물
const PREPARATION_ITEMS = [
  { label: '개인회생 신청서', desc: '회생원클릭에서 생성' },
  { label: '채권자 목록', desc: '회생원클릭에서 생성' },
  { label: '재산 목록', desc: '회생원클릭에서 생성' },
  { label: '수입지출 목록', desc: '회생원클릭에서 생성' },
  { label: '변제계획안', desc: '회생원클릭에서 생성' },
  { label: '주민등록등본', desc: '정부24에서 발급' },
  { label: '가족관계증명서', desc: '대법원 전자가족관계등록시스템' },
  { label: '소득금액증명원', desc: '홈택스에서 발급' },
  { label: '재직증명서', desc: '직장에서 발급' },
  { label: '통장 거래내역 (최근 1년)', desc: '인터넷뱅킹에서 출력' },
  { label: '신분증 (주민등록증)', desc: '접수 시 본인 확인용' },
  { label: '도장 또는 서명', desc: '서류 서명용' },
];

export default function CourtGuidePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openPostStep, setOpenPostStep] = useState<number | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [filingTab, setFilingTab] = useState<'visit' | 'ecourt'>('visit');
  const [creditorCount, setCreditorCount] = useState<number>(5);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  // 비용 계산
  const stampFee = 30000;
  const stampFeeEcourt = 27000;
  const deliveryFee = (10 + creditorCount * 8) * 5500;
  const totalFee = stampFee + deliveryFee;
  const totalFeeEcourt = stampFeeEcourt + deliveryFee;

  const formatNumber = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">법원 접수 가이드</h1>
        <p className="mt-1 text-sm text-gray-500">개인회생 신청 접수 절차를 안내합니다</p>
      </div>

      {/* 관할 법원 찾기 */}
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <MapPin size={20} className="text-brand-gold" />
          <h2 className="text-lg font-semibold text-gray-900">관할 법원 찾기</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          주소지(주민등록상 거주지) 기준으로 관할 법원이 정해집니다. 해당 지역을 선택하세요.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COURT_DISTRICTS.map((c) => (
            <button
              key={c.region}
              onClick={() => setSelectedRegion(selectedRegion === c.region ? null : c.region)}
              className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                selectedRegion === c.region
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {c.region}
            </button>
          ))}
        </div>

        {selectedRegion && (() => {
          const court = COURT_DISTRICTS.find((c) => c.region === selectedRegion);
          if (!court) return null;
          return (
            <div className="mt-4 rounded-lg bg-brand-gold/5 border border-brand-gold/20 p-4">
              <p className="text-sm font-bold text-gray-900">{court.court}</p>
              <p className="mt-1 text-sm text-gray-600">{court.address}</p>
              <p className="mt-1 text-sm text-gray-500">대표전화: {court.phone}</p>
            </div>
          );
        })()}

        <p className="mt-3 text-xs text-gray-400">
          * 위 목록은 주요 법원만 안내합니다. 정확한 관할은{' '}
          <a href="https://www.scourt.go.kr" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            대법원 홈페이지
          </a>
          에서 확인하세요.
        </p>
      </div>

      {/* 접수 준비물 체크리스트 */}
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList size={20} className="text-brand-gold" />
          <h2 className="text-lg font-semibold text-gray-900">접수 준비물</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PREPARATION_ITEMS.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gold/10 text-xs font-bold text-brand-gold">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 접수 절차 단계별 설명 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">접수 절차</h2>
        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isStep1 = step.step === 1;
            const isStep3 = step.step === 3;
            const currentDetails = isStep1
              ? (filingTab === 'visit' ? VISIT_DETAILS : ECOURT_DETAILS)
              : step.details;

            return (
              <div key={step.step} className="relative flex gap-4">
                {/* 세로 연결선 */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[23px] top-[48px] h-[calc(100%-24px)] w-0.5 bg-gray-200" />
                )}
                {/* 아이콘 */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gold text-white">
                  <Icon size={22} />
                </div>
                {/* 내용 */}
                <div className={`flex-1 ${i < STEPS.length - 1 ? 'pb-8' : 'pb-0'}`}>
                  <p className="text-sm font-bold text-gray-900">
                    Step {step.step}. {step.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{step.description}</p>

                  {/* Step 1: 탭 UI */}
                  {isStep1 && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setFilingTab('visit')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          filingTab === 'visit'
                            ? 'bg-brand-gold text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Building2 size={12} className="mr-1 inline-block" />
                        방문 접수
                      </button>
                      <button
                        onClick={() => setFilingTab('ecourt')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          filingTab === 'ecourt'
                            ? 'bg-brand-gold text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Monitor size={12} className="mr-1 inline-block" />
                        전자소송
                      </button>
                    </div>
                  )}

                  <ul className="mt-2 space-y-1">
                    {currentDetails.map((d, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-gray-500">
                        <ArrowRight size={10} className="mt-0.5 shrink-0 text-brand-gold" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Step 3: 비용 계산기 */}
                  {isStep3 && (
                    <div className="mt-4 rounded-lg border border-brand-gold/20 bg-brand-gold/5 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Calculator size={16} className="text-brand-gold" />
                        <span className="text-sm font-semibold text-gray-900">비용 계산기</span>
                      </div>
                      <div className="mb-3 flex items-center gap-3">
                        <label className="text-sm text-gray-700">채권자 수:</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={creditorCount}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1 && v <= 99) setCreditorCount(v);
                          }}
                          className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-center focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                        />
                        <span className="text-sm text-gray-500">명</span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>인지대</span>
                          <span>
                            {formatNumber(stampFee)}원
                            <span className="ml-1 text-xs text-brand-gold">(전자소송: {formatNumber(stampFeeEcourt)}원)</span>
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>송달료</span>
                          <span>
                            (10 + {creditorCount} x 8) x 5,500 = {formatNumber(deliveryFee)}원
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-900">
                          <span>합계</span>
                          <span>{formatNumber(totalFee)}원</span>
                        </div>
                        <div className="flex justify-between text-xs text-brand-gold font-medium">
                          <span>전자소송 시</span>
                          <span>{formatNumber(totalFeeEcourt)}원</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 접수 후 절차 안내 */}
      <div className="rounded-xl bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">접수 후 절차 안내</h2>
        <p className="mb-6 text-sm text-gray-500">접수 완료 후 면책까지의 전체 과정을 안내합니다</p>
        <div className="space-y-0">
          {POST_STEPS.map((ps, i) => {
            const Icon = ps.icon;
            const isOpen = openPostStep === ps.step;
            const hasWarning = !!ps.warning;

            return (
              <div key={ps.step} className="relative flex gap-4">
                {/* 세로 연결선 */}
                {i < POST_STEPS.length - 1 && (
                  <div className="absolute left-[23px] top-[48px] h-[calc(100%-24px)] w-0.5 bg-gray-200" />
                )}
                {/* 아이콘 */}
                <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${
                  hasWarning ? 'bg-amber-500' : 'bg-brand-gold'
                }`}>
                  <Icon size={22} />
                </div>
                {/* 내용 */}
                <div className={`flex-1 ${i < POST_STEPS.length - 1 ? 'pb-8' : 'pb-0'}`}>
                  <button
                    onClick={() => setOpenPostStep(isOpen ? null : ps.step)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        Step {ps.step}. {ps.title}
                        <span className="ml-2 text-xs font-normal text-gray-400">{ps.timeline}</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{ps.description}</p>
                    </div>
                    {isOpen
                      ? <ChevronUp size={16} className="shrink-0 text-gray-400" />
                      : <ChevronDown size={16} className="shrink-0 text-gray-400" />
                    }
                  </button>

                  {/* 경고 배지 (항상 표시) */}
                  {hasWarning && (
                    <div className={`mt-2 flex items-start gap-2 rounded-lg p-3 ${
                      ps.step === 10
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-amber-50 border border-amber-200'
                    }`}>
                      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${
                        ps.step === 10 ? 'text-red-500' : 'text-amber-500'
                      }`} />
                      <span className={`text-xs font-medium ${
                        ps.step === 10 ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        {ps.warning}
                      </span>
                    </div>
                  )}

                  {/* 접이식 상세 */}
                  {isOpen && (
                    <ul className="mt-3 space-y-1">
                      {ps.details.map((d, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-gray-500">
                          <ArrowRight size={10} className="mt-0.5 shrink-0 text-brand-gold" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 자주 묻는 질문 */}
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle size={20} className="text-brand-gold" />
          <h2 className="text-lg font-semibold text-gray-900">자주 묻는 질문</h2>
        </div>
        <div className="space-y-2">
          {FAQ_ITEMS.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200">
              <button
                onClick={() => toggleFaq(idx)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-gray-900">{item.q}</span>
                {openFaq === idx
                  ? <ChevronUp size={16} className="shrink-0 text-gray-400" />
                  : <ChevronDown size={16} className="shrink-0 text-gray-400" />
                }
              </button>
              {openFaq === idx && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
