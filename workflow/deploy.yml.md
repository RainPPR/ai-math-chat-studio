```yaml
name: Deploy and Sync

on:
  push:
    branches:
      - desktop
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  deploy-context7:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: desktop
          fetch-depth: 0

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

      - name: Install dependencies
        run: bun install

      - name: Run preparation script
        run: bun scripts/prepare-context7.ts

      - name: Deploy to context7 branch
        run: bun scripts/sync-context7.ts

  deploy-main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: desktop
          fetch-depth: 0

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

      - name: Install dependencies
        run: bun install

      - name: Run sync-main script
        run: bun scripts/sync-main.ts
        env:
          TRIGGER_COMMIT_MSG: ${{ github.event.head_commit.message }}

```