import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuthStore } from '@/store/authStore';
import { useCollectionStore } from '@/store/collectionStore';
import ConsentStep from '@/components/collection/ConsentStep';
import AuthStep from '@/components/collection/AuthStep';
import CollectStep from '@/components/collection/CollectStep';
import ResultStep from '@/components/collection/ResultStep';
import ChecklistStep from '@/components/collection/ChecklistStep';
import SupplementStep from '@/components/collection/SupplementStep';
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
  const { clientId: paramClientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  const office = useAuthStore((s) => s.office);
  const individual = useAuthStore((s) => s.individual);
  const userType = useAuthStore((s) => s.userType);
  const { step, result, reset, connectedId, authStatus, setStep } = useCollectionStore();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // 개인 모드 판별
  const isIndividualPage = location.pathname.startsWith('/my');
  const clientId = isIndividualPage ? 'default' : paramClientId;

  // Load client from Firestore
  useEffect(() => {
    reset();

    if (isIndividualPage && individual) {
      // 개인 모드: individuals/{uid}/cases/default
      async function loadIndividualCase() {
        try {
          const snap = await getDoc(doc(db, 'individuals', individual!.id, 'cases', 'default'));
          if (snap.exists()) {
            const data = snap.data() as Client;
            setClient(data);
            if (data.connectedId) {
              useCollectionStore.getState().setConnectedId(data.connectedId);
            }
          } else {
            // 케이스가 없으면 개인 정보로 초기화
            setClient({ name: individual!.name, phone: individual!.phone } as Client);
          }
          if (individual!.name) useCollectionStore.getState().setUserName(individual!.name);
          if (individual!.phone) useCollectionStore.getState().setPhoneNo(individual!.phone);
        } catch (err) {
          console.error('케이스 로드 실패:', err);
        } finally {
          setLoading(false);
        }
      }
      loadIndividualCase();
      return;
    }

    if (!paramClientId || !office) return;

    async function loadClient() {
      try {
        const snap = await getDoc(doc(db, 'offices', office!.id, 'clients', paramClientId!));
        if (snap.exists()) {
          const data = snap.data() as Client;
          setClient(data);
          if (data.connectedId) {
            useCollectionStore.getState().setConnectedId(data.connectedId);
          }
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
  }, [paramClientId, office, individual, isIndividualPage]);

  // Save results to Firestore when collection is complete
  useEffect(() => {
    if (!result || !clientId) return;

    async function saveResults() {
      try {
        const saveData = {
          debts: result!.debts,
          assets: result!.assets,
          collectionDone: true,
          status: 'drafting',
          connectedId: result!.connectedId,
          updatedAt: Timestamp.now(),
        };

        if (isIndividualPage && individual) {
          // 개인 모드: individuals/{uid}/cases/default
          const caseRef = doc(db, 'individuals', individual.id, 'cases', 'default');
          const existingSnap = await getDoc(caseRef);
          if (existingSnap.exists()) {
            const existing = existingSnap.data();
            const existingDebts = (existing?.debts ?? []).filter((d: any) => d.source !== 'codef');
            const existingAssets = (existing?.assets ?? []).filter((a: any) => a.source !== 'codef');
            saveData.debts = [...existingDebts, ...result!.debts];
            saveData.assets = [...existingAssets, ...result!.assets];
            await updateDoc(caseRef, saveData);
          } else {
            await setDoc(caseRef, { ...saveData, name: individual.name, phone: individual.phone, createdAt: Timestamp.now() });
          }
        } else if (office) {
          // 사무소 모드
          const existingSnap = await getDoc(doc(db, 'offices', office.id, 'clients', clientId!));
          const existing = existingSnap.data();
          const existingDebts = (existing?.debts ?? []).filter((d: any) => d.source !== 'codef');
          const existingAssets = (existing?.assets ?? []).filter((a: any) => a.source !== 'codef');
          saveData.debts = [...existingDebts, ...result!.debts];
          saveData.assets = [...existingAssets, ...result!.assets];
          await updateDoc(doc(db, 'offices', office.id, 'clients', clientId!), saveData);
        }
      } catch (err) {
        console.error('수집 결과 저장 실패:', err);
      }
    }

    saveResults();
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
            ? <CollectStep clientId={clientId} />
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
        {step === 4 && <ResultStep clientId={clientId} />}
      </div>
    </div>
  );
}
