#!/bin/bash
# Syncs the version from package.json into src/version.ts.
# Run automatically as part of the `build` script.

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
TARGET="src/version.ts"

cat > "$TARGET" <<EOF
/** Package version — auto-synced from package.json by scripts/sync-version.sh. */
export const VERSION = "${VERSION}";
EOF

echo "Synced version ${VERSION} → ${TARGET}"
