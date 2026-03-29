import { useEffect, useRef } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { workerApi } from '@/api/worker';
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface CollectStepProps {
  clientId: string;
}

export default function CollectStep({ clientId }: CollectStepProps) {
  const {
    selectedBanks, credentials, connectedId, provider,
    progress, setProgress,
    bankStatuses, setBankStatus,
    setResult, setError, setStep, error,
    setAuthStatus,
  } = useCollectionStore();

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Initialize all banks to waiting
    selectedBanks.forEach((bank) => setBankStatus(bank, 'waiting'));

    startCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCollection() {
    // connectedId가 없으면 인증 단계로 돌아가기
    if (!connectedId) {
      setError('인증이 완료되지 않았습니다. 인증을 먼저 진행해주세요.');
      selectedBanks.forEach((bank) => setBankStatus(bank, 'error'));
      return;
    }

    try {
      // Simulate per-bank progress while the actual API call runs
      const simulationHandle = simulateProgress();

      // provider 매핑: store의 provider 값 사용 (하드코딩 제거)
      const providerMap: Record<string, string> = {
        '1': 'kakao', '5': 'pass', '6': 'naver', '8': 'toss',
        '4': 'kb', '2': 'payco',
      };
      const authMethod = providerMap[provider] || 'kakao';

      const raw = await workerApi.codefCollect({
        clientId,
        authMethod: authMethod as any,
        credentials,
        banks: selectedBanks,
        connectedId,
      } as any);

      // Stop simulation and finalize
      clearInterval(simulationHandle);
      setProgress(100);
      selectedBanks.forEach((bank) => setBankStatus(bank, 'done'));

      // 서버 응답 필드명 변환 (debtCount→totalDebtCount 등)
      const summary = raw.summary as any;
      const normalizedResult = {
        ...raw,
        summary: {
          totalDebt: summary.totalDebt ?? summary.debtTotal ?? 0,
          totalDebtCount: summary.totalDebtCount ?? summary.debtCount ?? 0,
          totalAsset: summary.totalAsset ?? summary.assetTotal ?? 0,
          totalAssetCount: summary.totalAssetCount ?? summary.assetCount ?? 0,
        },
      };
      setResult(normalizedResult);

      // Auto-advance after a brief delay
      setTimeout(() => setStep(3), 800);
    } catch (err) {
      clearInterval(simulationHandle);
      console.error('CODEF API 호출 실패:', err);
      const msg = err instanceof Error ? err.message : 'CODEF API 호출에 실패했습니다.';

      // 인증 관련 에러인지 판별
      const isAuthError = msg.includes('인증') || msg.includes('OAuth') || msg.includes('401') || msg.includes('connectedId');
      if (isAuthError) {
        setError(`인증이 만료되었거나 유효하지 않습니다.\n인증 단계로 돌아가서 다시 인증해주세요.`);
      } else {
        setError(`금융데이터 수집에 실패했습니다. ${msg}`);
      }

      setProgress(0);
      selectedBanks.forEach((bank) => setBankStatus(bank, 'error'));
    }
  }

  function simulateProgress(): ReturnType<typeof setInterval> {
    let p = 0;
    const total = selectedBanks.length;
    let completed = 0;

    return setInterval(() => {
      if (completed < total) {
        const bank = selectedBanks[completed];
        setBankStatus(bank, 'collecting');
      }
      p = Math.min(p + Math.random() * 8, 95);
      setProgress(Math.round(p));

      if (p > (completed + 1) * (90 / total) && completed < total) {
        setBankStatus(selectedBanks[completed], 'done');
        completed++;
        if (completed < total) {
          setBankStatus(selectedBanks[completed], 'collecting');
        }
      }
    }, 400);
  }

  const statusIcon = (status: 'waiting' | 'collecting' | 'done' | 'error') => {
    switch (status) {
      case 'waiting':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'collecting':
        return <Loader2 className="h-4 w-4 text-[var(--color-brand-gold)] animate-spin" />;
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const statusLabel = (status: 'waiting' | 'collecting' | 'done' | 'error') => {
    switch (status) {
      case 'waiting': return '대기';
      case 'collecting': return '수집 중';
      case 'done': return '완료';
      case 'error': return '오류';
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Overall Progress */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">금융데이터 수집 중</h2>
          <span className="text-sm font-mono text-[var(--color-brand-gold)]">{progress}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-brand-gold)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          CODEF를 통해 선택된 금융기관에서 채무·자산 정보를 수집하고 있습니다.
        </p>
      </div>

      {/* Per-bank status */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6 space-y-3">
        <h3 className="text-gray-900 font-semibold mb-2">기관별 수집 현황</h3>
        <div className="space-y-2">
          {selectedBanks.map((bank) => {
            const status = bankStatuses[bank] ?? 'waiting';
            return (
              <div
                key={bank}
                className="flex items-center justify-between rounded-lg bg-gray-100/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(status)}
                  <span className="text-sm text-gray-700">{bank}</span>
                </div>
                <span className={`text-xs font-medium ${
                  status === 'done' ? 'text-emerald-400' :
                  status === 'error' ? 'text-red-400' :
                  status === 'collecting' ? 'text-[var(--color-brand-gold)]' :
                  'text-gray-500'
                }`}>
                  {statusLabel(status)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
          <p className="text-sm text-red-500 whitespace-pre-line">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setError(null);
                setAuthStatus('idle');
                setStep(2);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              인증 단계로
            </button>
            {connectedId && (
              <button
                onClick={() => {
                  setError(null);
                  setProgress(0);
                  selectedBanks.forEach((bank) => setBankStatus(bank, 'waiting'));
                  startedRef.current = false;
                  startCollection();
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)] hover:brightness-110 transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
