# --- Configuration ---
# Path to the Opencode source repository
OPENCODE_REPO ?= $(CURDIR)/opencode
# Tag to use as the base for building
OPENCODE_TAG  ?= v1.3.3
# Source base directory (removes leading 'v' if present for directory naming, but we'll use a safer approach)
# Strip 'v' from OPENCODE_TAG for directory matching (e.g. v1.3.3 -> 1.3.3)
BASE_VER      := $(patsubst v%,%,$(OPENCODE_TAG))
BASE_SRC      := src/$(BASE_VER)

# Installation prefix (default: ~/.local)
PREFIX        ?= $(HOME)/.local
BIN_DIR       := $(PREFIX)/bin
BIN_NAME      := opencode

# Patch Artifact Configuration
PATCH_DIR         := patches

# Dynamic Patch Naming (Based on OPENCODE_TAG)
CAE_PATCH := $(PATCH_DIR)/edit_cae_$(OPENCODE_TAG).patch
PIN_PATCH := $(PATCH_DIR)/pin_reads_$(OPENCODE_TAG).patch
UI_PATCH  := $(PATCH_DIR)/ui_v12_$(OPENCODE_TAG).patch

# Platform detection
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
    ifeq ($(UNAME_M),arm64)
        ARCH_BIN := dist/opencode-darwin-arm64/bin/opencode
    else
        ARCH_BIN := dist/opencode-darwin-x64/bin/opencode
    endif
else
    # Default to linux arm64 if not darwin (adjust as needed)
    ARCH_BIN := dist/opencode-linux-arm64/bin/opencode
endif

.PHONY: all patch build install clean build-patches help

help:
	@echo "Opencode CAE Maintenance System (Redo)"
	@echo "Usage: make [target] [OPENCODE_REPO=/path/to/repo] [PREFIX=/install/path] [OPENCODE_TAG=v1.3.3]"
	@echo ""
	@echo "Targets:"
	@echo "  build-patches  - Generate standard unified patches from src/"
	@echo "  patch          - Reset Opencode and apply new CAE patches ($(OPENCODE_TAG))"
	@echo "  build          - Compile the patched Opencode core"
	@echo "  install        - Install the architecture-specific binary to $(BIN_DIR)"
	@echo "  all            - Run build-patches, patch, build, and install"
	@echo "  clean          - Revert core patches and clean local build"

all: build-patches patch build install

build-patches:
	@mkdir -p $(PATCH_DIR)
	@rm -f $(PATCH_DIR)/*.patch
	@echo ">>> Generating standard unified patches for $(OPENCODE_TAG) from $(BASE_SRC)..."
	
	# 1. Edit CAE Patch (Standard diff -u)
	@diff -u $(BASE_SRC)/tool/edit.ts src/tool/edit.ts \
		| sed 's|^--- $(BASE_SRC)/|--- packages/opencode/src/|' \
		| sed 's|^+++ src/|+++ packages/opencode/src/|' \
		> $(CAE_PATCH) || [ $$? -eq 1 ]
		
	# 2. Pin-Reads Patch (Standard diff -u)
	@echo "" > $(PIN_PATCH)
	@diff -u $(BASE_SRC)/tool/read.ts src/tool/read.ts \
		| sed 's|^--- $(BASE_SRC)/|--- packages/opencode/src/|' \
		| sed 's|^+++ src/|+++ packages/opencode/src/|' \
		>> $(PIN_PATCH) || [ $$? -eq 1 ]
	@diff -u $(BASE_SRC)/session/prompt.ts src/session/prompt.ts \
		| sed 's|^--- $(BASE_SRC)/|--- packages/opencode/src/|' \
		| sed 's|^+++ src/|+++ packages/opencode/src/|' \
		>> $(PIN_PATCH) || [ $$? -eq 1 ]

	# 3. UI Sync Patch (Standard diff -u)
	@echo ">>> Generating UI patches for $(OPENCODE_TAG)..."
	@diff -u $(BASE_SRC)/cli/cmd/tui/routes/session/sidebar.tsx src/cli/cmd/tui/routes/session/sidebar.tsx \
		| sed 's|^--- $(BASE_SRC)/|--- packages/opencode/src/|' \
		| sed 's|^+++ src/|+++ packages/opencode/src/|' \
		> $(UI_PATCH) || [ $$? -eq 1 ]
		
	@echo "✅ Patches generated successfully: $(CAE_PATCH), $(PIN_PATCH), $(UI_PATCH)"

patch: build-patches
	@echo ">>> Resetting $(OPENCODE_REPO) to $(OPENCODE_TAG)..."
	cd $(OPENCODE_REPO) && git reset --hard $(OPENCODE_TAG) && git clean -fd
	@echo ">>> Applying new CAE patches using standard patch tool..."
	cd $(OPENCODE_REPO) && patch -p0 < $(CURDIR)/$(CAE_PATCH)
	cd $(OPENCODE_REPO) && patch -p0 < $(CURDIR)/$(PIN_PATCH)
	cd $(OPENCODE_REPO) && patch -p0 < $(CURDIR)/$(UI_PATCH)
	@echo ">>> Syncing prompt templates..."
	cp $(OPENCODE_REPO)/packages/opencode/src/session/prompt/anthropic.txt \
	   $(OPENCODE_REPO)/packages/opencode/src/session/prompt/gemini.txt
	@echo "✅ CAE logic, UI, and prompt templates successfully updated."

build:
	@echo ">>> Building Opencode..."
	cd $(OPENCODE_REPO) && bun install && bun run --cwd packages/opencode build

install:
	@echo ">>> Installing binary $(ARCH_BIN) to $(BIN_DIR)/$(BIN_NAME)..."
	mkdir -p $(BIN_DIR)
	cp $(OPENCODE_REPO)/packages/opencode/$(ARCH_BIN) $(BIN_DIR)/$(BIN_NAME)
	chmod +x $(BIN_DIR)/$(BIN_NAME)
ifeq ($(UNAME_S),Darwin)
	codesign -f -s - $(BIN_DIR)/$(BIN_NAME)
endif
	@echo "✅ Native core updated with architecture-specific binary."

clean:
	@echo ">>> Cleaning up..."
	cd $(OPENCODE_REPO) && git reset --hard $(OPENCODE_TAG) && git clean -fd
