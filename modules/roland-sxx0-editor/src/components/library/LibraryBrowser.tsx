/**
 * Library Browser Component
 *
 * Displays the contents of the sampler library with categories for
 * tones, patches, and templates. Allows browsing, previewing, and importing.
 */

import { useCallback, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import type { ToneYaml } from '@audiocontrol/sampler-library/browser';
import { useLibraryStore, type LibraryItemSummary } from '@/stores/libraryStore';
import { cn } from '@/lib/utils';

interface LibraryBrowserProps {
  /** Callback to load library contents */
  onLoadLibrary: () => Promise<void>;
  /** Callback to load a specific tone */
  onLoadTone: (filename: string) => Promise<ToneYaml>;
  /** Callback when user wants to import a tone */
  onImportTone: (tone: ToneYaml) => void;
}

/**
 * Library item list component
 */
function ItemList({
  items,
  selectedName,
  onSelect,
  emptyMessage,
}: {
  items: Map<string, LibraryItemSummary>;
  selectedName: string | null;
  onSelect: (name: string) => void;
  emptyMessage: string;
}): JSX.Element {
  const itemArray = Array.from(items.entries());

  if (itemArray.length === 0) {
    return (
      <div className="text-center py-8 text-s330-muted text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {itemArray.map(([filename, item]) => (
        <button
          key={filename}
          onClick={() => onSelect(filename)}
          className={cn(
            'w-full text-left px-3 py-2 rounded text-sm transition-colors',
            selectedName === filename
              ? 'bg-s330-highlight/20 text-s330-highlight'
              : 'text-s330-text hover:bg-s330-accent/30'
          )}
        >
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-xs text-s330-muted truncate">{filename}</div>
        </button>
      ))}
    </div>
  );
}

/**
 * Tone preview panel
 */
function TonePreview({
  tone,
  onImport,
}: {
  tone: ToneYaml | null;
  onImport: () => void;
}): JSX.Element {
  if (!tone) {
    return (
      <div className="text-center py-8 text-s330-muted text-sm">
        Select a tone to preview
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-s330-text">{tone.name}</h4>
        <button onClick={onImport} className="ac-btn ac-btn-sm ac-btn-primary">
          Import
        </button>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted">Sample Rate:</span>
            <span className="ml-2 text-s330-text">{tone.wave.sampleRate} Hz</span>
          </div>
          <div>
            <span className="text-s330-muted">Loop Mode:</span>
            <span className="ml-2 text-s330-text capitalize">{tone.wave.loopMode}</span>
          </div>
        </div>

        {tone.s330 && (
          <>
            <hr className="border-s330-accent/30" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-s330-muted">Original Key:</span>
                <span className="ml-2 text-s330-text">{tone.s330.originalKey}</span>
              </div>
              <div>
                <span className="text-s330-muted">Output:</span>
                <span className="ml-2 text-s330-text">
                  {tone.s330.outputAssign === 0 ? 'Mix' : `Out ${tone.s330.outputAssign}`}
                </span>
              </div>
              <div>
                <span className="text-s330-muted">TVA Level:</span>
                <span className="ml-2 text-s330-text">{tone.s330.tva?.level ?? '-'}</span>
              </div>
              {tone.s330.tvf && (
                <div>
                  <span className="text-s330-muted">TVF:</span>
                  <span className="ml-2 text-s330-text">
                    {tone.s330.tvf.enabled ? 'ON' : 'OFF'}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function LibraryBrowser({
  onLoadLibrary,
  onLoadTone,
  onImportTone,
}: LibraryBrowserProps): JSX.Element {
  const {
    tones,
    patches,
    templates,
    loadedTones,
    isLoading,
    loadingMessage,
    error,
    selectedCategory,
    selectedItemName,
    setSelectedCategory,
    setSelectedItem,
    cacheTone,
  } = useLibraryStore();

  // Load library on mount
  useEffect(() => {
    onLoadLibrary();
  }, [onLoadLibrary]);

  // Load tone details when selected
  useEffect(() => {
    if (selectedCategory !== 'tones' || !selectedItemName) return;
    if (loadedTones.has(selectedItemName)) return;

    onLoadTone(selectedItemName)
      .then((tone) => cacheTone(selectedItemName, tone))
      .catch((err) => console.error('Failed to load tone:', err));
  }, [selectedCategory, selectedItemName, loadedTones, onLoadTone, cacheTone]);

  const handleImportTone = useCallback(() => {
    if (!selectedItemName) return;
    const tone = loadedTones.get(selectedItemName);
    if (tone) {
      onImportTone(tone);
    }
  }, [selectedItemName, loadedTones, onImportTone]);

  const selectedTone = selectedItemName ? loadedTones.get(selectedItemName) ?? null : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-s330-accent">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-s330-text">Library</h3>
          <button
            onClick={onLoadLibrary}
            disabled={isLoading}
            className={cn(
              'text-s330-muted hover:text-s330-text transition-colors',
              isLoading && 'animate-spin'
            )}
            title="Refresh library"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <p className="text-xs text-s330-muted">{loadingMessage || 'Loading...'}</p>
        )}

        {/* Error display */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Category Tabs */}
      <Tabs.Root
        value={selectedCategory}
        onValueChange={(v) => setSelectedCategory(v as 'tones' | 'patches' | 'templates')}
        className="flex-1 flex flex-col min-h-0"
      >
        <Tabs.List className="flex border-b border-s330-accent">
          <Tabs.Trigger
            value="tones"
            data-testid="library-tones-tab"
            className={cn(
              'flex-1 px-3 py-2 text-sm transition-colors',
              selectedCategory === 'tones'
                ? 'text-s330-highlight border-b-2 border-s330-highlight'
                : 'text-s330-muted hover:text-s330-text'
            )}
          >
            Tones ({tones.size})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="patches"
            data-testid="library-patches-tab"
            className={cn(
              'flex-1 px-3 py-2 text-sm transition-colors',
              selectedCategory === 'patches'
                ? 'text-s330-highlight border-b-2 border-s330-highlight'
                : 'text-s330-muted hover:text-s330-text'
            )}
          >
            Patches ({patches.size})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="templates"
            data-testid="library-templates-tab"
            className={cn(
              'flex-1 px-3 py-2 text-sm transition-colors',
              selectedCategory === 'templates'
                ? 'text-s330-highlight border-b-2 border-s330-highlight'
                : 'text-s330-muted hover:text-s330-text'
            )}
          >
            Templates ({templates.size})
          </Tabs.Trigger>
        </Tabs.List>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs.Content value="tones" className="flex-1 flex flex-col min-h-0 data-[state=inactive]:hidden">
            <div className="flex-1 overflow-y-auto p-2">
              <ItemList
                items={tones}
                selectedName={selectedItemName}
                onSelect={setSelectedItem}
                emptyMessage="No tones in library"
              />
            </div>
            {selectedItemName && (
              <div className="border-t border-s330-accent p-3">
                <TonePreview tone={selectedTone} onImport={handleImportTone} />
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="patches" className="flex-1 overflow-y-auto p-2 data-[state=inactive]:hidden">
            <ItemList
              items={patches}
              selectedName={selectedItemName}
              onSelect={setSelectedItem}
              emptyMessage="No patches in library"
            />
          </Tabs.Content>

          <Tabs.Content value="templates" className="flex-1 overflow-y-auto p-2 data-[state=inactive]:hidden">
            <ItemList
              items={templates}
              selectedName={selectedItemName}
              onSelect={setSelectedItem}
              emptyMessage="No templates in library"
            />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
