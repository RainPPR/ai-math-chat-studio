```yaml
name: Build

on:
  push:
    branches:
      - desktop
    paths-ignore:
      - '.agents/**'
      - 'docs/**'
      - 'data/**'
      - 'README.md'
  pull_request:
    branches:
      - desktop
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Cache Bun dependencies
        uses: actions/cache@v6
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb', '**/bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install
      - run: bun --max-warnings=0 run check
        if: always()
      - run: bun --max-warnings=0 run pretty
        if: always()

  build-bundle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Cache Bun dependencies
        uses: actions/cache@v6
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb', '**/bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install
      - run: bun run build:bundle
      - uses: actions/upload-artifact@v7
        with:
          name: server-bundle
          path: dist-server/

  build-compile:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Cache Bun dependencies
        uses: actions/cache@v6
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb', '**/bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-
      - run: bun install
      - run: bun run build:compile
      - uses: actions/upload-artifact@v7
        with:
          name: bun-compile-windows
          path: release/*.exe

```