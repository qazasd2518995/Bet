'use client';

import { ReactNode } from 'react';

interface ClientBodyProps {
  children: ReactNode;
}

export default function ClientBody({ children }: ClientBodyProps) {
  return (
    <div suppressHydrationWarning>
      {children}
    </div>
  );
} 