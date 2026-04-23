import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuthStore } from '@/store/authStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useCurrentClient, useUpdateCurrentClient } from '@/hooks/useCurrentClient';
import ConsentStep from '@/components/collection/ConsentStep';
import AuthStep from '@/components/collection/AuthStep';
import CollectStep from '@/components/collection/CollectStep';
import ResultStep from '@/components/collection/ResultStep';
import ChecklistStep from '@/components/collection/ChecklistStep';
import SupplementStep from '@/components/collection/SupplementStep';
import PublicCollectStep from '@/components/collection/PublicCollectStep';
import PropertyValuationStep from '@/components/collection/PropertyValuationStep';

/** 렌더 중 setState 방지를 위한 리다이렉트 컴포넌트 */
function StepRedirect({ setStep }: { setStep: (n: number) => void }) {
  useEffect(() => { setStep(2); }, [setStep]);
  return null;
}

const STEPS = [
  { num: 1, label: '동의' },
  { num: 2, label: '인증 및 수집' },
  { num: 3, label: '서류 보완' },
  { num: 4, label: '공공자료' },
  { num: 5, label: '부동산' },
  { num: 6, label: '확인 및 생성' },
];

export default function CollectionPage() {
  const { clientId: paramClientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const office = useAuthStore((s) => s.office);
  const individual = useAuthStore((s) => s.individual);
  const { step, result, reset, connectedId, authStatus, setStep } = useCollectionStore();

  // 개인 모드 판별: /my/* 경로에서는 clientId 가 undefined 가 될 수 있음.
  const isIndividualPage = location.pathname.startsWith('/my/');
  const clientId = paramClientId; // B2B 는 값 존재, B2C 는 undefined → 어댑터가 user.uid 로 fallback
  // 하위 컴포넌트 중 B2B 전용 (CollectStep, ResultStep) 에 전달할 clientId.
  // B2C 에서는 user.uid 를 넘겨 기존 시그니처(string)를 유지.
  const childClientId: string = clientId ?? individual?.id ?? 'default';

  // B2B/B2C 자동 분기 로드
  const clientQuery = useCurrentClient(clientId);
  const client = clientQuery.data ?? null;
  // 쿼리가 비활성(enabled=false)이면 isLoading 은 true 로 남으므로 fetchStatus 도 확인
  const loading = clientQuery.isLoading && clientQuery.fetchStatus !== 'idle';
  const updateCurrent = useUpdateCurrentClient(clientId);

  // 세션/스토어 초기화 + connectedId·name·phone 반영
  useEffect(() => {
    reset();
  }, [clientId, isIndividualPage, reset]);

  useEffect(() => {
    if (client) {
      if (client.connectedId) useCollectionStore.getState().setConnectedId(client.connectedId);
      if (client.name) useCollectionStore.getState().setUserName(client.name);
      if (client.phone) useCollectionStore.getState().setPhoneNo(client.phone);
      return;
    }
    // B2C 최초 진입: 케이스 문서 없을 수 있으니 Individual 기본정보 반영
    if (isIndividualPage && individual) {
      if (individual.name) useCollectionStore.getState().setUserName(individual.name);
      if (individual.phone) useCollectionStore.getState().setPhoneNo(individual.phone);
    }
  }, [client, isIndividualPage, individual]);

  // Save results to Firestore when collection is complete
  useEffect(() => {
    if (!result) return;
    if (!isIndividualPage && !clientId) return;

    async function saveResults() {
      try {
        if (isIndividualPage && individual) {
          // 개인 모드: individuals/{uid} (어댑터 경로) — 기존 데이터와 병합
          const existingDebts = (client?.debts ?? []).filter((d: any) => d.source !== 'codef');
          const existingAssets = (client?.assets ?? []).filter((a: any) => a.source !== 'codef');
          await updateCurrent.mutateAsync({
            debts: [...existingDebts, ...result!.debts],
            assets: [...existingAssets, ...result!.assets],
            collectionDone: true,
            status: 'drafting',
            connectedId: result!.connectedId,
            name: client?.name || individual.name,
            phone: client?.phone || individual.phone,
          });
        } else if (office && clientId) {
          // 사무소 모드 — 기존 경로 유지 (B2B 동작 보존)
          const existingSnap = await getDoc(doc(db, 'offices', office.id, 'clients', clientId));
          const existing = existingSnap.data();
          const existingDebts = (existing?.debts ?? []).filter((d: any) => d.source !== 'codef');
          const existingAssets = (existing?.assets ?? []).filter((a: any) => a.source !== 'codef');
          await updateDoc(doc(db, 'offices', office.id, 'clients', clientId), {
            debts: [...existingDebts, ...result!.debts],
            assets: [...existingAssets, ...result!.assets],
            collectionDone: true,
            status: 'drafting',
            connectedId: result!.connectedId,
            updatedAt: Timestamp.now(),
          });
        }
      } catch (err) {
        console.error('수집 결과 저장 실패:', err);
      }
    }

    saveResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, clientId, office, individual, isIndividualPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-[var(--color-brand-gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!clientId && !isIndividualPage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        의뢰인 ID가 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mx-auto max-w-3xl mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isIndividualPage ? '금융데이터 수집' : '개인회생 서류 자동수집'}
        </h1>
        {client && !isIndividualPage && (
          <p className="text-sm text-gray-600">
            의뢰인: <span className="text-gray-900">{client.name}</span>
          </p>
        )}
        {isIndividualPage && (
          <p className="text-sm text-gray-600">
            CODEF 인증 1회로 은행·카드·보험 정보를 자동으로 수집합니다
          </p>
        )}
      </div>

      {/* Stepper */}
      <div className="mx-auto max-w-3xl mb-10">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold transition-colors ${
                    step >= s.num
                      ? 'bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)]'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    step >= s.num ? 'text-[var(--color-brand-gold)]' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-3 mt-[-1.25rem]">
                  <div
                    className={`h-0.5 rounded transition-colors ${
                      step > s.num ? 'bg-[var(--color-brand-gold)]' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div>
        {step === 1 && <ConsentStep clientName={client?.name ?? '(알 수 없음)'} clientId={clientId} />}
        {step === 2 && (
          connectedId && authStatus === 'done'
            ? <CollectStep clientId={childClientId} />
            : <AuthStep />
        )}
        {step === 3 && (
          <div className="space-y-8">
            <ChecklistStep
              debts={result?.debts ?? client?.debts ?? []}
              assets={result?.assets ?? client?.assets ?? []}
              clientInfo={{
                jobType: client?.jobType,
                hasRealEstate: (result?.assets ?? client?.assets ?? []).some((a: any) => a.type === '부동산'),
                court: client?.court,
              }}
              onComplete={() => {}}
            />
            <SupplementStep onComplete={() => setStep(4)} />
          </div>
        )}
        {step === 4 && (
          <PublicCollectStep
            clientId={clientId}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <PropertyValuationStep
            clientId={clientId}
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
          />
        )}
        {step === 6 && <ResultStep clientId={childClientId} />}
      </div>
    </div>
  );
}
