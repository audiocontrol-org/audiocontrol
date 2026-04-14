import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden mb-3">
      <div className="bg-gray-800 px-3 py-2 text-sm font-medium">{title}</div>
      <div className="divide-y divide-gray-800">{children}</div>
    </div>
  );
}
