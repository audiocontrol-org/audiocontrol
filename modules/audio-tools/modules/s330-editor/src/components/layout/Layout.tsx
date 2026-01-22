/**
 * Main application layout
 */

import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { MidiStatus } from '@/components/midi/MidiStatus';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Connect' },
  { to: '/patches', label: 'Patches' },
  { to: '/tones', label: 'Tones' },
  { to: '/sampling', label: 'Sampling' },
  { to: '/library', label: 'Library' },
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-s330-bg">
      {/* Header */}
      <header className="bg-s330-panel border-b border-s330-accent">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-s330-text">
                <span className="text-s330-highlight">S-330</span> Editor
              </h1>
              <span className="text-xs text-s330-muted">Roland Sampler</span>
            </div>

            {/* MIDI Status */}
            <MidiStatus />
          </div>

          {/* Navigation */}
          <nav className="mt-3">
            <ul className="flex gap-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'px-4 py-2 rounded-t-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-s330-bg text-s330-text'
                          : 'text-s330-muted hover:text-s330-text hover:bg-s330-accent/50'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-s330-accent py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-s330-muted">
          S-330 Editor uses Web MIDI API for direct browser-to-hardware communication.
          <br />
          Requires Chrome, Edge, or Opera browser.
        </div>
      </footer>
    </div>
  );
}
