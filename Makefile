# --- Configuration ---
# Path to the Opencode source repository
OPENCODE_REPO ?= $(CURDIR)/opencode
# Tag to use as the base for building
OPENCODE_TAG  ?= v1.3.0
# Installation prefix (default: ~/.local)
PREFIX        ?= $(HOME)/.local
BIN_DIR       := $(PREFIX)/bin
BIN_NAME      := opencode

# Patch Artifact Configuration
PATCH_DIR         := patches
CORE_SRC_PREFIX   := packages/opencode/src

# Dynamic Patch Naming (Based on OPENCODE_TAG)
CAE_PATCH := $(PATCH_DIR)/edit_cae_$(OPENCODE_TAG).patch
PIN_PATCH := $(PATCH_DIR)/pin_reads_$(OPENCODE_TAG).patch

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
	@echo "Usage: make [target] [OPENCODE_REPO=/path/to/repo] [PREFIX=/install/path]"
	@echo ""
	@echo "Targets:"
	@echo "  build-patches  - Generate patches from src/ to $(PATCH_DIR) using dynamic naming"
	@echo "  patch          - Reset Opencode and apply new CAE patches ($(OPENCODE_TAG))"
	@echo "  build          - Compile the patched Opencode core"
	@echo "  install        - Install the architecture-specific binary to $(BIN_DIR)"
	@echo "  all            - Run build-patches, patch, build, and install"
	@echo "  clean          - Revert core patches and clean local build"

all: build-patches patch build install

build-patches:
	@mkdir -p $(PATCH_DIR)
	@rm -f $(PATCH_DIR)/*.patch
	@echo ">>> Generating patches for $(OPENCODE_TAG) from src/ to $(PATCH_DIR)..."
	
	# 1. Edit CAE Patch
	@git diff --no-index --no-prefix src/1.3.0/tool/edit.ts src/tool/edit.ts \
		| sed 's|src/1.3.0/|$(CORE_SRC_PREFIX)/|g' \
		| sed 's|src/|$(CORE_SRC_PREFIX)/|g' \
		> $(CAE_PATCH) || true
		
	# 2. Pin-Reads Patch
	@echo "" > $(PIN_PATCH)
	@git diff --no-index --no-prefix src/1.3.0/tool/read.ts src/tool/read.ts \
		| sed 's|src/1.3.0/|$(CORE_SRC_PREFIX)/|g' \
		| sed 's|src/|$(CORE_SRC_PREFIX)/|g' \
		>> $(PIN_PATCH) || true
	@git diff --no-index --no-prefix src/1.3.0/session/prompt.ts src/session/prompt.ts \
		| sed 's|src/1.3.0/|$(CORE_SRC_PREFIX)/|g' \
		| sed 's|src/|$(CORE_SRC_PREFIX)/|g' \
		>> $(PIN_PATCH) || true
		
	@echo "✅ Patches generated successfully: $(CAE_PATCH), $(PIN_PATCH)"

patch: build-patches
	@echo ">>> Resetting $(OPENCODE_REPO) to $(OPENCODE_TAG)..."
	cd $(OPENCODE_REPO) && git reset --hard $(OPENCODE_TAG) && git clean -fd
	@echo ">>> Applying new CAE patches for $(OPENCODE_TAG)..."
	cd $(OPENCODE_REPO) && git apply $(CURDIR)/$(CAE_PATCH)
	cd $(OPENCODE_REPO) && git apply $(CURDIR)/$(PIN_PATCH)
	@echo "✅ CAE logic successfully injected into core."

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
