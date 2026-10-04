import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopToolbar } from './TopToolbar';

export function EditorLayout({
  children,
  leftPanel,
  rightPanel,
}: {
  children: ReactNode;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--retell-bg)] font-sans text-[var(--retell-text)]">
      <Sidebar />
      <div className="flex flex-col flex-1 h-full min-w-0">
        <TopToolbar />
        <div className="flex flex-1 overflow-hidden relative min-w-0">
          <main className="flex-1 h-full w-full relative min-w-0">{children}</main>
          {leftPanel && (
            <div className="absolute inset-y-4 left-4 z-20 pointer-events-none">{leftPanel}</div>
          )}
          {rightPanel && (
            <div className="absolute inset-y-4 right-4 z-20 pointer-events-none">{rightPanel}</div>
          )}
        </div>
      </div>
    </div>
  );
}
