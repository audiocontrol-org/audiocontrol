/**
 * Promo / device-free screenshot scene manifest.
 *
 * The single source of truth for which editor surfaces the device-free
 * capture engine renders (editor-ux-refinement Phase 2). Each scene yields
 * one PNG.
 *
 * Roland scenes replay a REAL-DEVICE-CAPTURED NDJSON fixture through the
 * simulated-MIDI harness (`?midi=simulated&scenario=`) — the same
 * device-free path the Tier-3 in-context UI specs use. The Akai keygroup
 * scene renders the editor's in-memory factory test page (no captured
 * fixture exists for it yet — see the manifest notes below).
 *
 * NOTE — this is a visual-capture tool, NOT an E2E correctness test. It
 * deliberately uses the simulated-MIDI harness so it can render with no
 * hardware attached; it does not claim to exercise the real device path.
 *
 * No fabricated data: a fixture-backed scene MUST point at a real capture
 * under modules/sampler-devices/test/fixtures/<device>/. `validateSceneManifest`
 * (validate-scenes.ts) throws when a referenced fixture is absent.
 */

export interface Viewport {
  /** Logical CSS width. */
  readonly width: number;
  /** Logical CSS height. */
  readonly height: number;
  /** Retina multiplier; 2 yields a 2x PNG for crisp marketing assets. */
  readonly deviceScaleFactor: number;
}

interface SceneBase {
  /** Stable kebab id; becomes the captured PNG's basename. */
  readonly id: string;
  readonly editor: 'roland' | 'akai';
  /** Absolute dev-server path the engine navigates to (incl. any query). */
  readonly route: string;
  readonly viewport: Viewport;
}

/** A scene backed by a real-device-captured NDJSON fixture (simulated MIDI). */
export interface FixtureScene extends SceneBase {
  readonly source: 'fixture';
  /** Fixtures subdir, e.g. 's330'. */
  readonly device: string;
  /** Fixture basename without the `.ndjson` suffix. */
  readonly scenario: string;
}

/** A scene whose route renders its own in-memory data (no captured fixture). */
export interface FactoryScene extends SceneBase {
  readonly source: 'factory';
}

export type Scene = FixtureScene | FactoryScene;

/** Default marketing viewport: 1280x800 logical at 2x (2560x1600 px). */
export const DEFAULT_VIEWPORT: Viewport = {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
};

/**
 * Initial scene manifest.
 *
 * Roland scenes use s330 captures — the only device with recorded fixtures
 * today (the s550 fixtures dir is empty; capturing them from hardware is
 * task P2.5). The Akai keygroup scene uses the editor's factory test route;
 * capturing real Akai device fixtures for promo is future work.
 */
export const PROMO_SCENES: readonly Scene[] = [
  {
    id: 'roland-s330-tones',
    editor: 'roland',
    source: 'fixture',
    device: 's330',
    scenario: 'tones-bank-0',
    route: '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0',
    viewport: DEFAULT_VIEWPORT,
  },
  {
    id: 'roland-s330-patches',
    editor: 'roland',
    source: 'fixture',
    device: 's330',
    scenario: 'patches-bank-0',
    route: '/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0',
    viewport: DEFAULT_VIEWPORT,
  },
  {
    id: 'roland-s330-play',
    editor: 'roland',
    source: 'fixture',
    device: 's330',
    scenario: 'play-init',
    route: '/roland/s330/editor/play?midi=simulated&scenario=play-init',
    viewport: DEFAULT_VIEWPORT,
  },
  {
    id: 'akai-keygroups',
    editor: 'akai',
    source: 'factory',
    route: '/akai/s3000xl/editor/test/keygroups',
    viewport: DEFAULT_VIEWPORT,
  },
];
