/**
 * React context providing WorkflowEnvironment to workflow routes.
 *
 * Wires up browser implementations at this level so workflow components
 * receive capabilities via context rather than importing browser globals.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { WorkflowEnvironment } from '@audiocontrol/editor-core';
import {
  createBrowserFileIO,
  createBrowserAudioPlayback,
} from '@audiocontrol/editor-core';

const WorkflowEnvironmentContext = createContext<WorkflowEnvironment | null>(null);

interface WorkflowEnvironmentProviderProps {
  children: ReactNode;
  /** Optional override for testing. */
  environment?: WorkflowEnvironment;
}

export function WorkflowEnvironmentProvider({
  children,
  environment: envOverride,
}: WorkflowEnvironmentProviderProps) {
  const env = useMemo<WorkflowEnvironment>(() => {
    if (envOverride) return envOverride;
    return {
      fileIO: createBrowserFileIO(),
      audio: createBrowserAudioPlayback(),
    };
  }, [envOverride]);

  return (
    <WorkflowEnvironmentContext.Provider value={env}>
      {children}
    </WorkflowEnvironmentContext.Provider>
  );
}

/**
 * Access the workflow environment. Must be used within a WorkflowEnvironmentProvider.
 */
export function useWorkflowEnvironment(): WorkflowEnvironment {
  const env = useContext(WorkflowEnvironmentContext);
  if (!env) {
    throw new Error(
      'useWorkflowEnvironment must be used within a WorkflowEnvironmentProvider.',
    );
  }
  return env;
}
