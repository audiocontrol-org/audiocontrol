import { Outlet, Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', label: 'Connect' },
  // Future navigation items:
  // { path: '/tones', label: 'Tones' },
  // { path: '/patch', label: 'Patch' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-d110-bg text-d110-text">
      {/* Header */}
      <header className="bg-d110-panel border-b border-d110-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold text-d110-highlight">D-110</div>
              <div className="text-sm text-d110-muted">Editor</div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                    location.pathname === item.path
                      ? 'bg-d110-surface text-d110-highlight'
                      : 'text-d110-muted hover:text-d110-text hover:bg-d110-surface'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-d110-panel border-t border-d110-border py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-d110-muted">
          <p>Roland D-110 Editor</p>
          <p className="mt-1">
            <a
              href="https://audiocontrol.org"
              className="text-d110-accent hover:text-d110-highlight"
              target="_blank"
              rel="noopener noreferrer"
            >
              audiocontrol.org
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
