# Topological build system for audiocontrol monorepo.
# Each module gets a stamp file (.build-stamp) that tracks build freshness.
# Dependencies between stamps enforce correct build order.
# Source file dependencies ensure Make detects actual file changes.

SHELL := /bin/bash

MODULES_DIR := modules

# Stamp file targets
SHARED_MIDI       := $(MODULES_DIR)/shared-midi/.build-stamp
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

SAMPLER_MIDI       := $(MODULES_DIR)/sampler-midi/.build-stamp
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
	$(SHARED_MIDI) $(SAMPLER_LIB) $(AUDIOTOOLS_CONFIG) $(CANONICAL_MIDI) \
	$(ARDOUR_MIDI) $(LAUNCH_CONTROL) $(LAUNCH_CONTROL_ED) $(LIB_RUNTIME) \
	$(SAMPLER_ATTIC) $(SAMPLE_CHOPPER) $(EDITOR_CORE) $(LIB_DEVICE_UUID) \
	$(SAMPLER_DEVICES) $(SAMPLER_MIDI) $(SAMPLER_LIBRARY) \
	$(SAMPLER_TRANSLATE) $(SAMPLER_BACKUP) $(SAMPLER_EXPORT) $(LOOP_EDITOR) \
	$(D110_EDITOR) $(JV1080_EDITOR) $(ROLAND_SXX0_EDITOR) $(AUDIOTOOLS_CLI) \
	$(SYNTH_CORE) $(SAMPLE_EDITOR_MOD) $(AKAI_S3K_EDITOR)

INSTALL_STAMP := node_modules/.install-stamp

# ---------------------------------------------------------------------------
# Source file lists — enables Make to detect actual file changes
# ---------------------------------------------------------------------------

SHARED_MIDI_SRC       := $(shell find $(MODULES_DIR)/shared-midi/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_LIB_SRC       := $(shell find $(MODULES_DIR)/sampler-lib/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
AUDIOTOOLS_CONFIG_SRC  := $(shell find $(MODULES_DIR)/audiotools-config/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
CANONICAL_MIDI_SRC     := $(shell find $(MODULES_DIR)/canonical-midi-maps/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
ARDOUR_MIDI_SRC        := $(shell find $(MODULES_DIR)/ardour-midi-maps/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
LAUNCH_CONTROL_SRC     := $(shell find $(MODULES_DIR)/launch-control-xl3/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
LAUNCH_CONTROL_ED_SRC  := $(shell find $(MODULES_DIR)/launch-control-xl3-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
LIB_RUNTIME_SRC        := $(shell find $(MODULES_DIR)/lib-runtime/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_ATTIC_SRC      := $(shell find $(MODULES_DIR)/sampler-attic/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLE_CHOPPER_SRC     := $(shell find $(MODULES_DIR)/sample-chopper/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
EDITOR_CORE_SRC        := $(shell find $(MODULES_DIR)/editor-core/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
LIB_DEVICE_UUID_SRC    := $(shell find $(MODULES_DIR)/lib-device-uuid/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_DEVICES_SRC    := $(shell find $(MODULES_DIR)/sampler-devices/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)

SAMPLER_MIDI_SRC       := $(shell find $(MODULES_DIR)/sampler-midi/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_LIBRARY_SRC    := $(shell find $(MODULES_DIR)/sampler-library/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_TRANSLATE_SRC  := $(shell find $(MODULES_DIR)/sampler-translate/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_BACKUP_SRC     := $(shell find $(MODULES_DIR)/sampler-backup/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLER_EXPORT_SRC     := $(shell find $(MODULES_DIR)/sampler-export/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
LOOP_EDITOR_SRC        := $(shell find $(MODULES_DIR)/loop-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
D110_EDITOR_SRC        := $(shell find $(MODULES_DIR)/d110-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
JV1080_EDITOR_SRC      := $(shell find $(MODULES_DIR)/jv1080-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
ROLAND_SXX0_EDITOR_SRC := $(shell find $(MODULES_DIR)/roland-sxx0-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
AUDIOTOOLS_CLI_SRC     := $(shell find $(MODULES_DIR)/audiotools-cli/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SYNTH_CORE_SRC         := $(shell find $(MODULES_DIR)/synth-core/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
SAMPLE_EDITOR_SRC      := $(shell find $(MODULES_DIR)/sample-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)
AKAI_S3K_EDITOR_SRC    := $(shell find $(MODULES_DIR)/akai-s3k-editor/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)

.PHONY: build clean clean-deps ensure-devenv ensure-playwright check-midi-server test-e2e-roland test-e2e-roland-device test-e2e-roland-library test-e2e-roland-ui test-e2e-s3k-device

build: $(ALL_STAMPS)

# ---------------------------------------------------------------------------
# E2E Test Infrastructure
# ---------------------------------------------------------------------------

# devenv binary location (auto-installed if missing)
DEVENV := $(shell command -v devenv 2>/dev/null || echo $(HOME)/.nix-profile/bin/devenv)

ifeq ($(DEVENV),)
DEVENV := devenv
endif

.PHONY: ensure-devenv
ensure-devenv:
	@(command -v devenv >/dev/null 2>&1 || test -x "$(HOME)/.nix-profile/bin/devenv") || { \
		echo ""; \
		echo "ERROR: devenv is not installed."; \
		echo ""; \
		echo "Install it (one-time, requires sudo):"; \
		echo ""; \
		echo "  curl -sSfL https://artifacts.nixos.org/nix-installer | sh -s -- install"; \
		echo "  nix profile install nixpkgs#bashInteractive"; \
		echo "  nix profile install nixpkgs#devenv"; \
		echo ""; \
		echo "Then restart your shell and re-run make."; \
		echo "See https://devenv.sh/getting-started/ for details."; \
		echo ""; \
		exit 1; \
	}
	@echo "✓ devenv ready: $$(command -v devenv)"

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
	$(DEVENV) shell --quiet -- bash -c "cd $(MODULES_DIR)/e2e-infra && npx playwright install chromium"

# Extra arguments passed to e2e test runners (e.g., Playwright --grep).
# Usage: make test-e2e-roland-device ARGS="--grep 'Tone Editor'"
ARGS ?=

# ---------------------------------------------------------------------------
# Roland sxx0 E2E Tests
# ---------------------------------------------------------------------------

# All Roland e2e tests (UI + library, no device required)
test-e2e-roland: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV) shell --quiet -- bash -c "cd $(MODULES_DIR)/roland-sxx0-editor && pnpm test:e2e $(ARGS)"

# Roland device tests (requires connected S-330/S-550 + midi-server)
test-e2e-roland-device: $(ROLAND_SXX0_EDITOR) check-midi-server ensure-playwright
	$(DEVENV) shell --quiet -- bash -c "cd $(MODULES_DIR)/roland-sxx0-editor && MIDI_SERVER_BIN='$(MIDI_SERVER_BIN)' ./scripts/run-http-midi-e2e.sh $(ARGS)"

# Roland library tests (OPFS, no device required)
test-e2e-roland-library: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV) shell --quiet -- bash -c "cd $(MODULES_DIR)/roland-sxx0-editor && ./scripts/run-library-e2e.sh $(ARGS)"

# Roland UI navigation tests (no device required)
test-e2e-roland-ui: $(ROLAND_SXX0_EDITOR) ensure-playwright
	$(DEVENV) shell --quiet -- bash -c "cd $(MODULES_DIR)/roland-sxx0-editor && pnpm test:e2e $(ARGS)"

# ---------------------------------------------------------------------------
# S3000XL E2E Tests
# ---------------------------------------------------------------------------

# S3000XL device tests (requires connected S3000XL + midi-server)
test-e2e-s3k-device: $(AKAI_S3K_EDITOR) check-midi-server ensure-playwright
	$(DEVENV) shell --quiet -- bash -c "cd $(MODULES_DIR)/akai-s3k-editor && MIDI_SERVER_BIN='$(MIDI_SERVER_BIN)' ./scripts/run-http-midi-e2e.sh $(ARGS)"

$(INSTALL_STAMP): pnpm-lock.yaml
	pnpm install
	@touch $@

# ---------------------------------------------------------------------------
# Layer 0 — no workspace dependencies
# ---------------------------------------------------------------------------

# shared-midi has no build script — just stamp it
$(SHARED_MIDI): $(INSTALL_STAMP) $(SHARED_MIDI_SRC)
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

SYNTH_CORE_SRC         := $(shell find $(MODULES_DIR)/synth-core/src -name '*.ts' -o -name '*.tsx' 2>/dev/null)

$(SYNTH_CORE): $(INSTALL_STAMP) $(SYNTH_CORE_SRC)
	cd $(MODULES_DIR)/synth-core && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------

$(EDITOR_CORE): $(SHARED_MIDI) $(SAMPLER_LIBRARY) $(EDITOR_CORE_SRC)
	cd $(MODULES_DIR)/editor-core && pnpm build
	@touch $@

$(LIB_DEVICE_UUID): $(SAMPLER_LIB) $(LIB_DEVICE_UUID_SRC)
	cd $(MODULES_DIR)/lib-device-uuid && pnpm build
	@touch $@

$(SAMPLER_DEVICES): $(SAMPLER_LIB) $(SHARED_MIDI) $(SAMPLER_DEVICES_SRC)
	cd $(MODULES_DIR)/sampler-devices && pnpm build
	@touch $@

# ⚠️  WARNING: live-max-cc-router is EXCLUDED from the build system.
# Its build script generates canonical-plugin-maps.ts into src/ during every
# build, which creates an infinite rebuild loop with Make's source file
# tracking. Build it manually: cd modules/live-max-cc-router && pnpm build

# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------

$(SAMPLER_MIDI): $(SAMPLER_DEVICES) $(SAMPLER_LIB) $(SAMPLER_MIDI_SRC)
	cd $(MODULES_DIR)/sampler-midi && pnpm build
	@touch $@

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

$(D110_EDITOR): $(EDITOR_CORE) $(SHARED_MIDI) $(D110_EDITOR_SRC)
	cd $(MODULES_DIR)/d110-editor && pnpm build
	@touch $@

$(JV1080_EDITOR): $(EDITOR_CORE) $(SAMPLER_DEVICES) $(SHARED_MIDI) $(JV1080_EDITOR_SRC)
	cd $(MODULES_DIR)/jv1080-editor && pnpm build
	@touch $@

$(AKAI_S3K_EDITOR): $(EDITOR_CORE) $(SAMPLER_DEVICES) $(SHARED_MIDI) $(AKAI_S3K_EDITOR_SRC)
	cd $(MODULES_DIR)/akai-s3k-editor && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 4
# ---------------------------------------------------------------------------

$(ROLAND_SXX0_EDITOR): $(EDITOR_CORE) $(LOOP_EDITOR) $(SAMPLE_CHOPPER) $(SAMPLE_EDITOR_MOD) $(SAMPLER_DEVICES) $(SAMPLER_LIBRARY) $(SHARED_MIDI) $(SYNTH_CORE) $(ROLAND_SXX0_EDITOR_SRC)
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

clean-deps:
	rm -rf .deps
