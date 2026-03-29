import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuthStore } from '@/store/authStore';
import { useCollectionStore } from '@/store/collectionStore';
import ConsentStep from '@/components/collection/ConsentStep';
import AuthStep from '@/components/collection/AuthStep';
import CollectStep from '@/components/collection/CollectStep';
import ResultStep from '@/components/collection/ResultStep';
import ChecklistStep from '@/components/collection/ChecklistStep';
import type { Client } from '@/types/client';

/** 렌더 중 setState 방지를 위한 리다이렉트 컴포넌트 */
function StepRedirect({ setStep }: { setStep: (n: number) => void }) {
  useEffect(() => { setStep(2); }, [setStep]);
  return null;
}

const STEPS = [
  { num: 1, label: '동의' },
  { num: 2, label: '인증 및 수집' },
  { num: 3, label: '서류 보완' },
  { num: 4, label: '확인 및 생성' },
];

export default function CollectionPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const office = useAuthStore((s) => s.office);
  const { step, result, reset, connectedId, authStatus, setStep } = useCollectionStore();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // Load client from Firestore (offices/{officeId}/clients/{clientId})
  useEffect(() => {
    reset();

    if (!clientId || !office) return;

    async function loadClient() {
      try {
        const snap = await getDoc(doc(db, 'offices', office!.id, 'clients', clientId!));
        if (snap.exists()) {
          const data = snap.data() as Client;
          setClient(data);
          // 기존 connectedId가 있으면 store에 세팅 (재사용)
          if (data.connectedId) {
            useCollectionStore.getState().setConnectedId(data.connectedId);
          }
          // 의뢰인 이름을 인증 정보에 자동 세팅
          if (data.name) {
            useCollectionStore.getState().setUserName(data.name);
          }
          if (data.phone) {
            useCollectionStore.getState().setPhoneNo(data.phone);
          }
        }
      } catch (err) {
        console.error('의뢰인 정보 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    }

    loadClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, office]);

  // Save results to Firestore when collection is complete
  useEffect(() => {
    if (!result || !clientId || !office) return;

    async function saveResults() {
      try {
        // 기존 수동 입력 데이터와 병합 (CODEF 수집 결과가 기존 데이터를 덮어쓰지 않도록)
        const existingSnap = await getDoc(doc(db, 'offices', office!.id, 'clients', clientId!));
        const existing = existingSnap.data();
        const existingDebts = (existing?.debts ?? []).filter((d: any) => d.source !== 'codef');
        const existingAssets = (existing?.assets ?? []).filter((a: any) => a.source !== 'codef');
        const mergedDebts = [...existingDebts, ...result!.debts];
        const mergedAssets = [...existingAssets, ...result!.assets];

        await updateDoc(doc(db, 'offices', office!.id, 'clients', clientId!), {
          debts: mergedDebts,
          assets: mergedAssets,
          collectionDone: true,
          status: 'drafting',
          connectedId: result!.connectedId,
          updatedAt: Timestamp.now(),
        });
      } catch (err) {
        console.error('수집 결과 저장 실패:', err);
      }
    }

    saveResults();
  }, [result, clientId, office]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-[var(--color-brand-gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!clientId) {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">개인회생 서류 자동수집</h1>
        {client && (
          <p className="text-sm text-gray-600">
            의뢰인: <span className="text-gray-900">{client.name}</span>
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
        {step === 1 && <ConsentStep clientName={client?.name ?? '(알 수 없음)'} />}
        {step === 2 && (
          connectedId && authStatus === 'done'
            ? <CollectStep clientId={clientId} />
            : <AuthStep />
        )}
        {step === 3 && (
          <ChecklistStep
            debts={result?.debts ?? client?.debts ?? []}
            assets={result?.assets ?? client?.assets ?? []}
            clientInfo={{
              jobType: client?.jobType,
              hasRealEstate: (result?.assets ?? client?.assets ?? []).some((a: any) => a.type === '부동산'),
              court: client?.court,
            }}
            onComplete={() => setStep(4)}
          />
        )}
        {step === 4 && <ResultStep clientId={clientId} />}
      </div>
    </div>
  );
}
