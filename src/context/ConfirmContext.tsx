import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmContextValue {
  confirm: (request: ConfirmRequest) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => {
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {request ? (
        <ConfirmDialog request={request} onClose={close} />
      ) : null}
    </ConfirmContext.Provider>
  );
};
