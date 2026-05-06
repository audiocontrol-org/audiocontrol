SHELL := /bin/bash

CARGO ?= cargo
BIN_NAME := midi-macro-bridge
DEBUG_BIN := target/debug/$(BIN_NAME)
RELEASE_BIN := target/release/$(BIN_NAME)
STAMP := .build-stamp

ARGS ?=

.PHONY: help build release release-binary test check run list-ports probe-mcu probe-mcu-interactive lcxl3-activate clean lint lint-fix fmt fmt-check all package package-macos package-linux package-app package-dmg package-all

help:
	@echo "midi-macro-bridge — service-local Makefile"
	@echo
	@echo "Targets:"
	@echo "  build              cargo build (debug) — fast iteration"
	@echo "  release-binary     cargo build --release — produces $(RELEASE_BIN)"
	@echo "  release VERSION=v0.1.0  end-to-end release: build + smoke + tag + upload"
	@echo "  test               cargo test"
	@echo "  check              cargo check --tests"
	@echo "  run                cargo run -- \$$(ARGS)"
	@echo "  list-ports         cargo run -- --list-ports"
	@echo "  probe-mcu          cargo run -- --probe-mcu"
	@echo "  probe-mcu-interactive cargo run -- --probe-mcu-interactive"
	@echo "  lcxl3-activate     cargo run -- --lcxl3-activate \$$(ARGS)"
	@echo "  lint               cargo clippy --all-targets -- -D warnings"
	@echo "  lint-fix           cargo clippy --all-targets --fix --allow-dirty"
	@echo "  fmt                cargo fmt"
	@echo "  fmt-check          cargo fmt --check"
	@echo "  clean              cargo clean (drops debug + release artifacts)"
	@echo "  package            assemble release tarball for host triple — TRIPLE/VERSION overridable"
	@echo "  package-macos      assemble macOS arm64 tarball — VERSION overridable"
	@echo "  package-linux      assemble Linux x86_64 tarball via Docker — VERSION overridable"
	@echo "  package-app        assemble + sign MidiMacroBridge.app (no notarize)"
	@echo "  package-dmg        wrap .app in notarized + stapled .dmg"
	@echo "  package-all        both, plus aggregate SHA256SUMS"
	@echo
	@echo "The root Makefile target 'build-midi-macro-bridge' produces the"
	@echo "release binary under $(STAMP) tracking; this Makefile is for"
	@echo "in-service development."

build:
	$(CARGO) build

release-binary: $(STAMP)
	@test -x "$(RELEASE_BIN)" || (echo "ERROR: $(BIN_NAME) binary not found at $(RELEASE_BIN)" && exit 1)
	@echo "$(BIN_NAME) ready: $(RELEASE_BIN)"

# Stamp pattern mirrors the root Makefile so source-change detection stays
# consistent whether the build is invoked here or from the workspace root.
$(STAMP): $(shell find src -name '*.rs' 2>/dev/null) Cargo.toml
	$(CARGO) build --release
	@touch $@

test:
	$(CARGO) test

check:
	$(CARGO) check --tests

run:
	$(CARGO) run -- $(ARGS)

list-ports:
	$(CARGO) run -- --list-ports

probe-mcu:
	$(CARGO) run -- --probe-mcu

probe-mcu-interactive:
	$(CARGO) run -- --probe-mcu-interactive

lcxl3-activate:
	$(CARGO) run -- --lcxl3-activate $(ARGS)

lint:
	$(CARGO) clippy --all-targets -- -D warnings

lint-fix:
	$(CARGO) clippy --all-targets --fix --allow-dirty

fmt:
	$(CARGO) fmt

fmt-check:
	$(CARGO) fmt --check

clean:
	$(CARGO) clean
	@rm -f $(STAMP)

# Convenience: lint + test + release build, like a pre-commit gate.
all: fmt-check lint test release-binary

# Release packaging.
#   make package-macos VERSION=v0.1.0   builds aarch64-apple-darwin natively
#   make package-linux VERSION=v0.1.0   builds x86_64-unknown-linux-gnu via Docker
#   make package-all   VERSION=v0.1.0   both above + aggregate SHA256SUMS
#
# `package` (no -OS suffix) remains as a host-triple convenience for dev use.
TRIPLE ?= $(shell rustc -vV | sed -n 's/^host: //p')
VERSION ?= v0.0.1-dev

package:
	./scripts/package.sh --target $(TRIPLE) --version $(VERSION)

package-macos:
	./scripts/package.sh --target aarch64-apple-darwin --version $(VERSION)

package-linux:
	./scripts/build-in-docker.sh --version $(VERSION)

package-app:
	./scripts/package-app.sh --version $(VERSION)

package-dmg:
	./scripts/package-dmg.sh --version $(VERSION)

package-all: package-macos package-linux package-dmg
	@cd target/release-package && \
	  rm -f SHA256SUMS && \
	  cat midi-macro-bridge-$(VERSION)-aarch64-apple-darwin.tar.gz.sha256 \
	      midi-macro-bridge-$(VERSION)-x86_64-unknown-linux-gnu.tar.gz.sha256 \
	      MidiMacroBridge-$(VERSION).dmg.sha256 \
	      > SHA256SUMS
	@echo
	@echo "✓ Release artifacts for $(VERSION):"
	@ls -1 target/release-package/midi-macro-bridge-$(VERSION)-*.tar.gz \
	       target/release-package/midi-macro-bridge-$(VERSION)-*.sha256 \
	       target/release-package/MidiMacroBridge-$(VERSION).dmg \
	       target/release-package/MidiMacroBridge-$(VERSION).dmg.sha256 \
	       target/release-package/SHA256SUMS

# End-to-end release: precondition checks → package-all → macOS smoke test →
# git tag + push → gh release create. VERSION is required.
#   make release VERSION=v0.1.0
release:
	@./scripts/release.sh --version $(VERSION)
