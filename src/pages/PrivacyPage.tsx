import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const LAST_UPDATED = '2026년 4월 16일';

const sections = [
  { id: 'purpose', label: '개인정보의 수집 및 이용 목적' },
  { id: 'items', label: '수집하는 개인정보 항목' },
  { id: 'retention', label: '보유 및 이용 기간' },
  { id: 'third-party', label: '제3자 제공' },
  { id: 'security', label: '개인정보의 안전성 확보조치' },
  { id: 'rights', label: '이용자의 권리와 행사 방법' },
  { id: 'auto-collection', label: '자동 수집 장치의 운영' },
  { id: 'officer', label: '개인정보보호 책임자' },
  { id: 'changes', label: '개인정보처리방침 변경' },
];

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-white">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-gray-500">최종 수정일: {LAST_UPDATED}</p>

        <p className="mt-6 leading-relaxed text-gray-300">
          회생원클릭(이하 "회사")은 개인정보보호법 제30조에 따라 이용자의 개인정보를 보호하고
          이와 관련한 고충을 신속하고 원활하게 처리하기 위하여 다음과 같이 개인정보처리방침을
          수립·공개합니다.
        </p>

        {/* 목차 */}
        <nav className="mt-10 rounded-lg border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">목차</h2>
          <ol className="space-y-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-gray-400 hover:text-brand-gold transition-colors">
                  {i + 1}. {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 제1조 */}
        <Section id="purpose" number={1} title="개인정보의 수집 및 이용 목적">
          <p>회사는 다음의 목적을 위하여 개인정보를 처리합니다.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>개인회생 신청 서류 자동 생성 (채권자목록, 재산목록, 수입지출목록, 신청서, 변제계획안)</li>
            <li>법원 제출용 서류의 정확한 작성을 위한 금융 데이터 수집</li>
            <li>AI 기반 진술서 초안 작성</li>
            <li>서비스 이용 내역 관리 및 고객 상담</li>
            <li>서비스 개선 및 통계 분석 (비식별 처리 후)</li>
          </ul>
        </Section>

        {/* 제2조 */}
        <Section id="items" number={2} title="수집하는 개인정보 항목">
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="pb-2 pr-4">분류</th>
                  <th className="pb-2 pr-4">항목</th>
                  <th className="pb-2">수집 방법</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 align-top font-medium">필수 정보</td>
                  <td className="py-3 pr-4">이름, 주민등록번호(암호화 저장), 주소, 전화번호, 이메일</td>
                  <td className="py-3">이용자 직접 입력</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 align-top font-medium">금융 정보</td>
                  <td className="py-3 pr-4">채무 내역(채권자, 채무액, 이자율), 자산 내역(예금, 보험, 증권), 소득 정보</td>
                  <td className="py-3">CODEF API 연동 (이용자 인증 후 자동 수집)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 align-top font-medium">재산 정보</td>
                  <td className="py-3 pr-4">부동산 공시가격, 차량 기준가액</td>
                  <td className="py-3">공공데이터 API 자동 조회</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 align-top font-medium">서비스 이용 정보</td>
                  <td className="py-3 pr-4">로그인 기록, 서류 생성 이력</td>
                  <td className="py-3">자동 수집</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 제3조 */}
        <Section id="retention" number={3} title="보유 및 이용 기간">
          <p>
            회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
            다만, 관련 법령에 따라 보존이 필요한 경우 아래 기간 동안 보관합니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>서비스 이용 종료 시:</strong> 즉시 삭제 (이용자 요청 또는 계정 탈퇴 시)</li>
            <li><strong>전자상거래 계약·청약철회 기록:</strong> 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li><strong>대금결제 및 재화 공급 기록:</strong> 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li><strong>소비자 불만 또는 분쟁 처리 기록:</strong> 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li><strong>로그인 기록:</strong> 3개월 (통신비밀보호법)</li>
          </ul>
        </Section>

        {/* 제4조 */}
        <Section id="third-party" number={4} title="제3자 제공">
          <p>
            회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
            다만, 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="pb-2 pr-4">수탁 업체</th>
                  <th className="pb-2 pr-4">위탁 업무</th>
                  <th className="pb-2">보유 기간</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4">CODEF (쿠콘)</td>
                  <td className="py-3 pr-4">금융 데이터 수집을 위한 본인인증 및 스크래핑</td>
                  <td className="py-3">인증 완료 즉시 삭제</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4">Google Firebase</td>
                  <td className="py-3 pr-4">사용자 인증, 데이터 저장 (Firestore)</td>
                  <td className="py-3">서비스 이용 기간</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4">Cloudflare</td>
                  <td className="py-3 pr-4">API 서버 운영 (Workers), 생성 파일 저장 (R2)</td>
                  <td className="py-3">서비스 이용 기간</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Anthropic</td>
                  <td className="py-3 pr-4">AI 기반 진술서 초안 생성</td>
                  <td className="py-3">생성 완료 즉시 삭제 (학습 미사용)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 제5조 */}
        <Section id="security" number={5} title="개인정보의 안전성 확보조치">
          <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>암호화:</strong> 주민등록번호는 AES-256-GCM 알고리즘으로 암호화하여 저장합니다.</li>
            <li><strong>전송 구간 보호:</strong> 모든 데이터 전송은 HTTPS(TLS 1.2 이상)를 통해 암호화됩니다.</li>
            <li><strong>접근 제한:</strong> 개인정보 처리 시스템에 대한 접근 권한을 최소화하고, 접근 기록을 보관합니다.</li>
            <li><strong>데이터 분리 저장:</strong> 민감정보(주민등록번호)는 별도 암호화 필드로 분리 저장합니다.</li>
            <li><strong>정기 점검:</strong> 개인정보 처리 시스템의 보안 취약점을 정기적으로 점검합니다.</li>
          </ul>
        </Section>

        {/* 제6조 */}
        <Section id="rights" number={6} title="이용자의 권리와 행사 방법">
          <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><strong>열람권:</strong> 본인의 개인정보 처리 현황을 열람할 수 있습니다.</li>
            <li><strong>정정권:</strong> 개인정보의 오류에 대한 정정을 요구할 수 있습니다.</li>
            <li><strong>삭제권:</strong> 개인정보의 삭제를 요구할 수 있습니다.</li>
            <li><strong>처리정지권:</strong> 개인정보의 처리 정지를 요구할 수 있습니다.</li>
          </ul>
          <p className="mt-3">
            위 권리 행사는 서비스 내 설정 메뉴 또는 개인정보보호 책임자에게 이메일로
            요청하실 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.
          </p>
        </Section>

        {/* 제7조 */}
        <Section id="auto-collection" number={7} title="자동 수집 장치의 운영">
          <p>
            회사는 서비스 이용 과정에서 쿠키(Cookie)를 사용할 수 있습니다.
            쿠키는 이용자의 로그인 상태 유지 및 서비스 이용 편의를 위해 사용되며,
            이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.
            다만 쿠키를 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
          </p>
        </Section>

        {/* 제8조 */}
        <Section id="officer" number={8} title="개인정보보호 책임자">
          <p>회사는 개인정보 처리에 관한 업무를 총괄하여 책임지는 개인정보보호 책임자를 지정하고 있습니다.</p>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="font-medium text-white">개인정보보호 책임자</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-300">
              <li>성명: 김창희</li>
              <li>직책: 대표 변호사</li>
              <li>연락처: 1660-4452</li>
              <li>이메일: privacy@hoiseng1click.com</li>
            </ul>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            기타 개인정보 침해에 대한 신고나 상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-400">
            <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
            <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
            <li>대검찰청 사이버수사과: (국번없이) 1301 (www.spo.go.kr)</li>
            <li>경찰청 사이버수사국: (국번없이) 182 (ecrm.cyber.go.kr)</li>
          </ul>
        </Section>

        {/* 제9조 */}
        <Section id="changes" number={9} title="개인정보처리방침 변경">
          <p>
            이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의
            추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여
            고지할 것입니다.
          </p>
          <p className="mt-3 font-medium text-gray-300">
            공고일자: {LAST_UPDATED}<br />
            시행일자: {LAST_UPDATED}
          </p>
        </Section>
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
