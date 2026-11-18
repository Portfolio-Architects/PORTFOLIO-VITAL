import { useMutation } from '@tanstack/react-query';

interface RecordContactPayload {
  nodeId: string;
  nodeLabel: string;
  phones: string[];
  emails: string[];
}

interface BatchRecordContactsPayload {
  contacts: Array<{
    nodeId: string;
    nodeLabel: string;
    phones: string[];
    emails: string[];
  }>;
}

export function useLocalContacts() {
  const recordContactMutation = useMutation({
    mutationFn: async (payload: RecordContactPayload) => {
      const res = await fetch('/api/local-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'API request failed');
      }
      return data;
    }
  });

  const batchRecordContactsMutation = useMutation({
    mutationFn: async (payload: BatchRecordContactsPayload) => {
      const res = await fetch('/api/local-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'API request failed');
      }
      return data;
    }
  });

  return {
    recordContactMutation,
    batchRecordContactsMutation
  };
}
