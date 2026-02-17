declare module '@audiocontrol/sampler-export' {
  export type SamplerType = string;

  export interface ExtractBatchOptions {
    sourceDir: string;
    destDir: string;
    force?: boolean;
    convertToSFZ?: boolean;
    convertToDecentSampler?: boolean;
  }

  export interface ExtractBatchResult {
    successful: number;
    skipped: number;
    failed: number;
  }

  export function extractBatch(options: ExtractBatchOptions): Promise<ExtractBatchResult>;
}
