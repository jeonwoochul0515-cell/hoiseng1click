import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient, updateClient } from '@/api/firestore';
import { getIndividualAsClient, updateIndividualClient } from '@/api/individualClient';
import { useAuthStore } from '@/store/authStore';
import type { Client } from '@/types/client';

/**
 * 현재 로그인 사용자 타입에 따라 "의뢰인" Client 를 로드.
 * - B2B(office + clientId): offices/{officeId}/clients/{clientId}
 * - B2C(individual):        individuals/{userId} (본인)
 * clientId 가 없고 B2C 면 본인 UID 사용.
 */
export function useCurrentClient(clientId?: string) {
  const userType = useAuthStore((s) => s.userType);
  const officeId = useAuthStore((s) => s.office?.id ?? '');
  const uid = useAuthStore((s) => s.user?.uid ?? '');

  const isIndividual = userType === 'individual';
  const targetId = clientId || uid;

  return useQuery({
    queryKey: isIndividual
      ? ['current-client', 'individual', uid]
      : ['current-client', 'office', officeId, targetId],
    queryFn: () =>
      isIndividual
        ? getIndividualAsClient(uid)
        : getClient(officeId, targetId),
    enabled: isIndividual ? !!uid : (!!officeId && !!targetId),
  });
}

/** 현재 의뢰인 업데이트 훅 — B2B/B2C 자동 분기 */
export function useUpdateCurrentClient(clientId?: string) {
  const userType = useAuthStore((s) => s.userType);
  const officeId = useAuthStore((s) => s.office?.id ?? '');
  const uid = useAuthStore((s) => s.user?.uid ?? '');
  const qc = useQueryClient();

  const isIndividual = userType === 'individual';
  const targetId = clientId || uid;

  return useMutation({
    mutationFn: (data: Partial<Client>) =>
      isIndividual
        ? updateIndividualClient(uid, data)
        : updateClient(officeId, targetId, data),
    onSuccess: () => {
      if (isIndividual) {
        qc.invalidateQueries({ queryKey: ['current-client', 'individual', uid] });
      } else {
        qc.invalidateQueries({ queryKey: ['current-client', 'office', officeId, targetId] });
        qc.invalidateQueries({ queryKey: ['clients', officeId] });
      }
    },
  });
}
