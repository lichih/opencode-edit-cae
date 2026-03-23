# --- Configuration ---
# Path to the Opencode source repository
OPENCODE_REPO ?= $(CURDIR)/opencode
# Tag to use as the base for building
OPENCODE_TAG  ?= v1.3.0
# Installation prefix (default: ~/.local)
PREFIX        ?= $(HOME)/.local
BIN_DIR       := $(PREFIX)/bin
BIN_NAME      := opencode

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

.PHONY: all patch build install clean help

help:
	@echo "Opencode CAE Maintenance System (Redo)"
	@echo "Usage: make [target] [OPENCODE_REPO=/path/to/repo] [PREFIX=/install/path]"
	@echo ""
	@echo "Targets:"
	@echo "  patch          - Reset Opencode to $(OPENCODE_TAG) and apply new CAE patch"
	@echo "  build          - Compile the patched Opencode core"
	@echo "  install        - Install the architecture-specific binary to $(BIN_DIR)"
	@echo "  all            - Run patch, build, and install"
	@echo "  clean          - Revert core patches and clean local build"

all: patch build install

patch:
	@echo ">>> Resetting $(OPENCODE_REPO) to $(OPENCODE_TAG)..."
	cd $(OPENCODE_REPO) && git reset --hard $(OPENCODE_TAG) && git clean -fd
	@echo ">>> Applying new CAE patch to $(OPENCODE_REPO)..."
	cd $(OPENCODE_REPO) && git apply $(CURDIR)/patches/edit_cae_v1.3.0.patch
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
