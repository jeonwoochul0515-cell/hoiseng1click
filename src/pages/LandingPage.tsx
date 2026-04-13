import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  Phone,
  Database,
  FileText,
  Users,
  ShieldCheck,
  Building2,
  Star,
  Award,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  Zap,
} from 'lucide-react';
import { PLAN_CONFIGS, type PlanType } from '@/types/subscription';

/* ───────────────────────────────────────────
   Nav — sticky 헤더 (전화번호 상시 노출)
   ─────────────────────────────────────────── */
function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 bg-[#0D1B2A] border-b border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        {/* 로고 */}
        <Link to="/" className="flex items-center gap-2">
          <Scale size={24} className="text-brand-gold" />
          <span className="text-xl font-bold text-brand-gold">회생원클릭</span>
        </Link>

        {/* 우측: 전화 + CTA */}
        <div className="flex items-center gap-4">
          <a
            href="tel:1660-4452"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <Phone size={18} />
            <span className="hidden sm:inline text-base font-medium">1660-4452</span>
            <span className="sm:hidden text-base font-medium">전화</span>
          </a>
          <Link
            to="/login"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-gold px-5 py-2.5 text-base font-bold text-black hover:bg-[#b8973e] transition-colors"
          >
            무료체험 시작
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ───────────────────────────────────────────
   Hero 섹션
   ─────────────────────────────────────────── */
function HeroSection() {
  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-[#0D1B2A] px-5 py-20 md:py-28">
      <div className="mx-auto max-w-4xl text-center">
        {/* 상단 뱃지 */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-5 py-2">
          <Zap size={16} className="text-brand-gold" />
          <span className="text-base text-brand-gold font-medium">
            2025년 개인회생 신청 13만건 돌파 — 역대 최고치
          </span>
        </div>

        {/* 메인 헤드라인 */}
        <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
          서류 작성에<br className="md:hidden" /> 하루를 쓰셨나요?
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-gray-300 md:text-2xl">
          CODEF 1회 인증으로<br className="sm:hidden" /> 법원 제출 서류 6종을 자동 완성합니다
        </p>

        {/* CTA 버튼 */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/login"
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-lg bg-brand-gold px-8 py-4 text-lg font-bold text-black hover:bg-[#b8973e] transition-colors sm:w-auto"
          >
            14일 무료체험 시작
          </Link>
          <button
            onClick={scrollToFeatures}
            className="inline-flex min-h-[56px] w-full items-center justify-center rounded-lg border-2 border-white/30 px-8 py-4 text-lg font-medium text-white hover:border-white hover:bg-white/5 transition-colors sm:w-auto"
          >
            기능 살펴보기
          </button>
        </div>

        {/* 신뢰 수치 */}
        <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-6">
          {[
            { icon: Users, label: '사용 법무사', value: '200+' },
            { icon: FileText, label: '생성 서류', value: '15,000+' },
            { icon: Clock, label: '평균 절감', value: '4.2시간' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon size={24} className="mx-auto mb-2 text-brand-gold" />
              <p className="text-2xl font-bold text-white md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-base text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   신뢰 배지 섹션
   ─────────────────────────────────────────── */
function TrustBadgeSection() {
  const badges = [
    { icon: ShieldCheck, label: '개인정보보호법 적합' },
    { icon: Building2, label: '대한법무사협회 등록' },
    { icon: Award, label: '법률신문 보도' },
    { icon: Star, label: '만족도 4.9 / 5.0' },
  ];

  return (
    <section className="border-y border-gray-200 bg-[#F8F9FA] px-5 py-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 md:gap-12">
        {badges.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <b.icon size={24} className="shrink-0 text-[#0D1B2A]" />
            <span className="text-base font-medium text-gray-700">{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   핵심 기능 섹션
   ─────────────────────────────────────────── */
function FeaturesSection() {
  const features = [
    {
      icon: Database,
      title: '1회 인증으로 금융정보 자동수집',
      desc: '코드에프(CODEF) 연동으로 은행, 카드, 보험 채무 현황을 한 번에 조회합니다. 의뢰인에게 서류를 요청할 필요가 없습니다.',
    },
    {
      icon: FileText,
      title: '법원 제출 서류 6종 자동완성',
      desc: '채권자 목록, 재산 목록, 수입지출 목록, 변제계획안, 신청서, 진술서를 HWP/DOCX로 즉시 생성합니다.',
    },
    {
      icon: Users,
      title: '의뢰인 자기입력 링크 발송',
      desc: '링크 하나를 보내면 의뢰인이 직접 정보를 입력합니다. 전화 통화 시간을 대폭 줄여줍니다.',
    },
  ];

  return (
    <section id="features" className="bg-white px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-[#0D1B2A] md:text-4xl">
          핵심 기능 3가지
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-500">
          복잡한 개인회생 서류 작성, 이제 클릭 몇 번이면 끝납니다
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border-2 border-gray-100 p-8 transition-shadow hover:shadow-lg"
            >
              <f.icon size={40} className="mb-5 text-brand-gold" />
              <h3 className="text-xl font-bold text-[#0D1B2A]">{f.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   Before / After 비교 섹션
   ─────────────────────────────────────────── */
function BeforeAfterSection() {
  const before = [
    '의뢰인 정보 수동 입력 — 건당 2~3시간',
    '은행별 잔액 확인 전화 10건 이상',
    'HWP 파일 직접 편집, 오탈자 위험',
    '파일 관리 엑셀/폴더로 수작업',
  ];
  const after = [
    '의뢰인 링크 발송 → 자동 입력',
    'CODEF 1회 인증 → 전 금융기관 자동조회',
    '클릭 한 번으로 HWP/DOCX 자동 생성',
    '클라우드 사건관리로 언제 어디서나 접근',
  ];

  return (
    <section className="bg-[#F3F4F6] px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-[#0D1B2A] md:text-4xl">
          기존 방식 vs 회생원클릭
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Before */}
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-8">
            <h3 className="mb-6 text-xl font-bold text-red-700">기존 방식</h3>
            <ul className="space-y-4">
              {before.map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <XCircle size={22} className="mt-0.5 shrink-0 text-red-400" />
                  <span className="text-base leading-relaxed text-gray-700">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="rounded-xl border-2 border-brand-gold bg-brand-gold/5 p-8">
            <h3 className="mb-6 text-xl font-bold text-[#1B5E3B]">회생원클릭</h3>
            <ul className="space-y-4">
              {after.map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <CheckCircle size={22} className="mt-0.5 shrink-0 text-brand-gold" />
                  <span className="text-base leading-relaxed text-gray-700">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   법무사 후기 섹션
   ─────────────────────────────────────────── */
function TestimonialsSection() {
  const testimonials = [
    {
      stars: 5,
      text: '서류 작성 시간이 반으로 줄었습니다. CODEF 인증 한 번이면 채무 현황이 자동으로 정리되니 정말 편합니다.',
      name: '김OO 법무사',
      location: '서울 강남 · 사용 6개월 · 서류 230건',
    },
    {
      stars: 4,
      text: '처음에는 CODEF 연동이 낯설었는데, 한 번 해보니 금방 익숙해졌습니다. 의뢰인 자기입력 기능이 특히 좋습니다.',
      name: '이OO 법무사',
      location: '부산 해운대 · 사용 3개월 · 서류 89건',
    },
    {
      stars: 5,
      text: '14일 체험만 해봤는데 바로 결제했습니다. HWP 파일이 법원 양식 그대로 나와서 수정할 게 거의 없어요.',
      name: '박OO 법무사',
      location: '대구 수성 · 사용 4개월 · 서류 156건',
    },
  ];

  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-[#0D1B2A] md:text-4xl">
          실제 법무사 사용 후기
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-gray-200 p-8"
            >
              {/* 별점 */}
              <div className="mb-4 flex items-center gap-1">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={20} className="fill-brand-gold text-brand-gold" />
                ))}
                <span className="ml-2 text-base font-medium text-gray-600">
                  {t.stars}.0
                </span>
              </div>
              {/* 후기 */}
              <p className="text-base leading-loose text-gray-700">"{t.text}"</p>
              {/* 작성자 */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="text-base font-semibold text-gray-900">{t.name}</p>
                <p className="text-base text-gray-500">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   요금제 섹션
   ─────────────────────────────────────────── */
function PricingSection() {
  const planOrder: PlanType[] = ['starter', 'pro', 'enterprise'];
  const cardBorder: Record<PlanType, string> = {
    starter: 'border-gray-200',
    pro: 'border-brand-gold',
    enterprise: 'border-purple-500',
  };

  return (
    <section className="bg-[#F3F4F6] px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-[#0D1B2A] md:text-4xl">
          요금제
        </h2>
        <p className="mx-auto mt-4 text-center text-lg text-gray-500">
          연간 결제 시 2개월 무료 (약 17% 할인) · 14일 무료체험 · 카드 등록 불필요
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {planOrder.map((key) => {
            const plan = PLAN_CONFIGS[key];
            const isPro = key === 'pro';

            return (
              <div
                key={key}
                className={`relative flex flex-col rounded-xl border-2 bg-white p-8 ${cardBorder[key]} ${
                  isPro ? 'shadow-lg md:-mt-4 md:mb-4' : ''
                }`}
              >
                {/* 인기 뱃지 */}
                {isPro && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-gold px-4 py-1.5 text-base font-bold text-black">
                    가장 인기
                  </span>
                )}

                <h3 className="text-xl font-bold text-[#0D1B2A]">{plan.name}</h3>

                {/* 가격 */}
                <div className="mt-4">
                  <span className="text-4xl font-bold text-[#0D1B2A]">
                    {plan.price === Infinity
                      ? '협의'
                      : `${plan.price.toLocaleString()}원`}
                  </span>
                  <span className="text-base text-gray-500"> / 월</span>
                </div>

                {/* 기능 리스트 */}
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3">
                      <Check size={18} className="shrink-0 text-brand-gold" />
                      <span className="text-base text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {key === 'enterprise' ? (
                  <a
                    href="tel:1660-4452"
                    className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg border-2 border-gray-300 px-6 py-3 text-base font-bold text-gray-700 transition-colors hover:border-brand-gold hover:text-brand-gold"
                  >
                    영업팀에 문의하기
                  </a>
                ) : (
                  <Link
                    to="/login"
                    className={`mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg px-6 py-3 text-base font-bold transition-colors ${
                      isPro
                        ? 'bg-brand-gold text-black hover:bg-[#b8973e]'
                        : 'border-2 border-gray-300 text-gray-700 hover:border-brand-gold hover:text-brand-gold'
                    }`}
                  >
                    무료체험 시작
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   FAQ 섹션
   ─────────────────────────────────────────── */
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: 'CODEF 연동이 어렵지 않나요?',
      a: '전혀 어렵지 않습니다. 의뢰인이 본인 인증을 1회 진행하면 은행, 카드, 보험 정보가 자동으로 수집됩니다. 법무사님이 별도로 설정할 것은 없습니다.',
    },
    {
      q: '법원에 실제로 제출할 수 있는 파일인가요?',
      a: '네. 전국 법원에서 사용하는 공식 양식을 그대로 반영한 HWP/DOCX 파일을 생성합니다. 서울회생법원, 수원회생법원 등 법원별 양식 차이도 반영되어 있습니다.',
    },
    {
      q: '의뢰인 개인정보는 어떻게 보호되나요?',
      a: '주민등록번호 등 민감정보는 AES-256으로 암호화하여 저장합니다. 개인정보보호법에 따른 안전성 확보조치 기준을 준수하며, 모든 접근 이력이 기록됩니다.',
    },
    {
      q: '카드 등록 없이 무료체험이 가능한가요?',
      a: '네. 이메일만으로 14일간 PRO 플랜의 모든 기능을 무료로 사용할 수 있습니다. 체험 기간이 끝나면 자동 결제되지 않으니 부담 없이 시작하세요.',
    },
    {
      q: '여러 명이 함께 사용할 수 있나요?',
      a: 'PRO 플랜은 3명, ENTERPRISE 플랜은 무제한으로 사용할 수 있습니다. 직원별로 권한을 다르게 설정할 수도 있습니다.',
    },
  ];

  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-3xl font-bold text-[#0D1B2A] md:text-4xl">
          자주 묻는 질문
        </h2>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="rounded-xl border border-gray-200 bg-white">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex min-h-[56px] w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-lg font-semibold text-[#0D1B2A]">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp size={22} className="shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown size={22} className="shrink-0 text-gray-400" />
                )}
              </button>
              {openIndex === i && (
                <div className="border-t border-gray-100 px-6 pb-6 pt-4">
                  <p className="text-base leading-loose text-gray-600">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   최종 CTA + Footer
   ─────────────────────────────────────────── */
function FinalCTASection() {
  return (
    <section className="bg-[#0D1B2A] px-5 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold text-white md:text-4xl">
          지금 바로 시작해보세요
        </h2>
        <p className="mt-4 text-lg text-gray-300">
          14일 무료, 카드 등록 불필요 — 언제든 해지 가능
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex min-h-[56px] items-center justify-center rounded-lg bg-brand-gold px-10 py-4 text-xl font-bold text-black hover:bg-[#b8973e] transition-colors"
        >
          무료체험 시작하기
        </Link>

        {/* 전화 안내 */}
        <div className="mt-10">
          <a href="tel:1660-4452" className="inline-flex items-center gap-2 text-lg text-gray-300 hover:text-white transition-colors">
            <Phone size={20} />
            <span>도움이 필요하시면 전화주세요: 1660-4452</span>
          </a>
          <p className="mt-2 text-base text-gray-500">평일 09:00 ~ 18:00</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mx-auto mt-16 max-w-5xl border-t border-white/10 pt-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* 좌측: 회사 정보 */}
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-brand-gold" />
            <span className="text-base text-gray-400">회생원클릭</span>
          </div>

          {/* 우측: 링크 */}
          <div className="flex items-center gap-6 text-base text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-gray-300 transition-colors">이용약관</a>
            <a href="#" className="hover:text-gray-300 transition-colors">사업자정보</a>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-gray-600">
          &copy; 2026 회생원클릭. All rights reserved.
        </p>
      </footer>
    </section>
  );
}

/* ───────────────────────────────────────────
   메인 LandingPage
   ─────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ fontSize: '18px', lineHeight: '1.8' }}>
      <LandingNav />
      <HeroSection />
      <TrustBadgeSection />
      <FeaturesSection />
      <BeforeAfterSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
    </div>
  );
}
