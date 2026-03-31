import { cn } from '@/lib/utils';

interface ProgramListProps {
  programNames: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  isLoading: boolean;
}

export function ProgramList({
  programNames,
  selectedIndex,
  onSelect,
  isLoading,
}: ProgramListProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="card p-2">
        <div className="px-2 py-1 mb-2">
          <span className="text-sm font-medium text-gray-300">Programs</span>
        </div>
        <div className="ac-scroll-list flex items-center justify-center py-8">
          <span className="text-sm text-gray-500">Loading programs...</span>
        </div>
      </div>
    );
  }

  if (programNames.length === 0) {
    return (
      <div className="card p-2">
        <div className="px-2 py-1 mb-2">
          <span className="text-sm font-medium text-gray-300">Programs</span>
        </div>
        <div className="ac-scroll-list flex items-center justify-center py-8">
          <span className="text-sm text-gray-500">No programs loaded</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-2">
      <div className="px-2 py-1 mb-2">
        <span className="text-sm font-medium text-gray-300">Programs</span>
      </div>
      <div className="ac-scroll-list space-y-1">
        {programNames.map((name, index) => {
          const isSelected = index === selectedIndex;
          const isEmpty = name.trim() === '';

          return (
            <button
              key={index}
              data-testid={`program-item-${index}`}
              onClick={() => onSelect(index)}
              className={cn(
                'w-full px-3 py-2 rounded text-left text-sm transition-colors',
                'hover:bg-gray-700/50',
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isEmpty
                    ? 'text-gray-500/50'
                    : 'text-gray-300',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-6 text-right font-mono">
                  {index + 1}
                </span>
                <span
                  className={cn('truncate', isEmpty && 'italic')}
                  data-testid="program-name"
                >
                  {isEmpty ? '(empty)' : name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
