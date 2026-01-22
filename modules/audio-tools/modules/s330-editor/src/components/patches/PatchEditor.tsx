/**
 * Patch editor component
 */

import type { S330Patch } from '@/core/midi/S330Client';
import { midiNoteToName, formatPercent, formatPan } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';

interface PatchEditorProps {
  patch: S330Patch;
  index: number;
}

export function PatchEditor({ patch, index }: PatchEditorProps) {
  const { common, partials } = patch;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm text-s330-muted">Patch {index + 1}</span>
            <h3 className="text-xl font-bold text-s330-text font-mono">
              {common.name || '(unnamed)'}
            </h3>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary text-sm">
              Save to Library
            </button>
            <button className="btn btn-primary text-sm">
              Send to S-330
            </button>
          </div>
        </div>

        {/* Common Parameters */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs text-s330-muted">Key Mode</label>
            <div className="text-sm text-s330-text capitalize">{common.keyMode}</div>
          </div>
          {common.keyMode === 'split' && (
            <div>
              <label className="text-xs text-s330-muted">Split Point</label>
              <div className="text-sm text-s330-text">
                {midiNoteToName(common.splitPoint)} ({common.splitPoint})
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-s330-muted">Bender Range</label>
            <div className="text-sm text-s330-text">{common.benderRange} semitones</div>
          </div>
          <div>
            <label className="text-xs text-s330-muted">Output</label>
            <div className="text-sm text-s330-text">
              {common.outputAssign === 0 ? 'Mix' : `Output ${common.outputAssign}`}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ParameterSlider
            label="Level"
            value={common.level}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Aftertouch Sensitivity"
            value={common.aftertouchSens}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Portamento Time"
            value={common.portamentoTime}
            onChange={() => {}}
            formatValue={formatPercent}
            disabled={!common.portamentoEnabled}
          />
        </div>
      </div>

      {/* Partials */}
      <div className="card">
        <h4 className="font-medium text-s330-text mb-4">
          Partials ({partials.length})
        </h4>
        {partials.length === 0 ? (
          <p className="text-s330-muted text-sm">No partials defined</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-s330-muted border-b border-s330-accent">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Tone</th>
                  <th className="pb-2 pr-4">Key Range</th>
                  <th className="pb-2 pr-4">Vel Range</th>
                  <th className="pb-2 pr-4">Level</th>
                  <th className="pb-2 pr-4">Pan</th>
                  <th className="pb-2 pr-4">Tune</th>
                  <th className="pb-2">Mute</th>
                </tr>
              </thead>
              <tbody>
                {partials.map((partial, i) => (
                  <tr
                    key={i}
                    className="border-b border-s330-accent/50 text-s330-text"
                  >
                    <td className="py-2 pr-4 font-mono">{i + 1}</td>
                    <td className="py-2 pr-4">Tone {partial.toneNumber + 1}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {midiNoteToName(partial.keyRangeLow)} - {midiNoteToName(partial.keyRangeHigh)}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {partial.velRangeLow}-{partial.velRangeHigh}
                    </td>
                    <td className="py-2 pr-4">{formatPercent(partial.level)}</td>
                    <td className="py-2 pr-4">{formatPan(partial.pan)}</td>
                    <td className="py-2 pr-4 text-xs">
                      {partial.coarseTune - 64}/{partial.fineTune - 64}
                    </td>
                    <td className="py-2">
                      {partial.muted && (
                        <span className="text-xs text-s330-highlight">MUTED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
