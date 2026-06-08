---
description: Merge upstream changes and release a new @revizly npm version
---

## Context

- Current branch: !`git branch --show-current`
- Commits in upstream/main not yet in revizlify: !`git fetch upstream && git log --oneline upstream/main ^revizlify`
- Current npm version: !`cat npm/linux-x64/package.json | grep '"version"'`
- Latest revizly tag: !`git tag --list | sort -V | tail -1`
- Latest @revizly/sharp-libvips-linux-x64 on npm: !`npm view @revizly/sharp-libvips-linux-x64 version`

## Your task

Perform the full upstream merge and release cycle for this fork:

### 1. Merge upstream

Run `git merge upstream/main` and resolve conflicts following these rules:

- **modify/delete conflicts** (platforms removed in revizlify): always `git rm` the file — keep them deleted.
- **New platform dirs in `npm/`** (e.g. `freebsd-wasm32`, `webcontainers-wasm32`, `wasm32`, `win32-*`, `darwin-*`, `linux-arm`, `linuxmusl-*`): `git rm -rf` them — we only keep `linux-arm64` and `linux-x64`.
- **`package.json` (root)**:
  - Keep our `version` (e.g. `0.35.0-revizly25`) — do NOT take upstream's version.
  - Keep our 4 `optionalDependencies` (`@revizly/sharp-libvips-linux-arm64`, `@revizly/sharp-libvips-linux-x64`, `@revizly/sharp-linux-arm64`, `@revizly/sharp-linux-x64`) — do NOT take upstream's `@img` entries.
  - Keep our `@revizly/sharp-libvips-dev` devDependency — do NOT take upstream's `@img/sharp-libvips-dev*` or win32 libvips devDeps.
  - DO take upstream's version bumps for other devDependencies (biome, emnapi, node-addon-api, etc.).
  - DO take upstream's `config.libvips` version bump.
- **`npm/linux-arm64/package.json`**, **`npm/linux-x64/package.json`**, **`npm/package.json`**: keep the `@revizly` name and current revizly version — do NOT take upstream's `@img` name or their version number.
- **`.github/workflows/ci.yml`**: drop upstream's new platform jobs (`build-linuxmusl-arm64`, `build-qemu`, `build-emscripten`) — keep only our `lint`, `build-native`, and `release` jobs.
- **`test/unit/libvips.js`**: drop any new tests for removed platforms (e.g. s390x yarn locator test) — keep only platform-agnostic tests. Note upstream has migrated tests to node:test (`suite`/`test` with a `t` param); take upstream's framework style.
- **`lib/constructor.mjs`**: revizly adds a `heifEncoder: 'auto'` default (svt-av1 encoder selection) right after `heifTune` — always KEEP `heifEncoder`. Take upstream's value for `heifTune` and any other defaults.
- **All other files** (`src/binding.gyp`, `src/common.h`, `biome.json`, docs, etc.): take upstream's changes.
- **`npm/wasm-wrappers.js`**: if upstream added new wasm platform dirs that we deleted (e.g. `freebsd-wasm32`, `webcontainers-wasm32`), also remove them from the `platforms` array in this file so the release job doesn't fail trying to read their deleted `package.json`.

After resolving all conflicts, `git add` the resolved files and `git commit` with message `Merge remote-tracking branch 'upstream/main' into revizlify`.

### 2. Bump npm version and update sharp-libvips

Fetch the latest published version of `@revizly/sharp-libvips-linux-x64` from npm:
```
npm view @revizly/sharp-libvips-linux-x64 version
```

Update the `@revizly/sharp-libvips-*` version pins to that version in:
- `package.json` (root) — `optionalDependencies` and `devDependencies` (`@revizly/sharp-libvips-linux-arm64`, `@revizly/sharp-libvips-linux-x64`, `@revizly/sharp-libvips-dev`)
- `npm/linux-arm64/package.json` — `optionalDependencies`
- `npm/linux-x64/package.json` — `optionalDependencies`

Read the current sharp version from `npm/linux-x64/package.json`. Increment the revizly number by 1 (e.g. `0.35.0-revizly25` → `0.35.0-revizly26`). Call the new version `NEW_VERSION`.

Update the sharp version in ALL of the following (both the package version AND any cross-references to the platform packages):
- `package.json` (root): `version` field AND `optionalDependencies["@revizly/sharp-linux-arm64"]` AND `optionalDependencies["@revizly/sharp-linux-x64"]` — all must be set to `NEW_VERSION`
- `npm/package.json`: `version` field
- `npm/linux-x64/package.json`: `version` field
- `npm/linux-arm64/package.json`: `version` field

Commit: `release prep`

### 3. Push and tag

```
git push origin revizlify
```

Determine the new tag from the version you just set (e.g. `0.35.0-revizly26` → `v0.35.0-revizly26`).

```
git tag v{version}
git push origin v{version}
```

### 4. Monitor CI

Poll `https://api.github.com/repos/janaz/sharp/actions/runs?per_page=5` every 3 minutes until a `CI` workflow run appears for the new tag. Then poll its jobs endpoint until all jobs complete.

Only monitor the **`CI`** workflow (the build/publish one). Ignore the **`CI: npm smoke test`** workflow — it runs in parallel with the build and will always fail for most package managers because it tries to install before packages are published. This is a known pre-existing issue.

#### Handling failures in the `CI` workflow

- **Build job fails at a setup/dependency step** (e.g. "Dependencies (Rocky Linux glibc)") before checkout or npm install: this is a flaky GitHub runner issue, not a code problem. Re-push the tag to trigger a new run:
  ```
  git tag -d v{version} && git push origin :refs/tags/v{version}
  git tag v{version} && git push origin v{version}
  ```
- **Release job fails with "cannot publish over the previously published versions"**: a prior CI run already published that version. Do NOT re-push the same tag — bump to the next revizly number instead (increment N in all five locations from step 2), commit as `release prep`, and push a new tag.
- **Any other failure**: report which job and step failed, then stop.
