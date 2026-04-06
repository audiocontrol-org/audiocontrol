import { useState, useCallback } from 'react';
import {
  type TransportMode,
  type TransportConfig,
  getSavedTransportConfig,
  saveTransportConfig,
  getActiveTransportMode,
  getActiveHttpServerUrl,
  getActiveScsiUrl,
} from '@/transports/runtimeTransport';

export interface TransportSelectorProps {
  disabled?: boolean;
  /** When true, the Web MIDI option is disabled (e.g., browser doesn't support it) */
  webMidiUnsupported?: boolean;
}

const DEFAULT_HTTP_URL = 'http://localhost:7777';
const DEFAULT_SCSI_URL = '/scsi-bridge';

/**
 * Component for selecting MIDI transport type.
 *
 * When the transport is changed, the configuration is saved to localStorage
 * and the page is reloaded to apply the new transport.
 */
export function TransportSelector({ disabled = false, webMidiUnsupported = false }: TransportSelectorProps): JSX.Element {
  const currentMode = getActiveTransportMode();
  const currentHttpUrl = getActiveHttpServerUrl() ?? DEFAULT_HTTP_URL;
  const currentScsiUrl = getActiveScsiUrl() ?? DEFAULT_SCSI_URL;

  const initialMode = (webMidiUnsupported && currentMode === 'web') ? 'scsi' as TransportMode : currentMode;
  const [selectedMode, setSelectedMode] = useState<TransportMode>(initialMode);
  const [httpUrl, setHttpUrl] = useState(currentHttpUrl);
  const [scsiUrl, setScsiUrl] = useState(currentScsiUrl);
  const [showHttpConfig, setShowHttpConfig] = useState(initialMode === 'http');
  const [showScsiConfig, setShowScsiConfig] = useState(initialMode === 'scsi');

  const hasChanges = selectedMode !== currentMode ||
    (selectedMode === 'http' && httpUrl !== currentHttpUrl) ||
    (selectedMode === 'scsi' && scsiUrl !== currentScsiUrl);

  const handleModeChange = useCallback((mode: TransportMode) => {
    setSelectedMode(mode);
    setShowHttpConfig(mode === 'http');
    setShowScsiConfig(mode === 'scsi');
  }, []);

  const handleApply = useCallback(() => {
    const config: TransportConfig = {
      mode: selectedMode,
      httpServerUrl: selectedMode === 'http' ? httpUrl : undefined,
      scsiBridgeUrl: selectedMode === 'scsi' ? scsiUrl : undefined,
    };
    saveTransportConfig(config);

    // Reload to apply new transport
    window.location.reload();
  }, [selectedMode, httpUrl, scsiUrl]);

  return (
    <div className="ac-stack-sm">
      <div className="ac-field">
        <label className="ac-label">MIDI Transport</label>
        <div className="ac-radio-group">
          <label className="ac-radio-label">
            <input
              type="radio"
              name="transport"
              value="web"
              checked={selectedMode === 'web'}
              onChange={() => handleModeChange('web')}
              disabled={disabled || webMidiUnsupported}
              className="ac-radio"
            />
            <span>Web MIDI API</span>
            <span className="ac-text-muted ac-text-sm">
              {webMidiUnsupported ? ' — Not available in this browser' : ' — Browser\'s native MIDI'}
            </span>
          </label>
          <label className="ac-radio-label">
            <input
              type="radio"
              name="transport"
              value="http"
              checked={selectedMode === 'http'}
              onChange={() => handleModeChange('http')}
              disabled={disabled}
              className="ac-radio"
            />
            <span>HTTP MIDI Server</span>
            <span className="ac-text-muted ac-text-sm"> — External midi-server process</span>
          </label>
          <label className="ac-radio-label">
            <input
              type="radio"
              name="transport"
              value="scsi"
              checked={selectedMode === 'scsi'}
              onChange={() => handleModeChange('scsi')}
              disabled={disabled}
              className="ac-radio"
            />
            <span>SCSI Bridge</span>
            <span className="ac-text-muted ac-text-sm"> — MIDI via SCSI bridge on Raspberry Pi</span>
          </label>
        </div>
      </div>

      {showHttpConfig && (
        <div className="ac-field ac-ml-4">
          <label className="ac-label">Server URL</label>
          <input
            type="text"
            value={httpUrl}
            onChange={(e) => setHttpUrl(e.target.value)}
            placeholder="http://localhost:7777"
            disabled={disabled}
            className="ac-input"
          />
          <p className="ac-text-muted ac-text-sm ac-mt-1">
            The midi-server must be running at this address.
          </p>
        </div>
      )}

      {showScsiConfig && (
        <div className="ac-field ac-ml-4">
          <label className="ac-label">Bridge URL</label>
          <input
            type="text"
            value={scsiUrl}
            onChange={(e) => setScsiUrl(e.target.value)}
            placeholder={DEFAULT_SCSI_URL}
            disabled={disabled}
            className="ac-input"
          />
          <p className="ac-text-muted ac-text-sm ac-mt-1">
            The SCSI bridge daemon must be running at this address.
          </p>
        </div>
      )}

      {hasChanges && (
        <div className="ac-mt-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={disabled ||
              (selectedMode === 'http' && !httpUrl) ||
              (selectedMode === 'scsi' && !scsiUrl)}
            className="ac-btn ac-btn-primary"
          >
            Apply & Reload
          </button>
          <span className="ac-text-muted ac-text-sm ac-ml-2">
            Page will reload to apply changes
          </span>
        </div>
      )}
    </div>
  );
}
