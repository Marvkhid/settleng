#!/usr/bin/env bash
# Build command for the API on Render (or any npm-based host).
#
# Why a script: the service used to run `yarn install; yarn build`. That command used the wrong
# package manager (Yarn 1 while the repo is an npm workspace) and, because the steps were joined
# with `;`, a failed install was followed by a build attempt. This script installs and builds with
# npm only, and `set -euo pipefail` stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")/.."

node -e '
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    console.error(`SettleNG needs Node 20 or newer; found ${process.version}.`);
    process.exit(1);
  }
  console.log(`Building with Node ${process.version}`);
'

# The API is the only app hosted here; installing just its workspace keeps the build small.
# --include=dev is required because the build uses TypeScript/Nest CLI and prisma generate.
npm ci --include=dev --workspace api --no-audit --no-fund
npm run build --workspace api
