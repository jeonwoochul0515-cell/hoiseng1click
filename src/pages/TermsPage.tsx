import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LAST_UPDATED = '2026년 4월 16일';

const sections = [
  { id: 'purpose', label: '목적' },
  { id: 'definition', label: '정의' },
  { id: 'terms-change', label: '약관의 변경' },
  { id: 'service', label: '서비스의 내용' },
  { id: 'disclaimer', label: '면책 조항' },
  { id: 'account', label: '계정 관리' },
  { id: 'payment', label: '결제 및 환불' },
  { id: 'obligation', label: '이용자의 의무' },
  { id: 'suspension', label: '서비스 중단' },
  { id: 'liability', label: '손해배상' },
  { id: 'dispute', label: '분쟁 해결' },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0D1B2A] text-gray-200">
      {/* 상단 네비게이션 */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
            홈으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="text-3xl font-bold text-white">이용약관</h1>
        <p className="mt-2 text-sm text-gray-500">최종 수정일: {LAST_UPDATED}</p>

        {/* 목차 */}
        <nav className="mt-10 rounded-lg border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">목차</h2>
          <ol className="space-y-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-gray-400 hover:text-brand-gold transition-colors">
                  제{i + 1}조. {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 제1조 */}
        <Section id="purpose" number={1} title="목적">
          <p>
            이 약관은 회생원클릭(이하 "회사")이 제공하는 개인회생 서류 자동생성 서비스(이하 "서비스")의
            이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        {/* 제2조 */}
        <Section id="definition" number={2} title="정의">
          <ol className="list-decimal space-y-2 pl-5">
            <li>"서비스"란 회사가 제공하는 개인회생 신청 서류 자동생성 도구를 말합니다. 본 서비스는 법률 자문 서비스가 아닙니다.</li>
            <li>"이용자"란 이 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
            <li>"서류"란 서비스를 통해 생성되는 채권자목록, 재산목록, 수입지출목록, 개인회생 신청서, 변제계획안 등의 문서를 말합니다.</li>
            <li>"금융 데이터"란 CODEF 연동을 통해 수집되는 이용자의 채무, 자산, 소득 관련 정보를 말합니다.</li>
          </ol>
        </Section>

        {/* 제3조 */}
        <Section id="terms-change" number={3} title="약관의 변경">
          <p>
            회사는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.
            약관이 변경되는 경우, 회사는 변경 내용을 시행일 7일 전에 서비스 내 공지사항으로
            게시합니다. 이용자에게 불리한 약관 변경의 경우 30일 전에 공지합니다.
          </p>
        </Section>

        {/* 제4조 */}
        <Section id="service" number={4} title="서비스의 내용">
          <p>회사가 제공하는 서비스의 내용은 다음과 같습니다.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>CODEF API를 통한 금융 데이터 자동 수집</li>
            <li>공공데이터 API를 통한 부동산 공시가격 및 차량 기준가액 조회</li>
            <li>개인회생 신청 서류 5종 자동 생성 (DOCX/HWPX)</li>
            <li>AI 기반 진술서 초안 작성</li>
            <li>변제금 자동 계산</li>
            <li>청산가치 리포트 생성</li>
          </ul>
        </Section>

        {/* 제5조 */}
        <Section id="disclaimer" number={5} title="면책 조항">
          <div className="rounded-lg border border-yellow-600/30 bg-yellow-900/10 p-4">
            <p className="font-medium text-yellow-400">중요 안내</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-gray-300">
              <li>
                본 서비스는 <strong>서류 생성 도구</strong>이며, 법률 자문 서비스가 아닙니다.
                생성된 서류의 법적 정확성, 완전성, 적합성을 보장하지 않습니다.
              </li>
              <li>
                생성된 서류의 <strong>법원 제출 여부 및 그에 따른 결과는 전적으로 이용자의
                책임</strong>입니다.
              </li>
              <li>
                CODEF 및 공공데이터 API를 통해 수집된 데이터의 정확성은 해당 기관의 제공 정보에
                의존하며, 회사는 데이터의 오류로 인한 손해에 대해 책임지지 않습니다.
              </li>
              <li>
                AI가 생성한 진술서 초안은 참고용이며, 이용자가 반드시 내용을 확인하고
                수정해야 합니다.
              </li>
              <li>
                개별 사안에 대한 법률 상담이 필요한 경우, 반드시 변호사 또는 법무사와
                상담하시기 바랍니다.
              </li>
            </ul>
          </div>
        </Section>

        {/* 제6조 */}
        <Section id="account" number={6} title="계정 관리">
          <ol className="list-decimal space-y-2 pl-5">
            <li>이용자는 1인 1계정을 원칙으로 하며, 타인 명의로 계정을 생성하거나 이용할 수 없습니다.</li>
            <li>이용자는 본인의 계정 정보를 타인에게 양도하거나 대여할 수 없습니다.</li>
            <li>이용자는 계정 보안을 유지할 책임이 있으며, 계정 도용 시 즉시 회사에 통보해야 합니다.</li>
            <li>회사는 다음의 경우 이용자의 계정을 제한하거나 해지할 수 있습니다.
              <ul className="mt-1 list-disc pl-5 text-gray-400">
                <li>타인의 개인정보를 도용한 경우</li>
                <li>서비스의 정상적인 운영을 방해한 경우</li>
                <li>관련 법령 또는 이 약관을 위반한 경우</li>
              </ul>
            </li>
          </ol>
        </Section>

        {/* 제7조 */}
        <Section id="payment" number={7} title="결제 및 환불">
          <ol className="list-decimal space-y-2 pl-5">
            <li>서비스 이용 요금은 회사가 정한 요금제에 따르며, 서비스 내에 게시합니다.</li>
            <li>결제는 신용카드, 계좌이체 등 회사가 정한 결제 수단으로 이루어집니다.</li>
            <li>
              <strong>환불 정책:</strong>
              <ul className="mt-1 list-disc pl-5 text-gray-400">
                <li>서류 생성 전: 결제일로부터 7일 이내 100% 환불</li>
                <li>서류 생성 후: 서비스가 정상적으로 제공된 경우 환불 불가</li>
                <li>서비스 장애로 인한 미이용: 해당 기간만큼 이용 기간 연장 또는 환불</li>
              </ul>
            </li>
            <li>무료 체험 기간(14일)에는 결제가 발생하지 않으며, 체험 종료 후 자동 결제되지 않습니다.</li>
          </ol>
        </Section>

        {/* 제8조 */}
        <Section id="obligation" number={8} title="이용자의 의무">
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>타인의 개인정보를 무단으로 수집·이용하거나 타인 명의로 서류를 생성하는 행위</li>
            <li>허위 정보를 입력하여 서류를 생성하는 행위</li>
            <li>서비스를 이용하여 법령에 위반되는 행위를 하는 것</li>
            <li>서비스의 운영을 방해하거나 시스템에 부정 접근하는 행위</li>
            <li>서비스를 통해 생성된 서류를 상업적 목적으로 재판매하는 행위</li>
          </ul>
        </Section>

        {/* 제9조 */}
        <Section id="suspension" number={9} title="서비스 중단">
          <p>회사는 다음의 경우 서비스 제공을 일시적으로 중단할 수 있습니다.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>정기 시스템 점검 (사전 공지)</li>
            <li>천재지변, 국가비상사태 등 불가항력적 사유</li>
            <li>CODEF, 공공데이터 API 등 외부 서비스의 장애</li>
            <li>기타 회사의 합리적 판단에 의해 서비스 중단이 필요한 경우</li>
          </ul>
          <p className="mt-3">
            회사는 서비스 중단 시 가능한 한 사전에 이용자에게 공지하며, 불가피한 경우
            사후에 공지할 수 있습니다.
          </p>
        </Section>

        {/* 제10조 */}
        <Section id="liability" number={10} title="손해배상">
          <ol className="list-decimal space-y-2 pl-5">
            <li>회사는 무료로 제공하는 서비스의 이용과 관련하여 발생한 손해에 대해서는 책임지지 않습니다.</li>
            <li>회사의 고의 또는 중대한 과실로 인한 손해의 경우, 회사는 관련 법령에 따라 배상합니다.</li>
            <li>회사의 손해배상 범위는 이용자가 서비스 이용을 위해 회사에 지급한 금액을 한도로 합니다.</li>
          </ol>
        </Section>

        {/* 제11조 */}
        <Section id="dispute" number={11} title="분쟁 해결">
          <ol className="list-decimal space-y-2 pl-5">
            <li>회사와 이용자 간에 발생한 분쟁은 상호 협의에 의해 해결함을 원칙으로 합니다.</li>
            <li>협의가 이루어지지 않는 경우, <strong>서울중앙지방법원</strong>을 관할 법원으로 합니다.</li>
            <li>이 약관에 명시되지 않은 사항은 대한민국 관련 법령 및 상관례에 따릅니다.</li>
          </ol>
        </Section>

        {/* 부칙 */}
        <section className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold text-white">부칙</h2>
          <div className="mt-4 leading-relaxed text-gray-300">
            <p>이 약관은 {LAST_UPDATED}부터 시행합니다.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({ id, number, title, children }: { id: string; number: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-xl font-semibold text-white">
        제{number}조 ({title})
      </h2>
      <div className="mt-4 leading-relaxed text-gray-300">{children}</div>
    </section>
  );
}
