import type { ReactNode } from 'react';
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl px-6 py-9 md:px-9"
    >
      {children}
    </main>
  );
}
