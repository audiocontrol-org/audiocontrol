import { describe, it, expect } from 'vitest';
import {
  isOperationComplete,
  getOverallPercent,
  formatBytes,
  type OperationState,
  type OperationProgress,
} from './operation-progress';

describe('getOverallPercent', () => {
  it('returns 0 when bytesTotalAllSteps is 0', () => {
    const p: OperationProgress = {
      currentStep: 1, totalSteps: 1, stepLabel: 'test',
      bytesSent: 0, bytesTotal: 0,
      bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
    };
    expect(getOverallPercent(p)).toBe(0);
  });

  it('computes byte-weighted percentage', () => {
    const p: OperationProgress = {
      currentStep: 2, totalSteps: 3, stepLabel: 'Uploading',
      bytesSent: 500, bytesTotal: 1000,
      bytesSentAllSteps: 2000, bytesTotalAllSteps: 5000,
    };
    // (2000 + 500) / 5000 = 50%
    expect(getOverallPercent(p)).toBe(50);
  });

  it('caps at 100%', () => {
    const p: OperationProgress = {
      currentStep: 1, totalSteps: 1, stepLabel: 'done',
      bytesSent: 2000, bytesTotal: 1000,
      bytesSentAllSteps: 5000, bytesTotalAllSteps: 5000,
    };
    expect(getOverallPercent(p)).toBe(100);
  });
});

describe('isOperationComplete', () => {
  it('returns false when operating', () => {
    const s: OperationState = { isOperating: true };
    expect(isOperationComplete(s)).toBe(false);
  });

  it('returns false when no progress', () => {
    const s: OperationState = { isOperating: false };
    expect(isOperationComplete(s)).toBe(false);
  });

  it('returns true when all steps done and bytes sent', () => {
    const s: OperationState = {
      isOperating: false,
      progress: {
        currentStep: 3, totalSteps: 3, stepLabel: 'Done',
        bytesSent: 1000, bytesTotal: 1000,
        bytesSentAllSteps: 3000, bytesTotalAllSteps: 4000,
      },
    };
    expect(isOperationComplete(s)).toBe(true);
  });

  it('returns true when bytesTotal is 0 (non-byte operation)', () => {
    const s: OperationState = {
      isOperating: false,
      progress: {
        currentStep: 2, totalSteps: 2, stepLabel: 'Done',
        bytesSent: 0, bytesTotal: 0,
        bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
      },
    };
    expect(isOperationComplete(s)).toBe(true);
  });

  it('returns false when not all steps done', () => {
    const s: OperationState = {
      isOperating: false,
      progress: {
        currentStep: 1, totalSteps: 3, stepLabel: 'step 1',
        bytesSent: 1000, bytesTotal: 1000,
        bytesSentAllSteps: 0, bytesTotalAllSteps: 3000,
      },
    };
    expect(isOperationComplete(s)).toBe(false);
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1572864)).toBe('1.5 MB');
  });
});
