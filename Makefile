# Topological build system for audiocontrol monorepo.
# Each module gets a stamp file (.build-stamp) that tracks build freshness.
# Dependencies between stamps enforce correct build order.

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
LIVE_MAX_CC        := $(MODULES_DIR)/live-max-cc-router/.build-stamp
SAMPLER_MIDI       := $(MODULES_DIR)/sampler-midi/.build-stamp
SAMPLER_LIBRARY    := $(MODULES_DIR)/sampler-library/.build-stamp
SAMPLER_TRANSLATE  := $(MODULES_DIR)/sampler-translate/.build-stamp
SAMPLER_BACKUP     := $(MODULES_DIR)/sampler-backup/.build-stamp
SAMPLER_EXPORT     := $(MODULES_DIR)/sampler-export/.build-stamp
LOOP_EDITOR        := $(MODULES_DIR)/loop-editor/.build-stamp
D110_EDITOR        := $(MODULES_DIR)/d110-editor/.build-stamp
JV1080_EDITOR      := $(MODULES_DIR)/jv1080-editor/.build-stamp
SAMPLER_EDITOR     := $(MODULES_DIR)/sampler-editor/.build-stamp
AUDIOTOOLS_CLI     := $(MODULES_DIR)/audiotools-cli/.build-stamp
SYNTH_CORE         := $(MODULES_DIR)/synth-core/.build-stamp

ALL_STAMPS := \
	$(SHARED_MIDI) $(SAMPLER_LIB) $(AUDIOTOOLS_CONFIG) $(CANONICAL_MIDI) \
	$(ARDOUR_MIDI) $(LAUNCH_CONTROL) $(LAUNCH_CONTROL_ED) $(LIB_RUNTIME) \
	$(SAMPLER_ATTIC) $(SAMPLE_CHOPPER) $(EDITOR_CORE) $(LIB_DEVICE_UUID) \
	$(SAMPLER_DEVICES) $(LIVE_MAX_CC) $(SAMPLER_MIDI) $(SAMPLER_LIBRARY) \
	$(SAMPLER_TRANSLATE) $(SAMPLER_BACKUP) $(SAMPLER_EXPORT) $(LOOP_EDITOR) \
	$(D110_EDITOR) $(JV1080_EDITOR) $(SAMPLER_EDITOR) $(AUDIOTOOLS_CLI) \
	$(SYNTH_CORE)

INSTALL_STAMP := node_modules/.install-stamp

.PHONY: build clean

build: $(ALL_STAMPS)

$(INSTALL_STAMP): pnpm-lock.yaml
	pnpm install
	@touch $@

# ---------------------------------------------------------------------------
# Layer 0 — no workspace dependencies
# ---------------------------------------------------------------------------

# shared-midi has no build script — just stamp it
$(SHARED_MIDI): $(INSTALL_STAMP)
	@touch $@

$(SAMPLER_LIB): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/sampler-lib && pnpm build
	@touch $@

$(AUDIOTOOLS_CONFIG): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/audiotools-config && pnpm build
	@touch $@

$(CANONICAL_MIDI): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/canonical-midi-maps && pnpm build
	@touch $@

$(ARDOUR_MIDI): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/ardour-midi-maps && pnpm build
	@touch $@

$(LAUNCH_CONTROL): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/launch-control-xl3 && pnpm build
	@touch $@

$(LAUNCH_CONTROL_ED): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/launch-control-xl3-editor && pnpm build
	@touch $@

$(LIB_RUNTIME): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/lib-runtime && pnpm build
	@touch $@

$(SAMPLER_ATTIC): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/sampler-attic && pnpm build
	@touch $@

# sample-chopper's dep on sampler-library is devDeps only (test harness),
# so it can build independently
$(SAMPLE_CHOPPER): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/sample-chopper && pnpm build
	@touch $@

$(SYNTH_CORE): $(INSTALL_STAMP)
	cd $(MODULES_DIR)/synth-core && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------

$(EDITOR_CORE): $(SHARED_MIDI) $(SAMPLER_LIBRARY)
	cd $(MODULES_DIR)/editor-core && pnpm build
	@touch $@

$(LIB_DEVICE_UUID): $(SAMPLER_LIB)
	cd $(MODULES_DIR)/lib-device-uuid && pnpm build
	@touch $@

$(SAMPLER_DEVICES): $(SAMPLER_LIB) $(SHARED_MIDI)
	cd $(MODULES_DIR)/sampler-devices && pnpm build
	@touch $@

$(LIVE_MAX_CC): $(CANONICAL_MIDI)
	cd $(MODULES_DIR)/live-max-cc-router && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------

$(SAMPLER_MIDI): $(SAMPLER_DEVICES) $(SAMPLER_LIB)
	cd $(MODULES_DIR)/sampler-midi && pnpm build
	@touch $@

$(SAMPLER_LIBRARY): $(SAMPLER_DEVICES) $(SAMPLE_CHOPPER)
	cd $(MODULES_DIR)/sampler-library && pnpm build
	@touch $@

$(SAMPLER_TRANSLATE): $(SAMPLER_DEVICES) $(SAMPLER_LIB)
	cd $(MODULES_DIR)/sampler-translate && pnpm build
	@touch $@

$(SAMPLER_BACKUP): $(AUDIOTOOLS_CONFIG) $(LIB_DEVICE_UUID) $(SAMPLER_DEVICES) $(SAMPLER_LIB)
	cd $(MODULES_DIR)/sampler-backup && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 3
# ---------------------------------------------------------------------------

$(SAMPLER_EXPORT): $(AUDIOTOOLS_CONFIG) $(SAMPLER_BACKUP) $(SAMPLER_DEVICES) $(SAMPLER_LIB)
	cd $(MODULES_DIR)/sampler-export && pnpm build
	@touch $@

$(LOOP_EDITOR): $(EDITOR_CORE) $(SAMPLER_LIBRARY) $(SYNTH_CORE)
	cd $(MODULES_DIR)/loop-editor && pnpm build
	@touch $@

$(D110_EDITOR): $(EDITOR_CORE) $(SHARED_MIDI)
	cd $(MODULES_DIR)/d110-editor && pnpm build
	@touch $@

$(JV1080_EDITOR): $(EDITOR_CORE) $(SAMPLER_DEVICES) $(SHARED_MIDI)
	cd $(MODULES_DIR)/jv1080-editor && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Layer 4
# ---------------------------------------------------------------------------

$(SAMPLER_EDITOR): $(EDITOR_CORE) $(LOOP_EDITOR) $(SAMPLE_CHOPPER) $(SAMPLER_DEVICES) $(SAMPLER_LIBRARY) $(SHARED_MIDI) $(SYNTH_CORE)
	cd $(MODULES_DIR)/sampler-editor && pnpm build
	@touch $@

$(AUDIOTOOLS_CLI): $(AUDIOTOOLS_CONFIG) $(LIB_DEVICE_UUID) $(SAMPLER_BACKUP) $(SAMPLER_EXPORT)
	cd $(MODULES_DIR)/audiotools-cli && pnpm build
	@touch $@

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean:
	rm -rf $(MODULES_DIR)/*/dist
	rm -f $(MODULES_DIR)/*/.build-stamp
	rm -f $(INSTALL_STAMP)
