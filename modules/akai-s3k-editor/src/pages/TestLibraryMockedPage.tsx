/**
 * Visual-verification harness for the Library page's single-selection
 * contract + Variant D selection chrome. Mounts the real
 * DiskBrowserPanel + DeviceMemoryPanel side-by-side with seeded fake
 * data so the cross-clearing behavior is exercisable in-browser without
 * real SCSI hardware or a connected S3000XL.
 *
 * Mocking strategy: the DiskBrowserPanel already has a sessionStorage
 * cache (DISK_BROWSER_CACHE_KEY) that bypasses bridge HTTP/WebSocket
 * calls when populated — it's the prod-side optimization that lets a
 * returning operator see the disk tree without re-scanning. This
 * harness seeds that cache with fabricated DiskTarget + VolumeWithFiles
 * data in useEffect BEFORE mounting the panel, so the panel reads the
 * fake disk tree on first render and renders it without ever touching
 * the bridge. `bridgeUrl=null` confirms no network calls fire even when
 * the user interacts.
 *
 * Device memory is seeded via libraryStore.setDeviceProgramNames /
 * setDeviceSampleNames — the panel reads those names from the store
 * directly, no MIDI traffic.
 *
 * The single-selection contract wiring mirrors LibraryPage.tsx exactly:
 * selectDiskFile clears device; selectDeviceItem clears disk. Click in
 * either panel and observe the other panel's highlight disappear.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageTitleRow } from '@audiocontrol/editor-core';
import type { AkaiDiskFileEntry } from '@audiocontrol/sampler-devices/s3k';
import { FILE_TYPE_PROGRAM } from '@audiocontrol/sampler-devices/s3k';
import {
  DiskBrowserPanel,
  DISK_BROWSER_CACHE_KEY,
  type DiskBrowserCacheShape,
  type DiskBrowserHandle,
} from '@/components/library/DiskBrowserPanel';
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import { useLibraryStore } from '@/stores/libraryStore';

/**
 * Fabricated disk-browser cache. Two SCSI targets, one of which has a
 * volume containing three programs. Targets are intentionally id 3 and
 * id 5 with a gap at id 4 to mirror real SCSI bus layouts (id 6 = host,
 * id 7 = controller, leaving 0-5 for disks).
 */
const FAKE_DISK_CACHE: DiskBrowserCacheShape = {
  targets: [
    { id: 3, vendor: 'TEST    ', product: 'HARNESS HD 540  ', blockCount: 540 * 2048, blockSize: 512 },
    { id: 5, vendor: 'TEST    ', product: 'HARNESS HD 500  ', blockCount: 500 * 2048, blockSize: 512 },
  ],
  volumes: {
    5: [
      {
        name: 'VOLUME 005',
        startBlock: 1024,
        files: [
          { name: 'BAGUETTES', type: FILE_TYPE_PROGRAM, size: 2048, startBlock: 2048, entryIndex: 0 },
          { name: 'LMK', type: FILE_TYPE_PROGRAM, size: 2048, startBlock: 4096, entryIndex: 1 },
          { name: 'SHIB.01', type: FILE_TYPE_PROGRAM, size: 2048, startBlock: 6144, entryIndex: 2 },
          { name: 'SHIB.03', type: FILE_TYPE_PROGRAM, size: 2048, startBlock: 8192, entryIndex: 3 },
        ],
      },
    ],
  },
  expandedTarget: 5,
};

const FAKE_DEVICE_PROGRAMS = ['TEST PRO CPY', 'TEST PRO CPY', 'TEST PROGRAM'];
const FAKE_DEVICE_SAMPLES = ['SINE        ', 'SQUARE      ', 'TRIANGLE    ', 'NOISE       '];

export function TestLibraryMockedPage(): JSX.Element {
  // Seed sessionStorage BEFORE the disk panel mounts. The conditional
  // mount below (gated on `seeded`) guarantees the panel only renders
  // after the seed effect has run — DiskBrowserPanel reads the cache
  // via useMemo on mount, so the cache must be present BEFORE first
  // render to populate the tree.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    sessionStorage.setItem(
      DISK_BROWSER_CACHE_KEY,
      JSON.stringify(FAKE_DISK_CACHE),
    );
    setSeeded(true);
    return () => {
      sessionStorage.removeItem(DISK_BROWSER_CACHE_KEY);
    };
  }, []);

  // Seed device memory via libraryStore actions.
  const setDeviceProgramNames = useLibraryStore((s) => s.setDeviceProgramNames);
  const setDeviceSampleNames = useLibraryStore((s) => s.setDeviceSampleNames);
  const selectedDeviceIndex = useLibraryStore((s) => s.selectedDeviceIndex);
  const selectedDeviceType = useLibraryStore((s) => s.selectedDeviceType);
  const setSelectedDevice = useLibraryStore((s) => s.setSelectedDevice);
  const clearSelectedDevice = useLibraryStore((s) => s.clearSelectedDevice);

  useEffect(() => {
    setDeviceProgramNames(FAKE_DEVICE_PROGRAMS);
    setDeviceSampleNames(FAKE_DEVICE_SAMPLES);
  }, [setDeviceProgramNames, setDeviceSampleNames]);

  // Single-selection state — disk side lifted to this page so it can
  // cross-clear the device side, and vice versa. Same shape LibraryPage
  // uses; this harness exists to verify the contract visually.
  const [selectedDiskFile, setSelectedDiskFileLocal] = useState<AkaiDiskFileEntry | null>(null);

  const selectDiskFile = useCallback(
    (file: AkaiDiskFileEntry | null) => {
      setSelectedDiskFileLocal(file);
      if (file !== null) clearSelectedDevice();
    },
    [clearSelectedDevice],
  );

  const selectDeviceItem = useCallback(
    (type: 'program' | 'sample', index: number) => {
      setSelectedDevice(type, index);
      setSelectedDiskFileLocal(null);
    },
    [setSelectedDevice],
  );

  const diskBrowserRef = useRef<DiskBrowserHandle>(null);

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      <PageTitleRow
        headingId="test-library-mocked-page-heading"
        headingText="Test Library (mocked SCSI + device)"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          padding: '1rem',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
        aria-labelledby="test-library-mocked-page-heading"
      >
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          {seeded ? (
            <DiskBrowserPanel
              browserRef={diskBrowserRef}
              bridgeUrl={null}
              selectedFile={selectedDiskFile}
              onSelectFile={selectDiskFile}
            />
          ) : null}
        </div>
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <DeviceMemoryPanel
            programNames={FAKE_DEVICE_PROGRAMS}
            sampleNames={FAKE_DEVICE_SAMPLES}
            selectedIndex={selectedDeviceIndex}
            selectedType={selectedDeviceType}
            onSelectProgram={(i: number) => selectDeviceItem('program', i)}
            onSelectSample={(i: number) => selectDeviceItem('sample', i)}
            onRefresh={() => { /* no-op in harness */ }}
            isConnected={true}
            isLoading={false}
          />
        </div>
      </div>
    </div>
  );
}
