# --- Configuration ---
# Path to the Opencode source repository
OPENCODE_REPO ?= $(CURDIR)/opencode
# Tag to use as the base for building
OPENCODE_TAG  ?= v1.2.27
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

.PHONY: all patch build install plugin-install clean help

help:
	@echo "Opencode CAE Maintenance System"
	@echo "Usage: make [target] [OPENCODE_REPO=/path/to/repo] [PREFIX=/install/path]"
	@echo ""
	@echo "Targets:"
	@echo "  patch          - Reset Opencode to $(OPENCODE_TAG) and apply patches"
	@echo "  build          - Compile the patched Opencode core"
	@echo "  install        - Install the architecture-specific binary to $(BIN_DIR)"
	@echo "  plugin-install - Build and install the edit_cae plugin to user space"
	@echo "  all            - Run all of the above"
	@echo "  clean          - Revert core patches and clean local build"

all: patch build install plugin-install

patch:
	@echo ">>> Resetting $(OPENCODE_REPO) to $(OPENCODE_TAG)..."
	cd $(OPENCODE_REPO) && git checkout . && git checkout $(OPENCODE_TAG)
	@echo ">>> Applying patches to $(OPENCODE_REPO)..."
	# [PAUSED] 測試後對 opencode agent 行為有不良影響，暫不套用
	# cd $(OPENCODE_REPO) && git apply $(CURDIR)/patches/remove_plan_mode_reminder.patch
	# [ACTIVE] 恢復視覺對位：讓 edit_cae 能顯示紅綠 Diff 視窗
	cd $(OPENCODE_REPO) && git apply $(CURDIR)/patches/tui_visual_parity.patch
	# [ACTIVE] 修復 Registry：確保 Metadata 傳遞完整
	cd $(OPENCODE_REPO) && git apply $(CURDIR)/patches/fix_registry_metadata.patch
	# [ACTIVE] 實作 Pin-Reads：動態上下文調度系統
	cd $(OPENCODE_REPO) && git apply $(CURDIR)/patches/pin_reads_scheduler.patch

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

plugin-install:
	@echo ">>> Building and installing edit_cae plugin..."
	npm run build
	mkdir -p $(HOME)/.opencode/plugins
	cp -f plugin/index.js $(HOME)/.opencode/plugins/edit_cae.js
	@echo "✅ Plugin installed to ~/.opencode/plugins/edit_cae.js"

clean:
	@echo ">>> Cleaning up..."
	cd $(OPENCODE_REPO) && git checkout . && git checkout $(OPENCODE_TAG)
	rm -rf plugin/
