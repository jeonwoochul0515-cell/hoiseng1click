import { useQuery } from '@tanstack/react-query';
import { getClient } from '@/api/firestore';
import { useAuthStore } from '@/store/authStore';

export function useClient(clientId: string) {
  const officeId = useAuthStore((s) => s.office?.id ?? '');
  return useQuery({
    queryKey: ['client', officeId, clientId],
    queryFn: () => getClient(officeId, clientId),
    enabled: !!officeId && !!clientId,
  });
}
