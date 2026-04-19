import { useMutation } from '@tanstack/react-query';
import { workerApi } from '@/api/worker';
import type { Client } from '@/types/client';
import type { DocType, DocFormat } from '@/types/document';

interface DocGenParams {
  client: Client;
  officeId: string;
  docType: DocType | 'all';
  format: DocFormat;
  userType?: 'office' | 'individual';
}

export function useDocGen() {
  return useMutation({
    mutationFn: async (params: DocGenParams) => {
      const res = await workerApi.generateDoc({
        clientId: params.client.id,
        officeId: params.officeId,
        docType: params.docType,
        format: params.format,
        clientData: params.client,
        userType: params.userType ?? 'office',
      });
      return res;
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    },
  });
}
