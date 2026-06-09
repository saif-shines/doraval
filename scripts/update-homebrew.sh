#!/usr/bin/env bash
# Usage: ./scripts/update-homebrew.sh <version> <arm64_sha> <x64_sha>
set -euo pipefail

VERSION=$1
ARM64_SHA=$2
X64_SHA=$3

TAP_REPO="saif-shines/homebrew-tap"
FORMULA_PATH="Formula/doraval.rb"

# Clone tap repo
git clone "https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/${TAP_REPO}.git" tap-repo
cd tap-repo

# Update version
sed -i "s/version \"[0-9.]*\"/version \"${VERSION}\"/" "${FORMULA_PATH}"

# Update both sha256 lines (arm64 first, x64 second) using Python
python3 - "${FORMULA_PATH}" "${ARM64_SHA}" "${X64_SHA}" <<'PYEOF'
import sys, re

path, arm64_sha, x64_sha = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(path).read()

# Only replace sha256 lines inside the on_macos block
# Match the on_macos block and replace sha256 values within it only
shas = [arm64_sha, x64_sha]
count = [0]

def replace_in_macos(m):
    block = m.group(0)
    def sub_sha(sm):
        idx = count[0]
        count[0] += 1
        return f'      sha256 "{shas[idx]}"'
    return re.sub(r'      sha256 "[0-9a-f]{64}"', sub_sha, block)

content = re.sub(r'on_macos do.*?end', replace_in_macos, content, flags=re.DOTALL)
open(path, 'w').write(content)
PYEOF

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add "${FORMULA_PATH}"
git commit -m "chore: update doraval to ${VERSION}"
git push
