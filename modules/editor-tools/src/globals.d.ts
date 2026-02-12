/**
 * Global type declarations for build-time injected variables
 *
 * These are injected by Vite at build time using getBuildDefines()
 */

declare const __BUILD_TIME__: string;
declare const __GIT_COMMIT__: string;
declare const __GIT_BRANCH__: string;
declare const __GIT_DATE__: string;
declare const __GIT_DIRTY__: boolean;
