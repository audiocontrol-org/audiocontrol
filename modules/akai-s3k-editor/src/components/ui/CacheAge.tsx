import { useState, useEffect } from 'react';

interface CacheAgeProps {
  timestamp: number | null;
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** Shows a relative "last refreshed" timestamp that updates every 10s. */
export function CacheAge({ timestamp }: CacheAgeProps): JSX.Element | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timestamp) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return null;

  const age = Date.now() - timestamp;
  return (
    <span className="text-xs text-gray-500" title={new Date(timestamp).toLocaleTimeString()}>
      {formatAge(age)}
    </span>
  );
}
