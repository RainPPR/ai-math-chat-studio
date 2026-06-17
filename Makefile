.PHONY: all release clean

EXE_NAME := ai-math-chat-studio.exe
RELEASE_DIR := release
TARGET := $(RELEASE_DIR)/$(EXE_NAME)
ROOT_EXE := $(EXE_NAME)

all: release

release:
	@echo "Running bun compile..."
	bun run build:bun-compile
	@echo "Copying $(TARGET) to project root..."
	cp -f $(TARGET) $(ROOT_EXE)
	@echo "Done. $(ROOT_EXE) updated."

clean:
	rm -f $(ROOT_EXE)
	@echo "Cleaned up root $(EXE_NAME)."
