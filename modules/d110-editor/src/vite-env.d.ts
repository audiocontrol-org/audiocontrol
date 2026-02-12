/// <reference types="vite/client" />

// Build-time injected variables from vite.config.ts
declare const __BUILD_TIME__: string;
declare const __GIT_COMMIT__: string;
declare const __GIT_BRANCH__: string;
declare const __GIT_DATE__: string;
declare const __GIT_DIRTY__: boolean;
