# Topological build system for audiocontrol monorepo.
# Each module gets a stamp file (.build-stamp) that tracks build freshness.
# Dependencies between stamps enforce correct build order.
# Source file dependencies ensure Make detects actual file changes.

SHELL := /bin/bash

MODULES_DIR := modules

# Stamp file targets
MIDI_CORE      := $(MODULES_DIR)/midi-core/.build-stamp
SAMPLER_LIB       := $(MODULES_DIR)/sampler-lib/.build-stamp
AUDIOTOOLS_CONFIG  := $(MODULES_DIR)/audiotools-config/.build-stamp
CANONICAL_MIDI     := $(MODULES_DIR)/canonical-midi-maps/.build-stamp
ARDOUR_MIDI        := $(MODULES_DIR)/ardour-midi-maps/.build-stamp
LAUNCH_CONTROL     := $(MODULES_DIR)/launch-control-xl3/.build-stamp
LAUNCH_CONTROL_ED  := $(MODULES_DIR)/launch-control-xl3-editor/.build-stamp
LIB_RUNTIME        := $(MODULES_DIR)/lib-runtime/.build-stamp
SAMPLER_ATTIC      := $(MODULES_DIR)/sampler-attic/.build-stamp
SAMPLE_CHOPPER     := $(MODULES_DIR)/sample-chopper/.build-stamp
EDITOR_CORE        := $(MODULES_DIR)/editor-core/.build-stamp
LIB_DEVICE_UUID    := $(MODULES_DIR)/lib-device-uuid/.build-stamp
SAMPLER_DEVICES    := $(MODULES_DIR)/sampler-devices/.build-stamp

SAMPLER_LIBRARY    := $(MODULES_DIR)/sampler-library/.build-stamp
SAMPLER_TRANSLATE  := $(MODULES_DIR)/sampler-translate/.build-stamp
SAMPLER_BACKUP     := $(MODULES_DIR)/sampler-backup/.build-stamp
SAMPLER_EXPORT     := $(MODULES_DIR)/sampler-export/.build-stamp
LOOP_EDITOR        := $(MODULES_DIR)/loop-editor/.build-stamp
D110_EDITOR        := $(MODULES_DIR)/d110-editor/.build-stamp
JV1080_EDITOR      := $(MODULES_DIR)/jv1080-editor/.build-stamp
ROLAND_SXX0_EDITOR := $(MODULES_DIR)/roland-sxx0-editor/.build-stamp
AUDIOTOOLS_CLI     := $(MODULES_DIR)/audiotools-cli/.build-stamp
SYNTH_CORE         := $(MODULES_DIR)/synth-core/.build-stamp
SAMPLE_EDITOR_MOD  := $(MODULES_DIR)/sample-editor/.build-stamp
AKAI_S3K_EDITOR    := $(MODULES_DIR)/akai-s3k-editor/.build-stamp

ALL_STAMPS := \
	$(MIDI_CORE) $(SAMPLER_LIB) $(AUDIOTOOLS_CONFIG) $(CANONICAL_MIDI) \
	$(ARDOUR_MIDI) $(LAUNCH_CONTROL) $(LAUNCH_CONTROL_ED) $(LIB_RUNTIME) \
	$(SAMPLER_ATTIC) $(SAMPLE_CHOPPER) $(EDITOR_CORE) $(LIB_DEVICE_UUID) \
	$(SAMPLER_DEVICES) $(SAMPLER_LIBRARY) \
	$(SAMPLER_TRANSLATE) $(SAMPLER_BACKUP) $(SAMPLER_EXPORT) $(LOOP_EDITOR) \
	$(D110_EDITOR) $(JV1080_EDITOR) $(ROLAND_SXX0_EDITOR) $(AUDIOTOOLS_CLI) \
	$(SYNTH_CORE) $(SAMPLE_EDITOR_MOD) $(AKAI_S3K_EDITOR)

INSTALL_STAMP := node_modules/.install-stamp

# ---------------------------------------------------------------------------
# Source file lists — enables Make to detect actual file changes
# ---------------------------------------------------------------------------

MIDI_CORE_SRC       := $(shell find $(MODULES_DIR)/midi-core/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLER_LIB_SRC       := $(shell find $(MODULES_DIR)/sampler-lib/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
AUDIOTOOLS_CONFIG_SRC  := $(shell find $(MODULES_DIR)/audiotools-config/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
CANONICAL_MIDI_SRC     := $(shell find $(MODULES_DIR)/canonical-midi-maps/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
ARDOUR_MIDI_SRC        := $(shell find $(MODULES_DIR)/ardour-midi-maps/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
LAUNCH_CONTROL_SRC     := $(shell find $(MODULES_DIR)/launch-control-xl3/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
LAUNCH_CONTROL_ED_SRC  := $(shell find $(MODULES_DIR)/launch-control-xl3-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
LIB_RUNTIME_SRC        := $(shell find $(MODULES_DIR)/lib-runtime/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLER_ATTIC_SRC      := $(shell find $(MODULES_DIR)/sampler-attic/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLE_CHOPPER_SRC     := $(shell find $(MODULES_DIR)/sample-chopper/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
EDITOR_CORE_SRC        := $(shell find $(MODULES_DIR)/editor-core/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
LIB_DEVICE_UUID_SRC    := $(shell find $(MODULES_DIR)/lib-device-uuid/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLER_DEVICES_SRC    := $(shell find $(MODULES_DIR)/sampler-devices/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)

SAMPLER_LIBRARY_SRC    := $(shell find $(MODULES_DIR)/sampler-library/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLER_TRANSLATE_SRC  := $(shell find $(MODULES_DIR)/sampler-translate/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLER_BACKUP_SRC     := $(shell find $(MODULES_DIR)/sampler-backup/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLER_EXPORT_SRC     := $(shell find $(MODULES_DIR)/sampler-export/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
LOOP_EDITOR_SRC        := $(shell find $(MODULES_DIR)/loop-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
D110_EDITOR_SRC        := $(shell find $(MODULES_DIR)/d110-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
JV1080_EDITOR_SRC      := $(shell find $(MODULES_DIR)/jv1080-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
ROLAND_SXX0_EDITOR_SRC := $(shell find $(MODULES_DIR)/roland-sxx0-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
AUDIOTOOLS_CLI_SRC     := $(shell find $(MODULES_DIR)/audiotools-cli/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SYNTH_CORE_SRC         := $(shell find $(MODULES_DIR)/synth-core/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
SAMPLE_EDITOR_SRC      := $(shell find $(MODULES_DIR)/sample-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)
AKAI_S3K_EDITOR_SRC    := $(shell find $(MODULES_DIR)/akai-s3k-editor/src -name '*.ts' -o -name '*.tsx' -o -name '*.css' 2>/dev/null)

.PHONY: build clean clean-deps ensure-devenv ensure-playwright check-midi-server test-e2e-roland test-e2e-roland-device test-e2e-roland-device-conformance test-e2e-roland-library test-e2e-roland-device-library test-e2e-roland-ui test-e2e-s3k-device test-e2e-s3k-library test-e2e-s3k-scsi test-e2e-s3k-device-library check-scsi-bridge test-scsi-write-validation dev-scsi test-e2e-common-library-s3k test-e2e-common-library-roland test-ui-s3k test-ui-roland test-wiring-roland test-rendering-roland build-midi-macro-bridge record-fixtures-roland record-fixtures-roland-s330 record-fixtures-roland-s550 check-fixture-drift check-coverage-roland

build: $(ALL_STAMPS)

# ---------------------------------------------------------------------------
# E2E Test Infrastructure
# ---------------------------------------------------------------------------
#
# !! AGENTS: DO NOT run e2e make targets directly. !!
# !! ALWAYS use: modules/e2e-infra/scripts/run-and-watch.sh <target>       !!
# !! Example: modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library !!
# !! The run-and-watch script provides log capture, progress polling,       !!
# !! and completion detection. Running make directly loses all of this.     !!
#

# devenv binary location (falls back to nix-profile path)
DEVENV := $(shell command -v devenv 2>/dev/null || echo $(HOME)/.nix-profile/bin/devenv)

# DEVENV_RUN — wrapper used by every shell-out target.
# By default, runs the command inside `devenv shell`. CI overrides this to
# `bash -c` so the targets execute with whatever Node + pnpm + system libs
# the runner already provides (no devenv install in CI).
#
# Usage in targets:
#   $(DEVENV_RUN) "cd modules/foo && pnpm test"
#
# Override from CI / scripts:
#   make test-ui-roland DEVENV_RUN='bash -c'
ifndef DEVENV_RUN
DEVENV_RUN := $(DEVENV) shell --quiet -- bash -c
endif

.PHONY: ensure-devenv
ensure-devenv:
ifeq ($(strip $(DEVENV_RUN)),bash -c)
	@echo "DEVENV_RUN overridden — skipping devenv check"
else
	@(command -v devenv >/dev/null 2>&1 || test -x "$(HOME)/.nix-profile/bin/devenv") || { echo "ERROR: devenv not installed. See https://devenv.sh/getting-started/"; exit 1; }
endif

# midi-server: auto-provisioned for hardware E2E tests
MIDI_SERVER_DEPS_DIR := $(CURDIR)/.deps/midi-server
MIDI_SERVER_REPO_URL := https://github.com/audiocontrol-org/midi-server.git
MIDI_SERVER_BIN := $(MIDI_SERVER_DEPS_DIR)/build/MidiHttpServer_artefacts/Release/MidiHttpServer
MIDI_SERVER_STAMP := $(MIDI_SERVER_DEPS_DIR)/.build-stamp

$(MIDI_SERVER_DEPS_DIR)/CMakeLists.txt:
	@mkdir -p .deps
	git clone --depth 1 $(MIDI_SERVER_REPO_URL) $(MIDI_SERVER_DEPS_DIR)

$(MIDI_SERVER_STAMP): $(MIDI_SERVER_DEPS_DIR)/CMakeLists.txt
	cd $(MIDI_SERVER_DEPS_DIR) && cmake -B build -DCMAKE_BUILD_TYPE=Release
	cd $(MIDI_SERVER_DEPS_DIR) && cmake --build build
	@touch $@

.PHONY: check-midi-server
check-midi-server: ensure-devenv $(MIDI_SERVER_STAMP)
	@test -x "$(MIDI_SERVER_BIN)" || (echo "ERROR: midi-server binary not found at $(MIDI_SERVER_BIN)" && exit 1)
	@echo "✓ midi-server ready: $(MIDI_SERVER_BIN)"

# Ensure Playwright browsers are installed (once, in e2e-infra)
.PHONY: ensure-playwright
ensure-playwright: ensure-devenv
	$(DEVENV_RUN) "cd $(MODULES_DIR)/e2e-infra && npx playwright install chromium"

# Extra arguments passed to e2e test runners (e.g., Playwright --grep).
# Usage: make test-e2e-roland-device ARGS="--grep 'Tone Editor'"
ARGS ?=

# ---------------------------------------------------------------------------
# Roland sxx0 E2E Tests
# ---------------------------------------------------------------------------

# All Roland e2e tests (UI + library, no device required)
test-e2e-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && pnpm test:e2e $(ARGS)"

# Roland device tests (requires connected S-330/S-550 + midi-server)
test-e2e-roland-device: $(ROLAND_SXX0_EDITOR) check-midi-server ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && MIDI_SERVER_BIN='$(MIDI_SERVER_BIN)' ./scripts/run-http-midi-e2e.sh $(ARGS)"

# Roland S-550 live conformance tests (requires connected S-550 + midi-server).
# This runner is distinct from the simulated tiers and reserved for the
# redesign/design-capability conformance battery tracked in Phase 11 Task 4.
test-e2e-roland-device-conformance: $(ROLAND_SXX0_EDITOR) check-midi-server ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && MIDI_SERVER_BIN='$(MIDI_SERVER_BIN)' E2E_DEVICE_TYPE=s550 PLAYWRIGHT_CONFIG=playwright.s550-conformance.config.ts ./scripts/run-http-midi-e2e.sh $(ARGS)"

# Roland library tests (OPFS, no device required)
test-e2e-roland-library: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && ./scripts/run-library-e2e.sh $(ARGS)"

# Roland device+library tests (requires connected S-330/S-550 + midi-server + OPFS)
test-e2e-roland-device-library: $(ROLAND_SXX0_EDITOR) check-midi-server ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && MIDI_SERVER_BIN='$(MIDI_SERVER_BIN)' ./scripts/run-device-library-e2e.sh $(ARGS)"

# Roland UI navigation tests (no device required)
test-e2e-roland-ui: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && pnpm test:e2e $(ARGS)"

# ---------------------------------------------------------------------------
# Phase 0 — Roland fixture recording (CLI, requires connected S-330/S-550)
# ---------------------------------------------------------------------------
# Drives a real device through scripted scenarios via easymidi, records every
# byte at the SSeriesMidiAdapter boundary, writes a NDJSON fixture for replay
# in UI tests. Captured fixtures live in
# modules/sampler-devices/test/fixtures/<device>/<scenario>.ndjson.
#
# Usage:
#   make record-fixtures-roland ARGS="--device s550 --scenario load-everything --output modules/sampler-devices/test/fixtures/s550/load-everything.ndjson"
#   make record-fixtures-roland-s550 ARGS="--scenario fetch-tone-0 --output modules/sampler-devices/test/fixtures/s550/fetch-tone-0.ndjson"
#   make record-fixtures-roland ARGS="--list-scenarios"
#   make record-fixtures-roland ARGS="--list-ports"
record-fixtures-roland: $(SAMPLER_DEVICES)
	$(DEVENV_RUN) "tsx $(MODULES_DIR)/e2e-infra/src/node/lib/record-fixtures-roland.ts $(ARGS)"

record-fixtures-roland-s550: $(SAMPLER_DEVICES)
	$(DEVENV_RUN) "tsx $(MODULES_DIR)/e2e-infra/src/node/lib/record-fixtures-roland.ts --device s550 $(ARGS)"

record-fixtures-roland-s330: $(SAMPLER_DEVICES)
	$(DEVENV_RUN) "tsx $(MODULES_DIR)/e2e-infra/src/node/lib/record-fixtures-roland.ts --device s330 $(ARGS)"

# ---------------------------------------------------------------------------
# Phase 0 — Fixture drift detection (operator-run, requires hardware)
# ---------------------------------------------------------------------------
# Re-captures every committed fixture from the connected device and diffs
# against the version on disk. Use to verify captured fixtures still match
# real device behavior after a protocol or scenario change.
#
# Hardware: requires Roland S-330 / S-550 reachable via MIDI (typically Volt 4
# on orion-m4). Not run in CI.
#
# Usage:
#   make check-fixture-drift
#   make check-fixture-drift ARGS="--device s330"
#   make check-fixture-drift ARGS="--device s330 --scenario fetch-tone-0"
check-fixture-drift: $(SAMPLER_DEVICES)
	./scripts/check-fixture-drift.sh $(ARGS)

# ---------------------------------------------------------------------------
# S3000XL E2E Tests
# ---------------------------------------------------------------------------

# S3000XL device tests (requires connected S3000XL + midi-server)
test-e2e-s3k-device: $(AKAI_S3K_EDITOR) check-midi-server ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/akai-s3k-editor && MIDI_SERVER_BIN='$(MIDI_SERVER_BIN)' ./scripts/run-http-midi-e2e.sh $(ARGS)"

# S3K library tests (OPFS, no device required)
test-e2e-s3k-library: $(AKAI_S3K_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/akai-s3k-editor && ./scripts/run-library-e2e.sh $(ARGS)"

# S3K UI test harness (keygroup zone components, no device required)
test-ui-s3k: $(AKAI_S3K_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/akai-s3k-editor && ./scripts/run-test-harness-e2e.sh $(ARGS)"

# Roland UI test harness (no device required)
test-ui-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && ./scripts/run-test-harness-e2e.sh $(ARGS)"

# Roland Tier 1 wiring suite (no device required). Verifies the
# device-write seam via programmatic value injection; allowed patterns:
# .fill() / input.value = X / dispatchEvent('change'). See
# modules/roland-sxx0-editor/test/wiring/README.md for the tier contract.
test-wiring-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && ./scripts/run-test-harness-e2e.sh playwright.wiring.config.ts $(ARGS)"

# Roland rendering smoke captures (no device required). Produces PNGs
# for design review; NOT a closure gate. See
# modules/roland-sxx0-editor/test/rendering/README.md for the contract.
test-rendering-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "cd $(MODULES_DIR)/roland-sxx0-editor && ./scripts/run-test-harness-e2e.sh playwright.rendering.config.ts $(ARGS)"

# Coverage gate: lint -> wiring -> test-ui-roland -> credibility -> manifest -> gate.
# Exits non-zero if any 'implemented' D-row has 'coverage: none' in the
# generated manifest. Workplan 9R-A.1 T8 + 9R-A.2; reform spec §6.
check-coverage-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "pnpm run check-coverage"

# ---------------------------------------------------------------------------
# Common-Area Library Tests (shared specs, parameterized by env)
# ---------------------------------------------------------------------------

# Common-area library tests against S3K editor
test-e2e-common-library-s3k: $(AKAI_S3K_EDITOR) ensure-playwright
	$(DEVENV_RUN) "\
		E2E_EDITOR_DIR=$(MODULES_DIR)/akai-s3k-editor \
		E2E_LIBRARY_URL='/akai/s3000xl/editor/library' \
		E2E_BASE_URL='/akai/s3000xl/editor' \
		E2E_EDITOR_NAME='S3K' \
		E2E_OPFS_INIT='s3k' \
		$(MODULES_DIR)/e2e-infra/scripts/run-common-library-e2e.sh $(ARGS)"

# Common-area library tests against Roland editor
test-e2e-common-library-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV_RUN) "\
		E2E_EDITOR_DIR=$(MODULES_DIR)/roland-sxx0-editor \
		E2E_LIBRARY_URL='/roland/s330/editor/library' \
		E2E_BASE_URL='/roland/s330/editor' \
		E2E_EDITOR_NAME='Roland' \
		E2E_OPFS_INIT='roland' \
		$(MODULES_DIR)/e2e-infra/scripts/run-common-library-e2e.sh $(ARGS)"

# ---------------------------------------------------------------------------
# SCSI MIDI Bridge E2E Tests
# ---------------------------------------------------------------------------

# Pi connection (override: make test-e2e-s3k-scsi SCSI_PI_HOST=10.0.0.57)
SCSI_PI_HOST ?= s3k.local
SCSI_PI_USER ?= orion

# scsi2pi source: override to use local checkout during development
# Usage: make test-e2e-s3k-scsi SCSI2PI_DIR=~/work/scsi2pi-work/scsi2pi
SCSI2PI_DIR ?=
SCSI2PI_DEPS_DIR := $(CURDIR)/.deps/scsi2pi
SCSI2PI_REPO_URL := https://github.com/audiocontrol-org/scsi2pi.git
SCSI2PI_REPO_BRANCH := feature/midi-processor

ifdef SCSI2PI_DIR
  SCSI2PI_EFFECTIVE_DIR := $(SCSI2PI_DIR)
else
  SCSI2PI_EFFECTIVE_DIR := $(SCSI2PI_DEPS_DIR)
endif

S2P_BIN := $(SCSI2PI_EFFECTIVE_DIR)/.docker-build/s2p
S2P_STAMP := $(SCSI2PI_EFFECTIVE_DIR)/.docker-build-stamp

# scsi-midi-bridge (in-tree Rust service)
SCSI_BRIDGE_SRC_DIR := $(CURDIR)/services/scsi-midi-bridge
SCSI_BRIDGE_BIN := $(SCSI_BRIDGE_SRC_DIR)/.docker-build/scsi-midi-bridge
SCSI_BRIDGE_STAMP := $(SCSI_BRIDGE_SRC_DIR)/.docker-build-stamp

# Clone scsi2pi to .deps/ (skipped when SCSI2PI_DIR is set)
ifndef SCSI2PI_DIR
$(SCSI2PI_DEPS_DIR)/Dockerfile:
	@mkdir -p .deps
	git clone --depth 1 -b $(SCSI2PI_REPO_BRANCH) $(SCSI2PI_REPO_URL) $(SCSI2PI_DEPS_DIR)

$(S2P_STAMP): $(SCSI2PI_DEPS_DIR)/Dockerfile
else
$(S2P_STAMP): $(shell find $(SCSI2PI_DIR)/cpp -name '*.cpp' -o -name '*.h' 2>/dev/null | head -50)
endif
	cd $(SCSI2PI_EFFECTIVE_DIR) && \
		docker build --platform linux/arm64 -t scsi2pi-build -f Dockerfile . && \
		docker run --rm --platform linux/arm64 -v "$$(cd $(SCSI2PI_EFFECTIVE_DIR) && pwd):/src" scsi2pi-build make -C /src/cpp -j4 && \
		mkdir -p .docker-build && \
		cp cpp/bin/s2p .docker-build/s2p
	@touch $@

$(SCSI_BRIDGE_STAMP): $(shell find $(SCSI_BRIDGE_SRC_DIR)/src -name '*.rs' 2>/dev/null) $(SCSI_BRIDGE_SRC_DIR)/Cargo.toml $(SCSI_BRIDGE_SRC_DIR)/build.rs
	cd $(SCSI_BRIDGE_SRC_DIR) && \
		docker build --platform linux/arm64 -t scsi-midi-bridge-build -f Dockerfile.arm64 . && \
		docker run --rm --platform linux/arm64 -v "$$(pwd):/src" -e "BUILD_GIT_HASH=$$(git rev-parse --short HEAD)" scsi-midi-bridge-build cargo build --release && \
		mkdir -p .docker-build && \
		cp target/release/scsi-midi-bridge .docker-build/scsi-midi-bridge
	@touch $@

.PHONY: check-scsi-bridge
check-scsi-bridge: $(S2P_STAMP) $(SCSI_BRIDGE_STAMP)
	@test -f "$(S2P_BIN)" || (echo "ERROR: s2p binary not found at $(S2P_BIN)" && exit 1)
	@test -f "$(SCSI_BRIDGE_BIN)" || (echo "ERROR: scsi-midi-bridge binary not found at $(SCSI_BRIDGE_BIN)" && exit 1)
	@echo "✓ s2p ready: $(S2P_BIN)"
	@echo "✓ scsi-midi-bridge ready: $(SCSI_BRIDGE_BIN)"

# ---------------------------------------------------------------------------
# midi-macro-bridge (in-tree Rust service, native macOS)
# ---------------------------------------------------------------------------
# Runs locally on macOS: uses CoreMIDI (via midir) and CGEvent (via enigo).
# No cross-compilation — build natively with cargo.

MIDI_MACRO_BRIDGE_SRC_DIR := $(CURDIR)/services/midi-macro-bridge
MIDI_MACRO_BRIDGE_BIN := $(MIDI_MACRO_BRIDGE_SRC_DIR)/target/release/midi-macro-bridge
MIDI_MACRO_BRIDGE_STAMP := $(MIDI_MACRO_BRIDGE_SRC_DIR)/.build-stamp

$(MIDI_MACRO_BRIDGE_STAMP): $(shell find $(MIDI_MACRO_BRIDGE_SRC_DIR)/src -name '*.rs' 2>/dev/null) $(MIDI_MACRO_BRIDGE_SRC_DIR)/Cargo.toml
	cd $(MIDI_MACRO_BRIDGE_SRC_DIR) && cargo build --release
	@touch $@

build-midi-macro-bridge: $(MIDI_MACRO_BRIDGE_STAMP)
	@test -x "$(MIDI_MACRO_BRIDGE_BIN)" || (echo "ERROR: midi-macro-bridge binary not found at $(MIDI_MACRO_BRIDGE_BIN)" && exit 1)
	@echo "✓ midi-macro-bridge ready: $(MIDI_MACRO_BRIDGE_BIN)"

# SCSI write validation (Node.js CLI — no browser, no Playwright)
# Provisions Pi (deploys s2p + bridge, starts daemons, validates), then runs CLI tests.
# Usage: make test-scsi-write-validation
# Usage: make test-scsi-write-validation ARGS="--test writes --verbose"
test-scsi-write-validation: $(SAMPLER_DEVICES) $(MIDI_CORE) check-scsi-bridge
	SCSI_PI_HOST='$(SCSI_PI_HOST)' \
	SCSI_PI_USER='$(SCSI_PI_USER)' \
	S2P_BIN='$(S2P_BIN)' \
	SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
	E2E_NODE_SCRIPT=src/node/scsi-write-test.ts \
	$(MODULES_DIR)/e2e-infra/scripts/run-scsi-node-e2e.sh $(ARGS)

# SCSI SDS sample transfer (Node.js CLI — WebSocket, no browser)
# Usage: make test-scsi-sds-transfer
# Usage: make test-scsi-sds-transfer ARGS="--verbose"
test-scsi-sds-transfer: $(SAMPLER_DEVICES) $(MIDI_CORE) check-scsi-bridge
	SCSI_PI_HOST='$(SCSI_PI_HOST)' \
	SCSI_PI_USER='$(SCSI_PI_USER)' \
	S2P_BIN='$(S2P_BIN)' \
	SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
	E2E_NODE_SCRIPT=src/node/scsi-write-test.ts \
	$(MODULES_DIR)/e2e-infra/scripts/run-scsi-node-e2e.sh --test scsi-sds-transfer $(ARGS)

# SCSI disk write round-trip (Node.js CLI — block I/O, no browser)
# Usage: make test-scsi-disk-write
# Usage: make test-scsi-disk-write ARGS="--verbose"
test-scsi-disk-write: $(SAMPLER_DEVICES) $(MIDI_CORE) check-scsi-bridge
	SCSI_PI_HOST='$(SCSI_PI_HOST)' \
	SCSI_PI_USER='$(SCSI_PI_USER)' \
	S2P_BIN='$(S2P_BIN)' \
	SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
	E2E_NODE_SCRIPT=src/node/scsi-write-test.ts \
	$(MODULES_DIR)/e2e-infra/scripts/run-scsi-node-e2e.sh --test disk-write $(ARGS)

# S3000XL SCSI tests (requires Pi with S3000XL connected via SCSI)
test-e2e-s3k-scsi: $(AKAI_S3K_EDITOR) check-scsi-bridge ensure-playwright
	$(DEVENV_RUN) "\
		cd $(MODULES_DIR)/akai-s3k-editor && \
		SCSI_PI_HOST='$(SCSI_PI_HOST)' \
		SCSI_PI_USER='$(SCSI_PI_USER)' \
		S2P_BIN='$(S2P_BIN)' \
		SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
		./scripts/run-scsi-midi-e2e.sh $(ARGS)"

# S3000XL device+library tests (requires Pi with S3000XL via SCSI + OPFS)
# Uses the shared SCSI runner with device-library Playwright config.
# Usage: make test-e2e-s3k-device-library
# Usage: make test-e2e-s3k-device-library ARGS="--grep 'round trip'"
test-e2e-s3k-device-library: $(AKAI_S3K_EDITOR) check-scsi-bridge ensure-playwright
	$(DEVENV_RUN) "\
		cd $(MODULES_DIR)/akai-s3k-editor && \
		SCSI_PI_HOST='$(SCSI_PI_HOST)' \
		SCSI_PI_USER='$(SCSI_PI_USER)' \
		S2P_BIN='$(S2P_BIN)' \
		SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
		E2E_PLAYWRIGHT_CONFIG='playwright.device-library.config.ts' \
		./scripts/run-scsi-midi-e2e.sh $(ARGS)"

# ---------------------------------------------------------------------------
# Deploy: build and deploy SCSI bridge (and s2p) to Pi
# ---------------------------------------------------------------------------

# Build ARM64 binaries, deploy to Pi, restart daemons, validate.
# Usage: make deploy-scsi-bridge
# Usage: make deploy-scsi-bridge SCSI_PI_HOST=10.0.0.57
.PHONY: deploy-scsi-bridge
deploy-scsi-bridge: check-scsi-bridge
	SCSI_PI_HOST='$(SCSI_PI_HOST)' \
	SCSI_PI_USER='$(SCSI_PI_USER)' \
	S2P_BIN='$(S2P_BIN)' \
	SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
	$(MODULES_DIR)/e2e-infra/scripts/deploy-scsi-bridge.sh

# ---------------------------------------------------------------------------
# Dev Environment: S3K with SCSI bridge
# ---------------------------------------------------------------------------

# Provision Pi (if needed) and start S3K editor with SCSI bridge proxy.
# Idempotent: skips provisioning if daemons are already running.
# Usage: make dev-scsi
# Usage: make dev-scsi SCSI_PI_HOST=10.0.0.57
dev-scsi: $(AKAI_S3K_EDITOR) check-scsi-bridge
	SCSI_PI_HOST='$(SCSI_PI_HOST)' \
	SCSI_PI_USER='$(SCSI_PI_USER)' \
	S2P_BIN='$(S2P_BIN)' \
	SCSI_BRIDGE_BIN='$(SCSI_BRIDGE_BIN)' \
	./scripts/dev-scsi.sh

$(INSTALL_STAMP): pnpm-lock.yaml
	pnpm install
	@touch $@

# ---------------------------------------------------------------------------
# HOW SOURCE CHANGE DETECTION WORKS
# ---------------------------------------------------------------------------
#
# Each stamp target (e.g., $(EDITOR_CORE)) depends on its module's source
# files via the *_SRC variables defined above. Make compares the timestamp
# of every .ts, .tsx, and .css file against the stamp file. If ANY source
# file is newer, Make rebuilds that module automatically.
#
# This means:
#   - `make` alone is sufficient for routine development.
#   - Do NOT delete .build-stamp files to force a rebuild — Make already
#     detects source changes. Deleting stamps is unnecessary and wasteful.
#   - `make clean && make` exists for full rebuilds from scratch (e.g.,
#     after changing tsconfig, upgrading dependencies, or switching branches).
#     It is NOT needed for routine source file edits.
#
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Layer 0 — no workspace dependencies
# ---------------------------------------------------------------------------

# midi-core has no build script — just stamp it
$(MIDI_CORE): $(INSTALL_STAMP) $(MIDI_CORE_SRC)
	cd $(MODULES_DIR)/midi-core && pnpm build
	@touch $@

$(SAMPLER_LIB): $(INSTALL_STAMP) $(SAMPLER_LIB_SRC)
	cd $(MODULES_DIR)/sampler-lib && pnpm build
	@touch $@

$(AUDIOTOOLS_CONFIG): $(INSTALL_STAMP) $(AUDIOTOOLS_CONFIG_SRC)
	cd $(MODULES_DIR)/audiotools-config && pnpm build
	@touch $@

$(CANONICAL_MIDI): $(INSTALL_STAMP) $(CANONICAL_MIDI_SRC)
	cd $(MODULES_DIR)/canonical-midi-maps && pnpm build
	@touch $@

$(ARDOUR_MIDI): $(INSTALL_STAMP) $(ARDOUR_MIDI_SRC)
	cd $(MODULES_DIR)/ardour-midi-maps && pnpm build
	@touch $@

$(LAUNCH_CONTROL): $(INSTALL_STAMP) $(LAUNCH_CONTROL_SRC)
	cd $(MODULES_DIR)/launch-control-xl3 && pnpm build
	@touch $@

$(LAUNCH_CONTROL_ED): $(INSTALL_STAMP) $(LAUNCH_CONTROL_ED_SRC)
	cd $(MODULES_DIR)/launch-control-xl3-editor && pnpm build
	@touch $@

$(LIB_RUNTIME): $(INSTALL_STAMP) $(LIB_RUNTIME_SRC)
	cd $(MODULES_DIR)/lib-runtime && pnpm build
	@touch $@

$(SAMPLER_ATTIC): $(INSTALL_STAMP) $(SAMPLER_ATTIC_SRC)
	cd $(MODULES_DIR)/sampler-attic && pnpm build
	@touch $@

# sample-chopper's dep on sampler-library is devDeps only (test harness),
# so it can build independently
$(SAMPLE_CHOPPER): $(INSTALL_STAMP) $(SAMPLE_CHOPPER_SRC) $(SYNTH_CORE)
	cd $(MODULES_DIR)/sample-chopper && pnpm build
	@touch $@

$(SYNTH_CORE): $(INSTALL_STAMP) $(SYNTH_CORE_SRC)
	cd $(MODULES_DIR)/synth-core && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------

$(EDITOR_CORE): $(MIDI_CORE) $(SAMPLER_LIBRARY) $(EDITOR_CORE_SRC)
	cd $(MODULES_DIR)/editor-core && pnpm build
	@touch $@

$(LIB_DEVICE_UUID): $(SAMPLER_LIB) $(LIB_DEVICE_UUID_SRC)
	cd $(MODULES_DIR)/lib-device-uuid && pnpm build
	@touch $@

$(SAMPLER_DEVICES): $(SAMPLER_LIB) $(MIDI_CORE) $(SAMPLER_DEVICES_SRC)
	cd $(MODULES_DIR)/sampler-devices && pnpm build
	@touch $@

# ⚠️  WARNING: live-max-cc-router is EXCLUDED from the build system.
# Its build script generates canonical-plugin-maps.ts into src/ during every
# build, which creates an infinite rebuild loop with Make's source file
# tracking. Build it manually: cd modules/live-max-cc-router && pnpm build

# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------

$(SAMPLER_LIBRARY): $(SAMPLER_DEVICES) $(SAMPLE_CHOPPER) $(SAMPLER_LIBRARY_SRC)
	cd $(MODULES_DIR)/sampler-library && pnpm build
	@touch $@

$(SAMPLER_TRANSLATE): $(SAMPLER_DEVICES) $(SAMPLER_LIB) $(SAMPLER_TRANSLATE_SRC)
	cd $(MODULES_DIR)/sampler-translate && pnpm build
	@touch $@

$(SAMPLER_BACKUP): $(AUDIOTOOLS_CONFIG) $(LIB_DEVICE_UUID) $(SAMPLER_DEVICES) $(SAMPLER_LIB) $(SAMPLER_BACKUP_SRC)
	cd $(MODULES_DIR)/sampler-backup && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 3
# ---------------------------------------------------------------------------

$(SAMPLER_EXPORT): $(AUDIOTOOLS_CONFIG) $(SAMPLER_BACKUP) $(SAMPLER_DEVICES) $(SAMPLER_LIB) $(SAMPLER_EXPORT_SRC)
	cd $(MODULES_DIR)/sampler-export && pnpm build
	@touch $@

$(LOOP_EDITOR): $(EDITOR_CORE) $(SAMPLER_LIBRARY) $(SYNTH_CORE) $(LOOP_EDITOR_SRC)
	cd $(MODULES_DIR)/loop-editor && pnpm build
	@touch $@

$(SAMPLE_EDITOR_MOD): $(SYNTH_CORE) $(SAMPLER_LIBRARY) $(SAMPLE_EDITOR_SRC)
	cd $(MODULES_DIR)/sample-editor && pnpm build
	@touch $@

$(D110_EDITOR): $(EDITOR_CORE) $(MIDI_CORE) $(D110_EDITOR_SRC)
	cd $(MODULES_DIR)/d110-editor && pnpm build
	@touch $@

$(JV1080_EDITOR): $(EDITOR_CORE) $(SAMPLER_DEVICES) $(MIDI_CORE) $(JV1080_EDITOR_SRC)
	cd $(MODULES_DIR)/jv1080-editor && pnpm build
	@touch $@

$(AKAI_S3K_EDITOR): $(EDITOR_CORE) $(LOOP_EDITOR) $(SAMPLE_CHOPPER) $(SAMPLE_EDITOR_MOD) $(SAMPLER_DEVICES) $(SAMPLER_LIBRARY) $(MIDI_CORE) $(SYNTH_CORE) $(AKAI_S3K_EDITOR_SRC)
	cd $(MODULES_DIR)/akai-s3k-editor && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 4
# ---------------------------------------------------------------------------

$(ROLAND_SXX0_EDITOR): $(EDITOR_CORE) $(LOOP_EDITOR) $(SAMPLE_CHOPPER) $(SAMPLE_EDITOR_MOD) $(SAMPLER_DEVICES) $(SAMPLER_LIBRARY) $(MIDI_CORE) $(SYNTH_CORE) $(ROLAND_SXX0_EDITOR_SRC)
	cd $(MODULES_DIR)/roland-sxx0-editor && pnpm build
	@touch $@

$(AUDIOTOOLS_CLI): $(AUDIOTOOLS_CONFIG) $(LIB_DEVICE_UUID) $(SAMPLER_BACKUP) $(SAMPLER_EXPORT) $(AUDIOTOOLS_CLI_SRC)
	cd $(MODULES_DIR)/audiotools-cli && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean:
	rm -rf $(MODULES_DIR)/*/dist
	rm -f $(MODULES_DIR)/*/.build-stamp
	rm -f $(INSTALL_STAMP)
	rm -f $(MODULES_DIR)/*/*.tsbuildinfo
	rm -rf $(MIDI_MACRO_BRIDGE_SRC_DIR)/target
	rm -f $(MIDI_MACRO_BRIDGE_STAMP)

clean-deps:
	rm -rf .deps
