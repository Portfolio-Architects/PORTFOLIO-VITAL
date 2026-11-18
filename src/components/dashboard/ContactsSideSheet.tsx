'use client';

import React, { useEffect } from 'react';
import { ContactsBox } from './ContactsBox';

export interface ContactsSideSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Right-anchored slide-over side sheet hosting the Business Contacts directory. */
export function ContactsSideSheet({ isOpen, onClose }: ContactsSideSheetProps) {
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end modal-backdrop"
      onClick={onClose}
    >
      <aside
        id="contacts-side-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="업무 연락처"
        className="w-full sm:w-[520px] md:w-[580px] max-w-full h-full bg-white border-l border-slate-200/90 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <ContactsBox variant="sheet" onClose={onClose} />
      </aside>
    </div>
  );
}

export default ContactsSideSheet;
