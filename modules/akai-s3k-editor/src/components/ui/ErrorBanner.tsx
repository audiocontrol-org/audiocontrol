interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps): JSX.Element {
  return (
    <div className="mx-4 mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
      {message}
    </div>
  );
}
