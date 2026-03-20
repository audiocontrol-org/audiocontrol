import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationLoadingSpinner,
  OperationButtonContent,
} from './OperationStatus';
import type { OperationProgress } from '../types/operation-progress';

const sampleProgress: OperationProgress = {
  currentStep: 2,
  totalSteps: 3,
  stepLabel: 'Uploading sample',
  bytesSent: 5000,
  bytesTotal: 10000,
  bytesSentAllSteps: 10000,
  bytesTotalAllSteps: 30000,
};

describe('OperationProgressBar', () => {
  it('renders step label and step count', () => {
    const html = renderToStaticMarkup(<OperationProgressBar progress={sampleProgress} />);
    expect(html).toContain('Uploading sample');
    expect(html).toContain('Step 2 of 3');
  });

  it('renders overall percentage', () => {
    const html = renderToStaticMarkup(<OperationProgressBar progress={sampleProgress} />);
    // (10000 + 5000) / 30000 = 50%
    expect(html).toContain('Overall 50%');
  });

  it('renders byte counts', () => {
    const html = renderToStaticMarkup(<OperationProgressBar progress={sampleProgress} />);
    expect(html).toContain('4.9 KB');
    expect(html).toContain('9.8 KB');
  });

  it('renders progress track', () => {
    const html = renderToStaticMarkup(<OperationProgressBar progress={sampleProgress} />);
    expect(html).toContain('ac-operation-progress-track');
    expect(html).toContain('ac-operation-progress-fill');
  });
});

describe('OperationErrorBanner', () => {
  it('renders error message', () => {
    const html = renderToStaticMarkup(<OperationErrorBanner error="Transfer failed" />);
    expect(html).toContain('Transfer failed');
    expect(html).toContain('ac-operation-error');
  });
});

describe('OperationSuccessScreen', () => {
  it('renders success message and done button', () => {
    const html = renderToStaticMarkup(
      <OperationSuccessScreen message="Import complete" onDone={() => {}} />,
    );
    expect(html).toContain('Import complete');
    expect(html).toContain('Done');
    expect(html).toContain('ac-operation-success');
  });

  it('renders detail when provided', () => {
    const html = renderToStaticMarkup(
      <OperationSuccessScreen message="Done" detail="3 samples imported" onDone={() => {}} />,
    );
    expect(html).toContain('3 samples imported');
  });
});

describe('OperationLoadingSpinner', () => {
  it('renders message with spinner', () => {
    const html = renderToStaticMarkup(<OperationLoadingSpinner message="Preparing..." />);
    expect(html).toContain('Preparing...');
    expect(html).toContain('ac-spinner');
  });
});

describe('OperationButtonContent', () => {
  it('renders label when not operating', () => {
    const html = renderToStaticMarkup(
      <OperationButtonContent isOperating={false} label="Import" />,
    );
    expect(html).toContain('Import');
    expect(html).not.toContain('ac-spinner');
  });

  it('renders spinner and operating label when operating', () => {
    const html = renderToStaticMarkup(
      <OperationButtonContent isOperating={true} label="Import" operatingLabel="Importing..." />,
    );
    expect(html).toContain('Importing...');
    expect(html).toContain('ac-spinner');
  });
});
