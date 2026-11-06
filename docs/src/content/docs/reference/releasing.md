---
title: Releasing
description: How releases, downloads and the Docker image are built and published, entirely by GitHub Actions.
sidebar:
  order: 5
---

Releases are built by [GitHub Actions]({{repo}}/actions). Nothing needs to be installed on your own machine: no Docker, no Rust cross-compilers, no Mac.

## What a release produces

One run of the **Release** workflow (`.github/workflows/release.yml`) builds:

| Output | Built on | Notes |
|---|---|---|
| `windows-x64` `.zip` | Windows runner | MSVC build, schannel TLS |
| `linux-x64` and `linux-arm64` `.tar.gz` | Linux runners (Intel/AMD and native Arm) | Static musl binaries built inside Alpine, OpenSSL compiled in |
| `macos-arm64` and `macos-x64` `.tar.gz` | macOS runner | The Intel build is cross-compiled; not signed or notarised |
| `SHA256SUMS` | | Checksums of every file above |
| Docker image | Linux runner, QEMU for the Arm layer | Multi-architecture (`amd64` and `arm64`), pushed to `ghcr.io/rmalcomber/home_screen` |

The Docker image does not compile anything again: it copies the two Linux binaries the workflow just built, so the files you download and the image run exactly the same program.

Before anything is built, the workflow runs the web interface tests, and the Windows and macOS (Apple silicon) jobs run the Rust tests.

## Cutting a release

1. Update `version` in `docs/src/site.config.mjs` and add a page in `docs/src/content/docs/releases/`.
2. Commit, then tag and push:

   ```bash
   git tag v0.1.0-beta
   git push origin main v0.1.0-beta
   ```

3. Watch the run under **Actions → Release**. When it is green, the GitHub release exists with all files attached and notes generated from the commits since the previous tag. Tags that contain a `-` (`v0.1.0-beta`, `v1.0.0-rc.1`) are marked as pre-releases.

The tag must look like `v1.2.3` or `v1.2.3-beta`; anything else stops the workflow at the first step.

## Trying it without publishing

Open **Actions → Release → Run workflow**, type a tag such as `v0.0.0-test`, and leave **publish** unticked. Everything is built (including the Docker image, which is built but not pushed) and the files are kept as artifacts on the run page for a few days. Nothing is released and no tag is created.

## Deploying the Docker image without Docker

You do not need Docker on your own machine to publish the image. The workflow logs in to GitHub's container registry with the run's own token and pushes the image, so tagging a release (or running the workflow with **publish** ticked) is the whole deployment. Use **Run workflow** with **publish** ticked to publish from a branch without a local tag; the tag is created for you on that commit.

Two one-time details:

- **Package visibility.** The first push creates a *private* package. Make it public under the repository's **Packages → Package settings → Change visibility** so anyone can pull it.
- **Arm runners.** The `linux-arm64` job uses GitHub's free native Arm runner, which is available for public repositories. A private repository without Arm runners will queue that job forever; remove it from the matrix or switch to a QEMU build.

## The documentation site

The **Docs** workflow (`.github/workflows/docs.yml`) is separate: it builds this site and publishes it to GitHub Pages whenever `docs/` changes on `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.
