import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationArea } from './NotificationArea';
import type { Notification } from '@/hooks/useNotifications';

describe('NotificationArea', () => {
  const makeNotification = (
    overrides: Partial<Notification> = {},
  ): Notification => ({
    id: 1,
    level: 'info',
    text: 'Test notification',
    ...overrides,
  });

  it('renders nothing when notifications is empty', () => {
    const html = renderToStaticMarkup(
      <NotificationArea notifications={[]} onDismiss={() => {}} />,
    );
    expect(html).toBe('');
  });

  it('renders info notification with status role', () => {
    const n = makeNotification({ level: 'info', text: 'Saved' });
    const html = renderToStaticMarkup(
      <NotificationArea notifications={[n]} onDismiss={() => {}} />,
    );
    expect(html).toContain('Saved');
    expect(html).toContain('role="status"');
    expect(html).toContain('ac-alert');
    expect(html).not.toContain('ac-alert-error');
  });

  it('renders error notification with alert role and error class', () => {
    const n = makeNotification({ level: 'error', text: 'Failed' });
    const html = renderToStaticMarkup(
      <NotificationArea notifications={[n]} onDismiss={() => {}} />,
    );
    expect(html).toContain('Failed');
    expect(html).toContain('role="alert"');
    expect(html).toContain('ac-alert-error');
  });

  it('renders copy and dismiss buttons for each notification', () => {
    const n = makeNotification({ text: 'Something' });
    const html = renderToStaticMarkup(
      <NotificationArea notifications={[n]} onDismiss={() => {}} />,
    );
    expect(html).toContain('>copy</button>');
    expect(html).toContain('>dismiss</button>');
  });

  it('renders multiple notifications', () => {
    const notifications = [
      makeNotification({ id: 1, text: 'First' }),
      makeNotification({ id: 2, text: 'Second', level: 'error' }),
    ];
    const html = renderToStaticMarkup(
      <NotificationArea notifications={notifications} onDismiss={() => {}} />,
    );
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });

  it('wraps notifications in ac-notification-area container', () => {
    const n = makeNotification();
    const html = renderToStaticMarkup(
      <NotificationArea notifications={[n]} onDismiss={() => {}} />,
    );
    expect(html).toContain('ac-notification-area');
  });
});
