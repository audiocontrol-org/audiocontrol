/**
 * Partial Editor Container
 *
 * Organizes all partial parameter sections with collapsible UI.
 * Handles parameter updates and hardware sync.
 */

import { useCallback } from 'react';
import { CollapsibleSection } from '@audiocontrol/editor-core';
import { useD110Store, selectCurrentTone } from '@/stores';
import { useMidiStore } from '@/stores';
import { PartialSelector } from '@/components/ToneEditor/PartialSelector';
import {
  PitchSection,
  PitchEnvelopeSection,
  FilterSection,
  FilterEnvelopeSection,
  AmpSection,
  AmpEnvelopeSection,
  LfoSection,
} from '@/components/ToneEditor/partials';
import { PARTIAL_OFFSETS, PARTIAL_PARAM_OFFSETS } from '@/core/midi/constants';
import type { D110Tone, PartialParams, PitchEnvelope, TvfEnvelope, TvaEnvelope, LfoParams } from '@/core/midi/types';

export function PartialEditor(): JSX.Element {
  const client = useMidiStore((state) => state.client);
  const isConnected = useMidiStore((state) => state.status === 'connected');

  const selectedPart = useD110Store((state) => state.selectedPart);
  const selectedPartial = useD110Store((state) => state.selectedPartial);
  const tone = useD110Store(selectCurrentTone);
  const updatePartialParams = useD110Store((state) => state.updatePartialParams);
  const updatePitchEnvelope = useD110Store((state) => state.updatePitchEnvelope);
  const updateTvfEnvelope = useD110Store((state) => state.updateTvfEnvelope);
  const updateTvaEnvelope = useD110Store((state) => state.updateTvaEnvelope);
  const updateLfo = useD110Store((state) => state.updateLfo);

  // Get current partial data
  const partialKey = `partial${selectedPartial + 1}` as keyof Pick<
    D110Tone,
    'partial1' | 'partial2' | 'partial3' | 'partial4'
  >;
  const partial = tone?.[partialKey] as PartialParams | undefined;

  // Calculate address offset for current partial
  const partialOffset = PARTIAL_OFFSETS[selectedPartial];

  // Send parameter to hardware
  const sendParameter = useCallback(
    async (paramOffset: number, value: number) => {
      if (!client) return;
      try {
        await client.sendToneParameter(selectedPart, { aa: 0, bb: 0, cc: partialOffset + paramOffset }, value);
      } catch (err) {
        console.error('[PartialEditor] Failed to send parameter:', err);
      }
    },
    [client, selectedPart, partialOffset]
  );

  // Handler for partial parameter changes with immediate hardware sync
  const handlePartialChange = useCallback(
    (key: keyof PartialParams, value: number | boolean) => {
      updatePartialParams(selectedPart, selectedPartial, { [key]: value });
      // Send to hardware immediately
      const offset = getPartialParamOffset(key);
      if (offset !== null) {
        void sendParameter(offset, typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    },
    [selectedPart, selectedPartial, updatePartialParams, sendParameter]
  );

  // Handler for pitch envelope changes with immediate hardware sync
  const handlePitchEnvelopeChange = useCallback(
    (key: keyof PitchEnvelope, value: number) => {
      updatePitchEnvelope(selectedPart, selectedPartial, { [key]: value });
      const offset = getPitchEnvelopeOffset(key);
      if (offset !== null) {
        void sendParameter(offset, value);
      }
    },
    [selectedPart, selectedPartial, updatePitchEnvelope, sendParameter]
  );

  // Handler for TVF envelope changes with immediate hardware sync
  const handleTvfEnvelopeChange = useCallback(
    (key: keyof TvfEnvelope, value: number) => {
      updateTvfEnvelope(selectedPart, selectedPartial, { [key]: value });
      const offset = getTvfEnvelopeOffset(key);
      if (offset !== null) {
        void sendParameter(offset, value);
      }
    },
    [selectedPart, selectedPartial, updateTvfEnvelope, sendParameter]
  );

  // Handler for TVA envelope changes with immediate hardware sync
  const handleTvaEnvelopeChange = useCallback(
    (key: keyof TvaEnvelope, value: number) => {
      updateTvaEnvelope(selectedPart, selectedPartial, { [key]: value });
      const offset = getTvaEnvelopeOffset(key);
      if (offset !== null) {
        void sendParameter(offset, value);
      }
    },
    [selectedPart, selectedPartial, updateTvaEnvelope, sendParameter]
  );

  // Handler for LFO changes with immediate hardware sync
  const handleLfoChange = useCallback(
    (key: keyof LfoParams, value: number) => {
      updateLfo(selectedPart, selectedPartial, { [key]: value });
      const offset = getLfoOffset(key);
      if (offset !== null) {
        void sendParameter(offset, value);
      }
    },
    [selectedPart, selectedPartial, updateLfo, sendParameter]
  );

  if (!tone) {
    return (
      <div className="card">
        <div className="text-center text-d110-muted py-8">
          <p>No tone data loaded</p>
          <p className="text-sm mt-2">
            {isConnected
              ? 'Fetch tone data to edit partials'
              : 'Connect to your D-110 to start editing'}
          </p>
        </div>
      </div>
    );
  }

  if (!partial) {
    return (
      <div className="card">
        <div className="text-center text-d110-muted py-8">
          <p>Partial data not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-d110-highlight">
          Partial Parameters
        </h3>
        <PartialSelector />
      </div>

      <div className="space-y-3">
        {/* Pitch Section */}
        <CollapsibleSection
          title="Pitch"
          defaultOpen={true}
          theme={collapsibleTheme}
        >
          <PitchSection
            params={partial}
            onChange={handlePartialChange}
            structure12={tone.common.structure12}
            structure34={tone.common.structure34}
            partialIndex={selectedPartial}
          />
        </CollapsibleSection>

        {/* Pitch Envelope Section */}
        <CollapsibleSection
          title="Pitch Envelope"
          defaultOpen={false}
          theme={collapsibleTheme}
        >
          <PitchEnvelopeSection
            envelope={partial.pitchEnvelope}
            onChange={handlePitchEnvelopeChange}
          />
        </CollapsibleSection>

        {/* Filter Section */}
        <CollapsibleSection
          title="Filter (TVF)"
          defaultOpen={true}
          theme={collapsibleTheme}
        >
          <FilterSection
            params={partial}
            onChange={handlePartialChange}
            structure12={tone.common.structure12}
            structure34={tone.common.structure34}
            partialIndex={selectedPartial}
          />
        </CollapsibleSection>

        {/* Filter Envelope Section */}
        <CollapsibleSection
          title="Filter Envelope"
          defaultOpen={false}
          theme={collapsibleTheme}
        >
          <FilterEnvelopeSection
            envelope={partial.tvfEnvelope}
            onChange={handleTvfEnvelopeChange}
            structure12={tone.common.structure12}
            structure34={tone.common.structure34}
            partialIndex={selectedPartial}
          />
        </CollapsibleSection>

        {/* Amp Section */}
        <CollapsibleSection
          title="Amplifier (TVA)"
          defaultOpen={true}
          theme={collapsibleTheme}
        >
          <AmpSection
            params={partial}
            onChange={handlePartialChange}
          />
        </CollapsibleSection>

        {/* Amp Envelope Section */}
        <CollapsibleSection
          title="Amp Envelope"
          defaultOpen={false}
          theme={collapsibleTheme}
        >
          <AmpEnvelopeSection
            envelope={partial.tvaEnvelope}
            onChange={handleTvaEnvelopeChange}
          />
        </CollapsibleSection>

        {/* LFO Section */}
        <CollapsibleSection
          title="LFO"
          defaultOpen={true}
          theme={collapsibleTheme}
        >
          <LfoSection
            params={partial.lfo}
            onChange={handleLfoChange}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}

// Helper functions to map parameter keys to offsets
function getPartialParamOffset(key: keyof PartialParams): number | null {
  const mapping: Partial<Record<keyof PartialParams, number>> = {
    pitchCoarse: PARTIAL_PARAM_OFFSETS.PITCH_COARSE,
    pitchFine: PARTIAL_PARAM_OFFSETS.PITCH_FINE,
    pitchKeyfollow: PARTIAL_PARAM_OFFSETS.PITCH_KEYFOLLOW,
    pitchBenderSwitch: PARTIAL_PARAM_OFFSETS.PITCH_BENDER_SWITCH,
    waveform: PARTIAL_PARAM_OFFSETS.WAVEFORM,
    pcmWaveNumber: PARTIAL_PARAM_OFFSETS.PCM_WAVE_NUMBER,
    pulseWidth: PARTIAL_PARAM_OFFSETS.PULSE_WIDTH,
    pulseWidthVelocity: PARTIAL_PARAM_OFFSETS.PULSE_WIDTH_VELOCITY,
    tvfCutoff: PARTIAL_PARAM_OFFSETS.TVF_CUTOFF,
    tvfResonance: PARTIAL_PARAM_OFFSETS.TVF_RESONANCE,
    tvfKeyfollow: PARTIAL_PARAM_OFFSETS.TVF_KEYFOLLOW,
    tvfBiasPoint: PARTIAL_PARAM_OFFSETS.TVF_BIAS_POINT,
    tvfBiasLevel: PARTIAL_PARAM_OFFSETS.TVF_BIAS_LEVEL,
    tvaLevel: PARTIAL_PARAM_OFFSETS.TVA_LEVEL,
    tvaVelocitySensitivity: PARTIAL_PARAM_OFFSETS.TVA_VELOCITY,
    tvaBiasPoint1: PARTIAL_PARAM_OFFSETS.TVA_BIAS_POINT_1,
    tvaBiasLevel1: PARTIAL_PARAM_OFFSETS.TVA_BIAS_LEVEL_1,
    tvaBiasPoint2: PARTIAL_PARAM_OFFSETS.TVA_BIAS_POINT_2,
    tvaBiasLevel2: PARTIAL_PARAM_OFFSETS.TVA_BIAS_LEVEL_2,
  };
  return mapping[key] ?? null;
}

function getPitchEnvelopeOffset(key: keyof PitchEnvelope): number {
  const mapping: Record<keyof PitchEnvelope, number> = {
    depth: PARTIAL_PARAM_OFFSETS.PITCH_ENV_DEPTH,
    velocitySensitivity: PARTIAL_PARAM_OFFSETS.PITCH_ENV_VELOCITY,
    timeKeyfollow: PARTIAL_PARAM_OFFSETS.PITCH_ENV_TIME_KF,
    time1: PARTIAL_PARAM_OFFSETS.PITCH_ENV_T1,
    time2: PARTIAL_PARAM_OFFSETS.PITCH_ENV_T2,
    time3: PARTIAL_PARAM_OFFSETS.PITCH_ENV_T3,
    time4: PARTIAL_PARAM_OFFSETS.PITCH_ENV_T4,
    level0: PARTIAL_PARAM_OFFSETS.PITCH_ENV_L0,
    level1: PARTIAL_PARAM_OFFSETS.PITCH_ENV_L1,
    level2: PARTIAL_PARAM_OFFSETS.PITCH_ENV_L2,
    sustainLevel: PARTIAL_PARAM_OFFSETS.PITCH_ENV_SUS_L,
    endLevel: PARTIAL_PARAM_OFFSETS.PITCH_ENV_END_L,
  };
  return mapping[key];
}

const collapsibleTheme = {
  container: 'border border-d110-border rounded-md overflow-hidden',
  headerButton: 'w-full flex items-center justify-between px-4 py-2 bg-d110-surface hover:bg-d110-border transition-colors',
  title: 'text-sm font-medium text-d110-text',
  icon: 'text-d110-muted',
  body: 'p-4',
};

function getTvfEnvelopeOffset(key: keyof TvfEnvelope): number {
  const mapping: Record<keyof TvfEnvelope, number> = {
    depth: PARTIAL_PARAM_OFFSETS.TVF_ENV_DEPTH,
    velocitySensitivity: PARTIAL_PARAM_OFFSETS.TVF_ENV_VELOCITY,
    depthKeyfollow: PARTIAL_PARAM_OFFSETS.TVF_ENV_DEPTH_KF,
    timeKeyfollow: PARTIAL_PARAM_OFFSETS.TVF_ENV_TIME_KF,
    time1: PARTIAL_PARAM_OFFSETS.TVF_ENV_T1,
    time2: PARTIAL_PARAM_OFFSETS.TVF_ENV_T2,
    time3: PARTIAL_PARAM_OFFSETS.TVF_ENV_T3,
    time4: PARTIAL_PARAM_OFFSETS.TVF_ENV_T4,
    time5: PARTIAL_PARAM_OFFSETS.TVF_ENV_T5,
    level1: PARTIAL_PARAM_OFFSETS.TVF_ENV_L1,
    level2: PARTIAL_PARAM_OFFSETS.TVF_ENV_L2,
    level3: PARTIAL_PARAM_OFFSETS.TVF_ENV_L3,
    sustainLevel: PARTIAL_PARAM_OFFSETS.TVF_ENV_SUS_L,
  };
  return mapping[key];
}

function getTvaEnvelopeOffset(key: keyof TvaEnvelope): number {
  const mapping: Record<keyof TvaEnvelope, number> = {
    timeKeyfollow: PARTIAL_PARAM_OFFSETS.TVA_ENV_TIME_KF,
    time1Velocity: PARTIAL_PARAM_OFFSETS.TVA_ENV_T1_VELOCITY,
    time1: PARTIAL_PARAM_OFFSETS.TVA_ENV_T1,
    time2: PARTIAL_PARAM_OFFSETS.TVA_ENV_T2,
    time3: PARTIAL_PARAM_OFFSETS.TVA_ENV_T3,
    time4: PARTIAL_PARAM_OFFSETS.TVA_ENV_T4,
    time5: PARTIAL_PARAM_OFFSETS.TVA_ENV_T5,
    level1: PARTIAL_PARAM_OFFSETS.TVA_ENV_L1,
    level2: PARTIAL_PARAM_OFFSETS.TVA_ENV_L2,
    level3: PARTIAL_PARAM_OFFSETS.TVA_ENV_L3,
    sustainLevel: PARTIAL_PARAM_OFFSETS.TVA_ENV_SUS_L,
  };
  return mapping[key];
}

function getLfoOffset(key: keyof LfoParams): number {
  const mapping: Record<keyof LfoParams, number> = {
    rate: PARTIAL_PARAM_OFFSETS.LFO_RATE,
    depth: PARTIAL_PARAM_OFFSETS.LFO_DEPTH,
    modulationSensitivity: PARTIAL_PARAM_OFFSETS.LFO_MOD_SENS,
  };
  return mapping[key];
}
