import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Heart,
  FileText,
  Clock,
  ArrowRight,
  Lock,
  MessageCircle,
  Sparkles,
  Phone,
  X,
} from 'lucide-react';

/* ───────────────────────────────────────────
   컬러 시스템 — 틸 + 웜화이트 + 코랄
   Primary:   #48B5A0 (틸)
   BG:        #FAFAF7 (웜화이트)
   CTA:       #E8836B (소프트 코랄)
   Text:      #2D3436 (다크 그레이)
   TextSub:   #636E72 (보조 그레이)
   CardBG:    #F5F0EB (카드 배경)
   ─────────────────────────────────────────── */

/* ───────────────────────────────────────────
   Nav
   ─────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link to="/self" className="flex items-center gap-2">
          <Heart size={22} className="text-[#48B5A0]" />
          <span className="text-lg font-bold text-[#2D3436]">회생클릭</span>
        </Link>
        <Link
          to="/login?mode=individual"
          className="inline-flex items-center rounded-full bg-[#E8836B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#d4725c] transition-colors"
        >
          시작하기
        </Link>
      </div>
    </nav>
  );
}

/* ───────────────────────────────────────────
   Hero — 공감과 희망
   ─────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#E8F5F0] via-[#F0FAF7] to-[#FAFAF7] px-5 py-20 md:py-28">
      {/* 배경 장식 — 부드러운 원형 */}
      <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-[#48B5A0]/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-[#E8836B]/10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl text-center">
        {/* 뱃지 */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#48B5A0]/30 bg-white px-4 py-2 shadow-sm">
          <Shield size={14} className="text-[#48B5A0]" />
          <span className="text-sm text-[#636E72]">변호사가 직접 설계한 AI 서비스</span>
        </div>

        {/* 메인 카피 — 위로와 공감 */}
        <h1 className="text-3xl font-bold leading-snug text-[#2D3436] md:text-5xl md:leading-snug">
          혼자서도 할 수 있습니다.
          <br />
          <span className="text-[#48B5A0]">빚에서 벗어나는 길</span>,
          <br />
          AI가 함께 걸어드릴게요.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#636E72] md:text-xl">
          복잡한 서류는 AI가 만들고,
          <br className="sm:hidden" />
          어려운 부분은 변호사가 봐드립니다.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-[#636E72]">
          법원에서 시키는 대로만 하면 됩니다. 그 서류, AI가 만들어드립니다.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            to="/self/diagnosis"
            className="inline-flex min-h-[56px] w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-[#E8836B] px-8 py-4 text-lg font-bold text-white shadow-lg shadow-[#E8836B]/25 hover:bg-[#d4725c] transition-all hover:shadow-xl hover:shadow-[#E8836B]/30"
          >
            무료로 가능 여부 확인하기
            <ArrowRight size={18} />
          </Link>
          <p className="flex items-center gap-1.5 text-sm text-[#636E72]">
            <Lock size={12} />
            구글 계정으로 10초 만에 시작 · 개인정보 암호화
          </p>
        </div>

        {/* 신뢰 수치 */}
        <div className="mx-auto mt-16 grid max-w-md grid-cols-3 gap-6">
          {[
            { value: '5종', label: '자동생성 서류' },
            { value: '10분', label: '평균 완성 시간' },
            { value: '1/15', label: '변호사 대비 비용' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-[#2D3436] md:text-3xl">{s.value}</p>
              <p className="mt-1 text-sm text-[#636E72]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   공감 섹션 — "이런 상황이신가요?"
   ─────────────────────────────────────────── */
function EmpathySection() {
  const situations = [
    '매달 이자만 내고 원금은 줄지 않아요',
    '독촉 전화 때문에 전화벨 소리가 무서워요',
    '변호사 비용 100만원이 없어서 못 하고 있어요',
    '어디서부터 시작해야 할지 모르겠어요',
    '가족에게 말하기가 너무 힘들어요',
    '보정명령이 오면 어떡하나 걱정돼요',
    '도박이나 투자로 진 빚이라 안 될 것 같아요',
  ];

  return (
    <section className="bg-[#FAFAF7] px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold text-[#2D3436] md:text-3xl">
          혹시, 이런 마음이신가요?
        </h2>
        <p className="mt-3 text-[#636E72]">
          괜찮습니다. 작년 한 해에만 15만 명이 같은 길을 걸었습니다.
        </p>

        <div className="mt-10 space-y-3 text-left">
          {situations.map((text) => (
            <div
              key={text}
              className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#48B5A0]/15">
                <Heart size={14} className="text-[#48B5A0]" />
              </div>
              <span className="text-[#2D3436]">{text}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-[#48B5A0]/10 p-6">
          <p className="text-lg font-medium text-[#2B8C8C]">
            하나라도 해당되신다면,
            <br />
            <strong>저희가 도울 수 있습니다.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   작동 원리 — 3단계
   ─────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    {
      num: '1',
      title: '본인 인증',
      desc: '공동인증서로 1회 본인확인. 2분이면 됩니다.',
      sub: '은행, 카드, 보험 정보가 자동으로 수집됩니다.',
      color: 'bg-[#48B5A0]',
    },
    {
      num: '2',
      title: '서류 자동 생성',
      desc: 'AI가 법원 제출 서류 5종을 만들어드립니다.',
      sub: '채권자목록, 재산목록, 수입지출, 신청서, 변제계획안',
      color: 'bg-[#2B8C8C]',
    },
    {
      num: '3',
      title: '법원 접수',
      desc: '어디에, 어떻게 제출하는지 단계별로 안내해드려요.',
      sub: '혼자서도 충분합니다. 어려우면 변호사가 도와드립니다.',
      color: 'bg-[#1a6b6b]',
    },
  ];

  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#2D3436] md:text-3xl">
            3단계면 끝납니다
          </h2>
          <p className="mt-3 text-[#636E72]">
            법률 지식 없어도 괜찮아요. 질문에 답하면 서류가 만들어집니다.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {steps.map((step, i) => (
            <div key={step.num} className="flex gap-5">
              {/* 숫자 + 연결선 */}
              <div className="flex flex-col items-center">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${step.color} text-lg font-bold text-white`}>
                  {step.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="mt-2 h-full w-0.5 bg-[#48B5A0]/20" />
                )}
              </div>

              {/* 내용 */}
              <div className="pb-8">
                <h3 className="text-xl font-bold text-[#2D3436]">{step.title}</h3>
                <p className="mt-2 text-[#2D3436]">{step.desc}</p>
                <p className="mt-1 text-sm text-[#636E72]">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   가격 비교 — 변호사 vs 회생클릭
   ─────────────────────────────────────────── */
function PricingSection() {
  return (
    <section className="bg-[#FAFAF7] px-5 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#2D3436] md:text-3xl">
            같은 서류, 다른 비용
          </h2>
          <p className="mt-3 text-[#636E72]">
            법적 효력은 동일합니다. 차이는 비용뿐입니다.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* 변호사 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-7">
            <p className="text-sm font-medium text-[#636E72]">일반 변호사 수임</p>
            <p className="mt-3 text-3xl font-bold text-[#2D3436]">150~200<span className="text-lg">만원</span></p>
            <div className="mt-6 space-y-3 text-sm text-[#636E72]">
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-gray-300" /> 서류 작성 대행</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-gray-300" /> 법원 대리 출석</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-gray-300" /> 보정명령 대응</div>
            </div>
          </div>

          {/* SELF */}
          <div className="rounded-2xl border-2 border-[#48B5A0] bg-white p-7 shadow-lg relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#48B5A0] px-4 py-1 text-xs font-bold text-white">
                <Sparkles size={12} /> 인기
              </span>
            </div>
            <p className="text-sm font-medium text-[#48B5A0]">SELF</p>
            <p className="mt-3 text-3xl font-bold text-[#2D3436]">9.9<span className="text-lg">만원</span></p>
            <p className="text-xs text-[#636E72]">1회 결제</p>
            <div className="mt-6 space-y-3 text-sm text-[#2D3436]">
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 서류 5종 자동 생성</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> CODEF 금융정보 수집</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 법원 접수 가이드</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 3개월간 수정 무제한</div>
            </div>
            <Link
              to="/login?mode=individual"
              className="mt-6 block w-full rounded-xl bg-[#E8836B] py-3 text-center text-sm font-bold text-white hover:bg-[#d4725c] transition-colors"
            >
              시작하기
            </Link>
          </div>

          {/* SELF+ */}
          <div className="rounded-2xl border border-gray-200 bg-white p-7">
            <p className="text-sm font-medium text-[#636E72]">SELF+</p>
            <p className="mt-3 text-3xl font-bold text-[#2D3436]">19.9<span className="text-lg">만원</span></p>
            <p className="text-xs text-[#636E72]">1회 결제</p>
            <div className="mt-6 space-y-3 text-sm text-[#2D3436]">
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> SELF 전체 기능</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 변호사 채팅 상담 5회</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 보정명령 대응 가이드</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 변호사 통화 1회</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-[#48B5A0]" /> 6개월간 수정 무제한</div>
            </div>
            <Link
              to="/login?mode=individual"
              className="mt-6 block w-full rounded-xl border-2 border-[#48B5A0] py-3 text-center text-sm font-bold text-[#48B5A0] hover:bg-[#48B5A0]/5 transition-colors"
            >
              시작하기
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-[#636E72]">
          서류 생성 전 100% 환불 · SELF에서 SELF+ 업그레이드 시 차액만 결제
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   신뢰 — 변호사 소개 + 후기
   ─────────────────────────────────────────── */
function TrustSection() {
  const reviews = [
    {
      text: '독촉 전화에 잠을 못 잤는데, 서류 만들고 나니까 마음이 놓였어요. 혼자서도 할 수 있구나 싶었습니다.',
      who: '인천 · 30대 자영업자',
    },
    {
      text: '변호사 상담비만 50만원이라고 해서 포기하려 했는데, 10만원도 안 들었어요. 진작 알았으면 좋았을 텐데.',
      who: '부산 · 40대 직장인',
    },
    {
      text: '법원 접수 가이드가 정말 상세해서 혼자 다녀왔습니다. 생각보다 어렵지 않았어요.',
      who: '대전 · 50대 주부',
    },
  ];

  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-4xl">
        {/* 변호사 소개 */}
        <div className="rounded-2xl bg-[#F5F0EB] p-8 md:p-10">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#48B5A0]/20">
              <Shield size={32} className="text-[#48B5A0]" />
            </div>
            <div>
              <p className="text-sm text-[#48B5A0] font-semibold">이 서비스를 만든 사람</p>
              <h3 className="mt-1 text-xl font-bold text-[#2D3436]">김창희 변호사</h3>
              <p className="mt-3 leading-relaxed text-[#636E72]">
                "개인회생은 누구나 할 수 있는 법적 권리입니다.
                비용 때문에 포기하는 분이 없도록, 이 서비스를 만들었습니다.
                모든 서류 양식과 AI 로직을 제가 직접 검수했습니다."
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs text-[#636E72]">대한변호사협회 등록</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-[#636E72]">개인정보보호법 준수</span>
              </div>
            </div>
          </div>
        </div>

        {/* 후기 */}
        <div className="mt-12">
          <h3 className="text-center text-xl font-bold text-[#2D3436]">먼저 시작한 분들의 이야기</h3>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.who} className="rounded-2xl border border-gray-100 bg-[#FAFAF7] p-6">
                <p className="leading-relaxed text-[#2D3436]">"{r.text}"</p>
                <p className="mt-4 text-sm text-[#636E72]">— {r.who}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   오해와 진실 — MythBuster
   ─────────────────────────────────────────── */
function MythBusterSection() {
  const myths = [
    {
      myth: '변호사 없이 하면 기각된다',
      truth: '법원은 서류 완성도를 봅니다. 대리인 유무로 차별하지 않습니다.',
    },
    {
      myth: '보정명령을 받으면 끝이다',
      truth: '보정명령은 \'보완 기회\'입니다. 대리인 신청도 보정명령을 받습니다.',
    },
    {
      myth: '도박/코인 빚은 안 된다',
      truth: '재량면책이 가능합니다. 정직하게 신고하는 것이 가장 중요합니다.',
    },
    {
      myth: '월급이 적으면 못 한다',
      truth: '최저생계비를 초과하는 소득이 있으면 가능합니다.',
    },
    {
      myth: '재산이 있으면 못 한다',
      truth: '가능합니다. 청산가치 이상을 변제하면 됩니다.',
    },
  ];

  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#2D3436] md:text-3xl">
            오해와 진실
          </h2>
          <p className="mt-3 text-[#636E72]">
            개인회생에 대해 잘못 알려진 이야기들, 바로잡아 드립니다.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          {myths.map((item) => (
            <div
              key={item.myth}
              className="rounded-2xl border border-gray-100 bg-[#FAFAF7] p-6 shadow-sm"
            >
              {/* 오해 */}
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <X size={14} className="text-red-500" />
                </div>
                <p className="text-[#2D3436] font-medium line-through decoration-red-400/60">
                  "{item.myth}"
                </p>
              </div>
              {/* 진실 */}
              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#48B5A0]/15">
                  <CheckCircle size={14} className="text-[#48B5A0]" />
                </div>
                <p className="text-[#2D3436]">{item.truth}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   FAQ
   ─────────────────────────────────────────── */
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: '개인회생이 뭔가요?',
      a: '법원에 신청해서 빚을 줄이고, 3~5년간 나눠 갚는 제도입니다. 계획대로 갚으면 나머지 빚은 면제됩니다. 국가가 만든 합법적인 새출발 제도예요.',
    },
    {
      q: '정말 혼자서 할 수 있나요?',
      a: '네. 변호사 없이 직접 신청(본인 신청)하는 분이 매년 늘고 있습니다. 저희 서비스는 가장 어려운 서류 작성을 AI가 자동으로 해드리기 때문에 훨씬 쉽습니다.',
    },
    {
      q: '직장이나 가족에게 알려지나요?',
      a: '아닙니다. 법원에서 직장이나 가족에게 통보하지 않습니다. 저희 서비스에 입력하신 정보도 암호화되어 저장되며, 법원 제출 외 용도로 사용하지 않습니다.',
    },
    {
      q: '보정명령이 오면 어떡하나요?',
      a: 'SELF+ 플랜에서는 보정명령 대응 가이드를 제공합니다. 변호사가 직접 검토하고 대응 방법을 안내해드려요. SELF 플랜에서도 언제든 SELF+로 업그레이드할 수 있습니다.',
    },
    {
      q: '환불할 수 있나요?',
      a: '서류 생성 전이라면 100% 환불해드립니다. 결제 후 7일 이내, 서류를 생성하지 않으셨다면 전액 환불됩니다.',
    },
    {
      q: '예금을 미리 인출해야 하나요?',
      a: '네. 개인회생 신청 후 예금이 압류될 수 있으므로, 신청 전에 인출해두시는 것이 좋습니다.',
    },
    {
      q: '대출 받고 바로 신청해도 되나요?',
      a: '최소 3개월은 경과 후 신청하시는 것이 좋습니다. 대출 직후 신청하면 사기 의심을 받을 수 있습니다.',
    },
    {
      q: '전자소송으로도 접수할 수 있나요?',
      a: '네. 대법원 전자소송(ecfs.scourt.go.kr)에서 24시간 접수 가능하며, 인지대 10% 할인 혜택도 있습니다.',
    },
    {
      q: '채권자 집회에 꼭 가야 하나요?',
      a: '네, 본인 출석이 필수입니다. 대부분 10~20분이면 끝납니다. 변제계획에 대해 설명하는 자리이며, 대부분의 채권자는 출석하지 않으므로 크게 걱정하지 않으셔도 됩니다.',
    },
    {
      q: '변제금을 못 내면 어떻게 되나요?',
      a: '3회 밀리면 폐지될 수 있습니다. 어려운 상황이면 즉시 법원에 변제계획 변경을 신청하세요. 소득 감소, 질병 등 정당한 사유가 있으면 인정됩니다.',
    },
    {
      q: '면책 후 대출은 언제 가능한가요?',
      a: '면책 후 1~2년부터 소액 대출이 가능하고, 3~5년 후 주택담보대출도 가능합니다. 면책 후 공공기록이 삭제되며 정상적인 금융생활로 복귀할 수 있습니다.',
    },
    {
      q: '개인회생 기간 중 불이익이 있나요?',
      a: '신용카드(후불교통카드, 후불하이패스 포함) 사용이 안 되고, 신규 대출과 전세보증보험 발급이 어렵습니다. 체크카드와 은행 통장 거래는 정상적으로 가능합니다. 3~5년간 최저생계비(기준중위소득 60%) 수준으로 생활해야 합니다.',
    },
  ];

  return (
    <section className="bg-[#FAFAF7] px-5 py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-2xl font-bold text-[#2D3436] md:text-3xl">
          자주 묻는 질문
        </h2>

        <div className="mt-10 space-y-3">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="rounded-2xl bg-white shadow-sm">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-semibold text-[#2D3436]">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp size={18} className="shrink-0 text-[#636E72]" />
                ) : (
                  <ChevronDown size={18} className="shrink-0 text-[#636E72]" />
                )}
              </button>
              {openIndex === i && (
                <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                  <p className="leading-relaxed text-[#636E72]">{faq.a}</p>
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
   최종 CTA — 위로와 용기
   ─────────────────────────────────────────── */
function FinalCTASection() {
  return (
    <section className="bg-gradient-to-b from-[#E8F5F0] to-[#d4ede5] px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Heart size={40} className="mx-auto text-[#48B5A0]" />
        <h2 className="mt-6 text-2xl font-bold text-[#2D3436] md:text-3xl">
          지금 이 순간이<br />가장 빠른 시작입니다.
        </h2>
        <p className="mt-4 leading-relaxed text-[#636E72]">
          빚은 당신의 잘못이 아닙니다.
          <br />
          누구에게나 다시 시작할 권리가 있습니다.
        </p>

        <Link
          to="/login?mode=individual"
          className="mt-10 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#E8836B] px-10 py-4 text-lg font-bold text-white shadow-lg shadow-[#E8836B]/25 hover:bg-[#d4725c] transition-all"
        >
          새로운 시작, 지금 해보세요
          <ArrowRight size={18} />
        </Link>

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm text-[#636E72]">
            <Lock size={12} />
            개인정보 암호화 · 서류 생성 전 100% 환불
          </p>
          <a href="tel:1660-4452" className="flex items-center gap-1.5 text-sm text-[#636E72] hover:text-[#48B5A0] transition-colors">
            <Phone size={12} />
            궁금한 점이 있으시면: 1660-4452
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────
   Footer
   ─────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-[#2D3436] px-5 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-[#48B5A0]" />
            <span className="text-sm text-gray-400">회생클릭</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-gray-500">
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">개인정보처리방침</Link>
            <Link to="/terms" className="hover:text-gray-300 transition-colors">이용약관</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-600">
          본 서비스는 법률 자문이 아닌 서류 생성 도구입니다. 개별 사안에 대한 법률 상담은 변호사 상담 기능을 이용해주세요.
        </p>
        <p className="mt-2 text-center text-xs text-gray-600">
          &copy; 2026 회생클릭. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ───────────────────────────────────────────
   Sticky 하단 바 (모바일)
   ─────────────────────────────────────────── */
function StickyBottomBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-sm p-3 md:hidden">
      <div className="flex items-center gap-3">
        <a
          href="tel:1660-4452"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200"
        >
          <MessageCircle size={20} className="text-[#636E72]" />
        </a>
        <Link
          to="/login?mode=individual"
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-[#E8836B] font-bold text-white"
        >
          시작하기
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   메인
   ─────────────────────────────────────────── */
export default function IndividualLandingPage() {
  useEffect(() => {
    // 파비콘 + 타이틀 변경
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = '/favicon-self.svg';
    document.title = '회생클릭 — 나홀로 개인회생, AI가 도와드립니다';
    return () => {
      if (link) link.href = '/favicon-office.svg';
      document.title = '회생원클릭 - 법률사무소 자동문서생성';
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#1a1a2e] dark:text-gray-100" style={{ fontSize: '16px', lineHeight: '1.7' }}>
      <Nav />
      <HeroSection />
      <EmpathySection />
      <HowItWorksSection />
      <PricingSection />
      <TrustSection />
      <MythBusterSection />
      <FAQSection />
      <FinalCTASection />
      <Footer />
      <StickyBottomBar />
      {/* 하단 바 공간 확보 */}
      <div className="h-16 md:hidden" />
    </div>
  );
}
