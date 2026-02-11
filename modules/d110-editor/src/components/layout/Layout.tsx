/**
 * Main application layout
 */

import { ReactNode, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { MidiStatus } from '@/components/midi/MidiStatus';
import { useMidiStore } from '@/stores/midiStore';
import { cn } from '@/lib/utils';

/**
 * Panic button component - sends All Notes Off on all channels
 */
function PanicButton(): JSX.Element {
  const status = useMidiStore((state) => state.status);
  const sendPanic = useMidiStore((state) => state.sendPanic);

  const handlePanic = useCallback(() => {
    sendPanic();
  }, [sendPanic]);

  const isConnected = status === 'connected';

  return (
    <button
      onClick={handlePanic}
      disabled={!isConnected}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded transition-colors',
        isConnected
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-d110-muted/30 text-d110-muted cursor-not-allowed'
      )}
      title={isConnected ? 'Send All Notes Off on all channels' : 'Connect to MIDI to enable'}
    >
      PANIC
    </button>
  );
}

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Connect' },
  { to: '/tones', label: 'Tones' },
  { to: '/patches', label: 'Patches' },
];

export function Layout({ children }: LayoutProps): JSX.Element {
  const initialize = useMidiStore((state) => state.initialize);

  // Initialize MIDI on app start
  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-d110-bg">
      {/* Header */}
      <header className="bg-d110-panel border-b border-d110-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-d110-text">
                <span className="text-d110-highlight">D-110</span> Editor
              </h1>
              <span className="text-xs text-d110-muted">Roland LA Synthesizer</span>
            </div>

            {/* MIDI Status and Panic Button */}
            <div className="flex items-center gap-3">
              <PanicButton />
              <MidiStatus />
            </div>
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
                          ? 'bg-d110-bg text-d110-text'
                          : 'text-d110-muted hover:text-d110-text hover:bg-d110-surface/50'
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
      <footer className="border-t border-d110-border py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-d110-muted">
          D-110 Editor uses Web MIDI API for direct browser-to-hardware communication.
          <br />
          Requires Chrome, Edge, or Opera browser.
        </div>
      </footer>
    </div>
  );
}
