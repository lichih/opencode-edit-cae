# --- Configuration ---
# Path to the Opencode source repository
OPENCODE_REPO ?= $(CURDIR)/../_opencode
# Installation prefix (default: ~/.local)
PREFIX        ?= $(HOME)/.local
BIN_DIR       := $(PREFIX)/bin
BIN_NAME      := opencode
PATCH_FILE    := $(CURDIR)/patches/opencode_visual_parity.patch

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

.PHONY: all patch build install plugin-install clean help

help:
	@echo "Opencode CAE Maintenance System"
	@echo "Usage: make [target] [OPENCODE_REPO=/path/to/repo] [PREFIX=/install/path]"
	@echo ""
	@echo "Targets:"
	@echo "  patch          - Apply visual-parity patch to Opencode core (Registry & TUI)"
	@echo "  build          - Compile the patched Opencode core"
	@echo "  install        - Install the architecture-specific binary to $(BIN_DIR)"
	@echo "  plugin-install - Build and install the edit_cae plugin to user space"
	@echo "  all            - Run all of the above"
	@echo "  clean          - Revert core patches and clean local build"

all: patch build install plugin-install

patch:
	@echo ">>> Reverting and applying visual parity patch to $(OPENCODE_REPO)..."
	cd $(OPENCODE_REPO) && git checkout packages/opencode/src/tool/registry.ts
	cd $(OPENCODE_REPO) && git checkout packages/opencode/src/cli/cmd/tui/routes/session/index.tsx
	cd $(OPENCODE_REPO) && git apply $(PATCH_FILE)

build:
	@echo ">>> Building Opencode..."
	cd $(OPENCODE_REPO) && bun install && bun run --cwd packages/opencode build

install:
	@echo ">>> Installing binary $(ARCH_BIN) to $(BIN_DIR)/$(BIN_NAME)..."
	mkdir -p $(BIN_DIR)
	cp $(OPENCODE_REPO)/packages/opencode/$(ARCH_BIN) $(BIN_DIR)/$(BIN_NAME)
	chmod +x $(BIN_DIR)/$(BIN_NAME)
	@echo "✅ Native core updated with architecture-specific binary."

plugin-install:
	@echo ">>> Building and installing edit_cae plugin..."
	npm run build
	mkdir -p $(HOME)/.opencode/plugins
	cp -f plugin/index.js $(HOME)/.opencode/plugins/edit_cae.js
	@echo "✅ Plugin installed to ~/.opencode/plugins/edit_cae.js"

clean:
	@echo ">>> Cleaning up..."
	cd $(OPENCODE_REPO) && git checkout packages/opencode/src/tool/registry.ts
	cd $(OPENCODE_REPO) && git checkout packages/opencode/src/cli/cmd/tui/routes/session/index.tsx
	rm -rf plugin/
