SHELL := /bin/bash

CARGO ?= cargo
BIN_NAME := midi-macro-bridge
DEBUG_BIN := target/debug/$(BIN_NAME)
RELEASE_BIN := target/release/$(BIN_NAME)
STAMP := .build-stamp

ARGS ?=

.PHONY: help build release test check run list-ports probe-mcu probe-mcu-interactive lcxl3-activate clean lint lint-fix fmt fmt-check all package

help:
	@echo "midi-macro-bridge — service-local Makefile"
	@echo
	@echo "Targets:"
	@echo "  build              cargo build (debug) — fast iteration"
	@echo "  release            cargo build --release — produces $(RELEASE_BIN)"
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
	@echo "  package            assemble release tarball — TRIPLE/VERSION overridable"
	@echo
	@echo "The root Makefile target 'build-midi-macro-bridge' produces the"
	@echo "release binary under $(STAMP) tracking; this Makefile is for"
	@echo "in-service development."

build:
	$(CARGO) build

release: $(STAMP)
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
all: fmt-check lint test release

# Build a release tarball for the current host triple. Override TRIPLE/VERSION
# to package for cross-targets (CI passes both explicitly).
TRIPLE ?= $(shell rustc -vV | sed -n 's/^host: //p')
VERSION ?= v0.0.1-dev

package:
	./scripts/package.sh --target $(TRIPLE) --version $(VERSION)
