import { useCallback, useMemo, useRef, useState } from 'react';
import type { DocTemplate, GenerationState } from '@/types/docgen';
import type { SourceStatus } from '@/components/docgen/SourceBadge';
import { SOURCE_CATALOG } from '@/data/sourceCatalog';

interface UseDocGeneratorArgs {
  template: DocTemplate;
}

interface FieldPointer {
  sectionIdx: number;
  fieldIdx: number;
}

/**
 * 하이브리드 전략:
 *  1) start() → 필요한 모든 출처를 병렬로 loading → 각자 mockLatencyMs 후 success
 *  2) 첫 소스가 ready되는 순간 generating 진입
 *  3) 필드를 순차 타이핑 (TypewriterField가 onComplete 호출 시 다음으로)
 */
export function useDocGenerator({ template }: UseDocGeneratorArgs) {
  const totalFieldCount = useMemo(
    () => template.sections.reduce((n, s) => n + s.fields.length, 0),
    [template],
  );

  const [status, setStatus] = useState<GenerationState['status']>('idle');
  const [typedFieldCount, setTypedFieldCount] = useState(0);
  const [pointer, setPointer] = useState<FieldPointer>({ sectionIdx: 0, fieldIdx: 0 });
  const [sourceStatus, setSourceStatus] = useState<Record<string, SourceStatus>>(
    Object.fromEntries(template.requiredSources.map((id) => [id, 'pending'])),
  );

  const timeoutsRef = useRef<number[]>([]);
  const pausedAtRef = useRef<FieldPointer | null>(null);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setStatus('connecting');
    setTypedFieldCount(0);
    setPointer({ sectionIdx: 0, fieldIdx: 0 });
    pausedAtRef.current = null;

    // 모든 소스를 loading 상태로 동시 전환
    const initialLoading: Record<string, SourceStatus> = {};
    template.requiredSources.forEach((id) => (initialLoading[id] = 'loading'));
    setSourceStatus(initialLoading);

    // 가장 빠른 소스가 ready되는 순간 generating 진입
    let startedGenerating = false;

    template.requiredSources.forEach((id) => {
      const latency = SOURCE_CATALOG[id]?.mockLatencyMs ?? 1200;
      const t = window.setTimeout(() => {
        setSourceStatus((prev) => ({ ...prev, [id]: 'success' }));
        if (!startedGenerating) {
          startedGenerating = true;
          setStatus('generating');
        }
      }, latency);
      timeoutsRef.current.push(t);
    });
  }, [template, clearTimers]);

  /** TypewriterField가 현재 필드 타이핑 완료 시 호출 */
  const advanceField = useCallback(() => {
    setPointer((p) => {
      const section = template.sections[p.sectionIdx];
      if (!section) return p;
      const nextFieldIdx = p.fieldIdx + 1;
      if (nextFieldIdx < section.fields.length) {
        return { sectionIdx: p.sectionIdx, fieldIdx: nextFieldIdx };
      }
      // 다음 섹션
      const nextSectionIdx = p.sectionIdx + 1;
      if (nextSectionIdx < template.sections.length) {
        return { sectionIdx: nextSectionIdx, fieldIdx: 0 };
      }
      // 완료
      setStatus('done');
      return p;
    });
    setTypedFieldCount((n) => n + 1);
  }, [template]);

  const pause = useCallback(() => {
    pausedAtRef.current = pointer;
    setStatus('paused');
  }, [pointer]);

  const resume = useCallback(() => {
    if (pausedAtRef.current) {
      setStatus('generating');
    }
  }, []);

  const toggleEdit = useCallback(() => {
    setStatus((s) => (s === 'editing' ? (typedFieldCount === totalFieldCount ? 'done' : 'paused') : 'editing'));
  }, [typedFieldCount, totalFieldCount]);

  const reset = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setTypedFieldCount(0);
    setPointer({ sectionIdx: 0, fieldIdx: 0 });
    setSourceStatus(
      Object.fromEntries(template.requiredSources.map((id) => [id, 'pending'])),
    );
    pausedAtRef.current = null;
  }, [template, clearTimers]);

  const skipToEnd = useCallback(() => {
    clearTimers();
    // 모든 소스 success
    setSourceStatus((prev) => {
      const next = { ...prev };
      template.requiredSources.forEach((id) => (next[id] = 'success'));
      return next;
    });
    setTypedFieldCount(totalFieldCount);
    setPointer({
      sectionIdx: template.sections.length - 1,
      fieldIdx: (template.sections[template.sections.length - 1]?.fields.length ?? 1) - 1,
    });
    setStatus('done');
  }, [template, totalFieldCount, clearTimers]);

  const progress = totalFieldCount > 0 ? (typedFieldCount / totalFieldCount) * 100 : 0;

  return {
    status,
    pointer,
    sourceStatus,
    typedFieldCount,
    totalFieldCount,
    progress,
    start,
    advanceField,
    pause,
    resume,
    toggleEdit,
    reset,
    skipToEnd,
  };
}
