// B2C 개인 사용자용 — 전자소송 개인회생 개시신청서 입력 페이지
// /my/application 경로. individuals/{uid}/cases/default 문서에 저장.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getIndividualCase, createIndividualCase, updateIndividualCase } from '@/api/firestore';
import { CaseApplicationSection, type CaseApplicationState } from '@/components/client/CaseApplicationSection';
import { DEFAULT_APPLICATION_PURPOSE } from '@/utils/legalConstants';
import { toast } from '@/utils/toast';

export default function MyCaseApplicationPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const individual = useAuthStore((s) => s.individual);

  const [caseApp, setCaseApp] = useState<CaseApplicationState>({
    nationality: '한국',
    sameAsResident: true,
    sameDeliveryAsResident: true,
    applicationPurpose: DEFAULT_APPLICATION_PURPOSE,
    relatedCases: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingCase, setExistingCase] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getIndividualCase(user.uid, 'default')
      .then((c) => {
        if (c) {
          setExistingCase(true);
          setCaseApp({
            incomeType: c.incomeType,
            repayPeriodMonths: c.repayPeriodMonths ?? 36,
            repayStartDate: c.repayStartDate,
            repayStartAfterAuthorization: c.repayStartAfterAuthorization,
            repayDayOfMonth: c.repayDayOfMonth,
            monthlyPaymentOverride: c.monthlyPaymentOverride,
            refundBank: c.refundBank,
            refundAccount: c.refundAccount,
            refundAccountHolder: c.refundAccountHolder,
            court: c.court,
            nationality: c.nationality ?? '한국',
            nameForeign: c.nameForeign,
            residentAddress: c.residentAddress ?? c.address,
            residentAddressDetail: c.residentAddressDetail,
            residentZonecode: c.residentZonecode ?? c.zonecode,
            actualAddress: c.actualAddress,
            actualAddressDetail: c.actualAddressDetail,
            actualZonecode: c.actualZonecode,
            sameAsResident: c.sameAsResident ?? true,
            deliveryAddress: c.deliveryAddress,
            deliveryAddressDetail: c.deliveryAddressDetail,
            deliveryZonecode: c.deliveryZonecode,
            sameDeliveryAsResident: c.sameDeliveryAsResident ?? true,
            tel: c.tel,
            fax: c.fax,
            email: c.email ?? individual?.email,
            docVisibility: c.docVisibility ?? {},
            relatedCases: c.relatedCases ?? [],
            applicationPurpose: c.applicationPurpose ?? DEFAULT_APPLICATION_PURPOSE,
            applicationReason: c.applicationReason,
          });
        } else {
          // 기본값 세팅 (개인 정보 기반)
          setCaseApp((prev) => ({
            ...prev,
            email: individual?.email,
          }));
        }
      })
      .catch((err) => {
        console.error('케이스 로드 실패:', err);
        toast.error('신청서 정보를 불러오지 못했습니다');
      })
      .finally(() => setLoading(false));
  }, [user?.uid, individual?.email]);

  const handleSave = async () => {
    if (!user?.uid) {
      toast.warning('로그인이 필요합니다');
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      const data: any = {
        ...caseApp,
        // 필수 기본 필드 (getIndividualCase 호환용)
        name: individual?.name ?? '',
        phone: individual?.phone ?? '',
        ssn: '',
        address: caseApp.residentAddress ?? '',
        zonecode: caseApp.residentZonecode ?? '',
        job: '',
        jobType: 'employed' as const,
        family: 1,
        income: 0,
        income2: 0,
        rent: 0,
        education: 0,
        medical: 0,
        memo: '',
        status: 'new' as const,
        collectionDone: false,
        debts: [],
        assets: [],
      };

      if (existingCase) {
        await updateIndividualCase(user.uid, 'default', data);
      } else {
        await createIndividualCase(user.uid, data, 'default');
        setExistingCase(true);
      }
      toast.success('신청서가 저장되었습니다');
    } catch (err: any) {
      console.error('저장 실패:', err);
      toast.error(err?.message ?? '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/my')}
            className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} /> 대시보드로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">개인회생 개시신청서</h1>
          <p className="mt-1 text-sm text-gray-500">
            전자소송 포털 양식과 동일한 항목으로 작성합니다. 저장 후 언제든 수정 가능합니다.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <>저장 중...</>
          ) : (
            <>
              <Save size={16} /> 저장
            </>
          )}
        </button>
      </header>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
        <div className="flex items-start gap-3">
          <FileCheck className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold mb-1">안내</p>
            <p className="text-xs leading-relaxed">
              이 폼은 <strong>대법원 전자소송 포털의 개인회생 절차 개시 신청서 양식</strong>과 동일한 항목으로 구성되어 있습니다.
              입력 후 생성되는 서류는 전자소송에 그대로 복사하여 제출할 수 있습니다.
              SELF+ 플랜 이상은 김창희 변호사의 1:1 검수가 제공됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-gray-200 p-6">
        <CaseApplicationSection
          value={caseApp}
          onChange={setCaseApp}
          aiContext={{
            name: individual?.name,
            family: 1,
          }}
        />
      </div>

      {/* 하단 고정 저장 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:left-[220px]">
        <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
          <button
            onClick={() => navigate('/my')}
            className="px-5 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
