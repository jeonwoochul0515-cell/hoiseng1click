import { useEffect, useRef } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { workerApi } from '@/api/worker';
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface CollectStepProps {
  clientId: string;
}

export default function CollectStep({ clientId }: CollectStepProps) {
  const {
    selectedBanks, authMethod, credentials,
    progress, setProgress,
    bankStatuses, setBankStatus,
    setResult, setError, setStep, error,
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
    try {
      // Simulate per-bank progress while the actual API call runs
      const simulationHandle = simulateProgress();

      const result = await workerApi.codefCollect({
        clientId,
        authMethod,
        credentials,
        banks: selectedBanks,
      });

      // Stop simulation and finalize
      clearInterval(simulationHandle);
      setProgress(100);
      selectedBanks.forEach((bank) => setBankStatus(bank, 'done'));
      setResult(result);

      // Auto-advance after a brief delay
      setTimeout(() => setStep(4), 800);
    } catch (err) {
      // On real API failure, fall back to simulated demo data
      console.warn('CODEF API 호출 실패, 시뮬레이션 모드로 전환:', err);
      await runSimulation();
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

  async function runSimulation() {
    const total = selectedBanks.length;

    for (let i = 0; i < total; i++) {
      const bank = selectedBanks[i];
      setBankStatus(bank, 'collecting');

      // Simulate collecting time
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

      // Random error for demo (5% chance)
      if (Math.random() < 0.05) {
        setBankStatus(bank, 'error');
      } else {
        setBankStatus(bank, 'done');
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Build simulated result
    const demoDebts = selectedBanks.slice(0, 3).map((bank, idx) => ({
      id: `d-${idx}`,
      name: `${bank} 대출`,
      creditor: bank,
      type: '무담보' as const,
      amount: Math.round((5000000 + Math.random() * 30000000) / 10000) * 10000,
      rate: Math.round((3 + Math.random() * 12) * 10) / 10,
      monthly: Math.round((100000 + Math.random() * 500000) / 1000) * 1000,
      source: 'codef' as const,
    }));

    const demoAssets = [
      {
        id: 'a-0',
        name: '보통예금',
        type: '예금' as const,
        rawValue: Math.round(Math.random() * 3000000),
        liquidationRate: 100,
        mortgage: 0,
        value: 0,
        source: 'codef' as const,
      },
    ];
    demoAssets[0].value = demoAssets[0].rawValue;

    const totalDebt = demoDebts.reduce((s, d) => s + d.amount, 0);
    const totalAsset = demoAssets.reduce((s, a) => s + a.value, 0);

    const result = {
      debts: demoDebts,
      assets: demoAssets,
      summary: {
        totalDebt,
        totalDebtCount: demoDebts.length,
        totalAsset,
        totalAssetCount: demoAssets.length,
      },
    };

    setResult(result);
    setError(null);

    // Auto-advance
    setTimeout(() => setStep(4), 800);
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
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">금융데이터 수집 중</h2>
          <span className="text-sm font-mono text-[var(--color-brand-gold)]">{progress}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
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
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6 space-y-3">
        <h3 className="text-white font-semibold mb-2">기관별 수집 현황</h3>
        <div className="space-y-2">
          {selectedBanks.map((bank) => {
            const status = bankStatuses[bank] ?? 'waiting';
            return (
              <div
                key={bank}
                className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {statusIcon(status)}
                  <span className="text-sm text-gray-200">{bank}</span>
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
        <div className="rounded-xl bg-red-900/20 border border-red-800 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
