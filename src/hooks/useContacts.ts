'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readSheet, addRow, updateRow, deleteRow, replaceAll } from '@/lib/sheets-api';
import { Contact, generateId } from '@/types';

export function useContacts() {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ['CONTACTS'],
    queryFn: () => readSheet<Contact>('CONTACTS'),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
  });

  // Pre-indexed O(1) lookup Map for contacts by ID
  const contactsByIdMap = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) {
      map.set(c.id, c);
    }
    return map;
  }, [contacts]);

  const replaceContactsMut = useMutation({
    mutationFn: (newContacts: Contact[]) => replaceAll('CONTACTS', newContacts),
    onMutate: async (newContacts) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      queryClient.setQueryData<Contact[]>(['CONTACTS'], newContacts);
      return { previous };
    },
    onError: (err, newContacts, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const addContactMut = useMutation({
    mutationFn: (newContact: Contact) => addRow('CONTACTS', newContact),
    onMutate: async (newContact) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      queryClient.setQueryData<Contact[]>(['CONTACTS'], (old) => [newContact, ...(old || [])]);
      return { previous };
    },
    onError: (err, newContact, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const updateContactMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contact> }) => updateRow('CONTACTS', id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      const updatedFields = { ...updates, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<Contact[]>(['CONTACTS'], (old) => {
        if (!old) return [];
        const result: Contact[] = [];
        for (let i = 0; i < old.length; i++) {
          const c = old[i];
          result.push(c.id === id ? { ...c, ...updatedFields } : c);
        }
        return result;
      });
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });

  const deleteContactMut = useMutation({
    mutationFn: (id: string) => deleteRow('CONTACTS', id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['CONTACTS'] });
      const previous = queryClient.getQueryData<Contact[]>(['CONTACTS']);
      queryClient.setQueryData<Contact[]>(['CONTACTS'], (old) => {
        if (!old) return [];
        const result: Contact[] = [];
        for (let i = 0; i < old.length; i++) {
          if (old[i].id !== id) result.push(old[i]);
        }
        return result;
      });
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(['CONTACTS'], context.previous);
    },
  });


  const addContact = useCallback((contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...contact,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    addContactMut.mutate(newContact);
    return newContact;
  }, [addContactMut]);

  const updateContact = useCallback((id: string, updates: Partial<Contact>) => {
    updateContactMut.mutate({ id, updates });
  }, [updateContactMut]);

  const deleteContact = useCallback((id: string) => {
    deleteContactMut.mutate(id);
  }, [deleteContactMut]);

  const replaceContacts = useCallback((newContacts: Contact[]) => {
    replaceContactsMut.mutate(newContacts);
  }, [replaceContactsMut]);

  const getContactById = useCallback((id: string) => {
    return contactsByIdMap.get(id);
  }, [contactsByIdMap]);

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    replaceContacts,
    getContactById
  };
}
