# Audio Tools Makefile
#
# Targets:
#   help           - Show available targets
#   deps           - Install pnpm dependencies
#   build          - Build all audiotools modules
#   install        - Build, link globally, install wrappers to ~/.audiotools/bin
#   install-akaitools - Download and install akaitools (required for native Akai disk extraction)
#   uninstall      - Remove global links and wrappers
#   clean          - Clean all build artifacts
#   backup         - Run backup for configured sources
#   export         - Run export for backed up disks

.PHONY: help deps build install install-akaitools uninstall clean backup export all

INSTALL_DIR := $(HOME)/.audiotools
BIN_DIR := $(INSTALL_DIR)/bin
AKAITOOLS_DIR := $(INSTALL_DIR)/akaitools-1.5
AKAITOOLS_URL := https://lsnl.jp/~ohsaki/software/akaitools/akaitools-1.5.tar.gz
PROJECT_ROOT := $(shell pwd)

default: help

## help: Show available targets
help:
	@grep -E '^##' $(MAKEFILE_LIST) | sed 's/## /  /'

## deps: Install pnpm dependencies
deps:
	pnpm install

## build: Build all audiotools modules
build: deps
	pnpm run build

## install: Build modules, link globally, install wrappers to ~/.audiotools/bin
install: build
	@mkdir -p $(BIN_DIR)
	@echo '#!/bin/bash' > $(BIN_DIR)/audiotools
	@echo 'cd $(PROJECT_ROOT)/modules/audiotools-cli' >> $(BIN_DIR)/audiotools
	@echo 'exec pnpm exec tsx src/index.ts "$$@"' >> $(BIN_DIR)/audiotools
	@chmod +x $(BIN_DIR)/audiotools
	@echo '#!/bin/bash' > $(BIN_DIR)/akai-backup
	@echo 'cd $(PROJECT_ROOT)/modules/sampler-backup' >> $(BIN_DIR)/akai-backup
	@echo 'exec pnpm exec tsx src/cli/backup.ts "$$@"' >> $(BIN_DIR)/akai-backup
	@chmod +x $(BIN_DIR)/akai-backup
	@echo '#!/bin/bash' > $(BIN_DIR)/akai-export
	@echo 'cd $(PROJECT_ROOT)/modules/sampler-export' >> $(BIN_DIR)/akai-export
	@echo 'exec pnpm exec tsx src/cli/extract.ts "$$@"' >> $(BIN_DIR)/akai-export
	@chmod +x $(BIN_DIR)/akai-export
	@echo "Installed to $(BIN_DIR):"
	@ls -1 $(BIN_DIR)
	@echo ""
	@echo "Add to PATH: export PATH=\"$(BIN_DIR):\$$PATH\""

## install-akaitools: Download and install akaitools to ~/.audiotools/akaitools-1.5
install-akaitools:
	@if [ -d "$(AKAITOOLS_DIR)" ]; then \
		echo "akaitools already installed at $(AKAITOOLS_DIR)"; \
	else \
		echo "Downloading akaitools..."; \
		mkdir -p $(INSTALL_DIR); \
		curl -sL $(AKAITOOLS_URL) | tar -xz -C $(INSTALL_DIR); \
		echo "Building akaitools..."; \
		cd $(AKAITOOLS_DIR) && perl Makefile.PL PREFIX=$(AKAITOOLS_DIR) && make; \
		echo "akaitools installed to $(AKAITOOLS_DIR)"; \
	fi

## uninstall: Remove wrappers from ~/.audiotools/bin
uninstall:
	rm -rf $(BIN_DIR)
	@echo "Removed $(BIN_DIR). Config and backups preserved."

## clean: Clean all build artifacts
clean:
	pnpm run clean || true
	rm -rf build/*

## backup: Run backup for all configured sources
backup:
	$(BIN_DIR)/akai-backup backup

## export: Run export for backed up disks
export:
	$(BIN_DIR)/akai-export batch --source $(INSTALL_DIR)/backup --dest $(INSTALL_DIR)/export

## export-force: Force re-export of all disks (regenerates SFZ/DecentSampler files)
export-force:
	$(BIN_DIR)/akai-export batch --source $(INSTALL_DIR)/backup --dest $(INSTALL_DIR)/export --force

all: build
