import { NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

export function Layout({ children }: PropsWithChildren): JSX.Element {
  return (
    <div className="app-shell">
      <header className="panel">
        <h1>Roland JV-1080 Editor</h1>
        <p>Phase 3 scaffold: MIDI connection flow and base routing.</p>
        <nav className="row">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/editor">Editor</NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
