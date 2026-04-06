/**
 * DeviceMemoryPanel — displays programs and samples resident in device memory.
 *
 * Renders two scrollable lists (programs and samples) fetched from the
 * S3000XL. Supports item selection and manual refresh. Shows a placeholder
 * message when the device is not connected.
 */

interface DeviceMemoryPanelProps {
  programNames: string[];
  sampleNames: string[];
  selectedIndex: number | null;
  selectedType: 'program' | 'sample' | null;
  onSelectProgram: (index: number) => void;
  onSelectSample: (index: number) => void;
  onRefresh: () => void;
  isConnected: boolean;
  isLoading: boolean;
}

function NameList({
  title,
  names,
  type,
  selectedIndex,
  selectedType,
  onSelect,
}: {
  title: string;
  names: string[];
  type: 'program' | 'sample';
  selectedIndex: number | null;
  selectedType: 'program' | 'sample' | null;
  onSelect: (index: number) => void;
}) {
  if (names.length === 0) {
    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
          {title}
        </h4>
        <p className="text-sm text-gray-500 italic">None</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {title} ({names.length})
      </h4>
      <ul className="max-h-48 overflow-y-auto space-y-px">
        {names.map((name, index) => {
          const isSelected = selectedType === type && selectedIndex === index;
          return (
            <li key={index}>
              <button
                type="button"
                className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => onSelect(index)}
              >
                <span className="text-gray-500 mr-2 tabular-nums">{index}:</span>
                {name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DeviceMemoryPanel({
  programNames,
  sampleNames,
  selectedIndex,
  selectedType,
  onSelectProgram,
  onSelectSample,
  onRefresh,
  isConnected,
  isLoading,
}: DeviceMemoryPanelProps): JSX.Element {
  if (!isConnected) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Device Memory</h3>
        <p className="text-sm text-gray-400 italic">
          Connect to S3000XL first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-100">Device Memory</h3>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-200 text-lg px-1 disabled:opacity-50"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh device memory"
        >
          {isLoading ? '...' : '\u21BB'}
        </button>
      </div>

      <NameList
        title="Programs"
        names={programNames}
        type="program"
        selectedIndex={selectedIndex}
        selectedType={selectedType}
        onSelect={onSelectProgram}
      />

      <NameList
        title="Samples"
        names={sampleNames}
        type="sample"
        selectedIndex={selectedIndex}
        selectedType={selectedType}
        onSelect={onSelectSample}
      />
    </div>
  );
}
