import type { ReactNode } from 'react';

export function ParameterRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between py-1.5 px-3">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
