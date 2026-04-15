import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  children: ReactNode
}

export function Section({ title, children }: SectionProps) {
  return (
    <div className="border-b border-crt-border pb-4 mb-4 last:border-b-0 last:mb-0 last:pb-0">
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}
