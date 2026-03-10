import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClients, createClient, updateClient, deleteClient } from '@/api/firestore';
import { useAuthStore } from '@/store/authStore';
import type { Client } from '@/types/client';

export function useClients() {
  const officeId = useAuthStore(s => s.office?.id ?? '');
  return useQuery({
    queryKey: ['clients', officeId],
    queryFn: () => getClients(officeId),
    enabled: !!officeId,
  });
}

export function useCreateClient() {
  const officeId = useAuthStore(s => s.office?.id ?? '');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => createClient(officeId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients', officeId] }),
  });
}

export function useUpdateClient() {
  const officeId = useAuthStore(s => s.office?.id ?? '');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: Partial<Client> }) => updateClient(officeId, clientId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients', officeId] }),
  });
}

export function useDeleteClient() {
  const officeId = useAuthStore(s => s.office?.id ?? '');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => deleteClient(officeId, clientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients', officeId] }),
  });
}
