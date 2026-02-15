import { useEffect, useState } from 'react';
import { Jv1080Event, type Jv1080FxParamEvent } from '@audiocontrol/sampler-devices/jv1080';
import {
  applyFxParam,
  applyFxType,
  clamp7Bit,
  clampFxType,
  DEFAULT_FX_STATE,
  FX_PARAM_COUNT,
  FX_TYPE_LABELS,
  type FxClient,
  type FxState,
} from '@/system/fxControls';

interface FxSubscribable {
  subscribe(event: Jv1080Event.FxType, listener: (value: number) => void): () => void;
  subscribe(event: Jv1080Event.FxParam, listener: (event: Jv1080FxParamEvent) => void): () => void;
  getFxParameter(index: number): number | undefined;
}

interface FxControlsProps {
  client: (FxClient & FxSubscribable) | null;
  connected: boolean;
}

export function FxControls({ client, connected }: FxControlsProps): JSX.Element {
  const [state, setState] = useState<FxState>(DEFAULT_FX_STATE);

  useEffect(() => {
    if (!connected || !client) {
      return;
    }

    setState((prev) => {
      const nextParams = [...prev.fxParams];
      for (let i = 0; i < FX_PARAM_COUNT; i += 1) {
        const value = client.getFxParameter(i);
        if (typeof value === 'number') {
          nextParams[i] = clamp7Bit(value);
        }
      }
      return { ...prev, fxParams: nextParams };
    });

    const unsubscribeType = client.subscribe(Jv1080Event.FxType, (value) => {
      setState((prev) => ({ ...prev, fxType: clampFxType(value) }));
    });

    const unsubscribeParam = client.subscribe(Jv1080Event.FxParam, (event) => {
      setState((prev) => {
        if (event.index < 0 || event.index >= FX_PARAM_COUNT) {
          return prev;
        }
        const next = [...prev.fxParams];
        next[event.index] = clamp7Bit(event.value);
        return { ...prev, fxParams: next };
      });
    });

    return () => {
      unsubscribeType();
      unsubscribeParam();
    };
  }, [client, connected]);

  const disabled = !connected || !client;

  return (
    <section className="panel">
      <h2>Effects</h2>
      <p>FX type and 12 parameter controls wired to DT1 writes with inbound sync.</p>
      {!connected ? <p className="error">Connect MIDI on Home page to enable FX writes.</p> : null}

      <div className="row">
        <div className="col">
          <label htmlFor="fx-type">FX Type</label>
          <select
            id="fx-type"
            value={state.fxType}
            disabled={disabled}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10) || 0;
              const clamped = client ? applyFxType(client, value) : clampFxType(value);
              setState((prev) => ({ ...prev, fxType: clamped }));
            }}
          >
            {FX_TYPE_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {index + 1}. {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        {state.fxParams.map((value, index) => (
          <div className="col" key={`fx-param-${index}`} style={{ maxWidth: 160 }}>
            <label htmlFor={`fx-param-${index}`}>Param {index + 1}</label>
            <input
              id={`fx-param-${index}`}
              type="number"
              min={0}
              max={127}
              value={value}
              disabled={disabled}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10) || 0;
                const clamped = client ? applyFxParam(client, index, parsed) : clamp7Bit(parsed);
                setState((prev) => {
                  const next = [...prev.fxParams];
                  next[index] = clamped;
                  return { ...prev, fxParams: next };
                });
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
