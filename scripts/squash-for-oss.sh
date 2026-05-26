#!/usr/bin/env bash
#
# squash-for-oss.sh — Build a public mirror from the private Qualia repo.
#
# Reads .squash-exclude (paths to omit from the public version), builds a
# fresh single-commit + v10.0-tagged git repo at $MIRROR_DIR, optionally
# pushes to a GitHub repo URL.
#
# Usage:
#   ./scripts/squash-for-oss.sh                       # default: dry-run, build only
#   ./scripts/squash-for-oss.sh --push <git-url>      # build + push to <git-url>
#   ./scripts/squash-for-oss.sh --inspect             # just print which files would be excluded
#
# The mirror directory at /tmp/qualia-oss-mirror/ is rebuilt every run.

set -euo pipefail

SRC_DIR="$(git rev-parse --show-toplevel)"
MIRROR_DIR="/tmp/qualia-oss-mirror"
EXCLUDE_FILE="$SRC_DIR/.squash-exclude"

MODE="dry-run"
PUSH_URL=""

case "${1:-}" in
  --push)
    MODE="push"
    PUSH_URL="${2:-}"
    if [[ -z "$PUSH_URL" ]]; then
      echo "Error: --push requires a git URL" >&2
      exit 1
    fi
    ;;
  --inspect)
    MODE="inspect"
    ;;
  --help|-h)
    sed -n '3,16p' "$0" | sed 's/^# \?//'
    exit 0
    ;;
esac

if [[ ! -f "$EXCLUDE_FILE" ]]; then
  echo "Error: $EXCLUDE_FILE not found" >&2
  exit 1
fi

echo "═══ squash-for-oss ═══"
echo "Source: $SRC_DIR"
echo "Mirror: $MIRROR_DIR"
echo "Mode:   $MODE"
[[ "$MODE" == "push" ]] && echo "Push:   $PUSH_URL"
echo ""

# ── Inspect mode: list excluded files + exit ─────────────────────────────
if [[ "$MODE" == "inspect" ]]; then
  echo "─── .squash-exclude entries ───"
  grep -vE "^#|^$" "$EXCLUDE_FILE"
  echo ""
  echo "─── files that would be EXCLUDED from public mirror ───"
  python3 <<PYEOF
import subprocess
excludes = [l.strip() for l in open("$EXCLUDE_FILE").read().splitlines() if l.strip() and not l.startswith("#")]
excludes = [e.rstrip("/") for e in excludes]
files = subprocess.check_output(["git", "-C", "$SRC_DIR", "ls-files"], text=True).splitlines()
excluded = [f for f in files if any(f == e or f.startswith(e + "/") for e in excludes)]
for f in excluded[:50]:
    print(f"  {f}")
if len(excluded) > 50:
    print(f"  ...+{len(excluded) - 50} more")
print(f"\nTotal: {len(excluded)} excluded / {len(files)} tracked")
PYEOF
  exit 0
fi

# ── Build the mirror ─────────────────────────────────────────────────────
rm -rf "$MIRROR_DIR"
mkdir -p "$MIRROR_DIR"

echo "─── building mirror ───"
python3 <<PYEOF
import os, shutil, subprocess
excludes = [l.strip() for l in open("$EXCLUDE_FILE").read().splitlines() if l.strip() and not l.startswith("#")]
excludes = [e.rstrip("/") for e in excludes]
files = subprocess.check_output(["git", "-C", "$SRC_DIR", "ls-files"], text=True).splitlines()
copied = skipped = missing = 0
for path in files:
    if any(path == e or path.startswith(e + "/") for e in excludes):
        skipped += 1
        continue
    src = os.path.join("$SRC_DIR", path)
    dst = os.path.join("$MIRROR_DIR", path)
    if not os.path.exists(src):
        missing += 1
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    copied += 1
print(f"copied={copied}, skipped={skipped}, missing={missing}")
PYEOF

# Strip .DS_Store defensively
find "$MIRROR_DIR" -name ".DS_Store" -delete

# ── Initialize git + commit + tag ────────────────────────────────────────
cd "$MIRROR_DIR"
git init --initial-branch=main >/dev/null

# Pin commit author to GitHub noreply so the public log never exposes the
# operator's real gmail. Override via env vars if needed for a different
# identity (e.g. `GIT_AUTHOR_NAME="Foo" GIT_AUTHOR_EMAIL="bar@example.com"
# ./scripts/squash-for-oss.sh --push ...`).
PUBLIC_AUTHOR_NAME="${GIT_AUTHOR_NAME:-Andrea Deiturbe}"
PUBLIC_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-259413742+Soba-noodl@users.noreply.github.com}"
git config user.name  "$PUBLIC_AUTHOR_NAME"
git config user.email "$PUBLIC_AUTHOR_EMAIL"

git add -A

PUBLIC_VERSION="${PUBLIC_VERSION:-v10.1}"

COMMIT_MSG="chore: public release ${PUBLIC_VERSION}

Qualia is an AI-powered UX audit tool. Originally hosted at qualia-ux.com.
Shut down commercially May 2026. Released as MIT-licensed snapshot for
reference and learning.

This commit is a squashed snapshot of the current private repo state —
full development history is retained in the private repo
Soba-noodl/qualia-mvp. Operator-personal material (research notes,
contacts, building logs, internal planning docs, IDE configs,
scratchpads) is intentionally excluded per .squash-exclude.

See README.md for setup. See CHANGELOG.md for version history.
See CONTRIBUTING.md for contribution policy (PRs not actively reviewed)."

git commit -m "$COMMIT_MSG" >/dev/null

git tag -a "$PUBLIC_VERSION" -m "Open ${PUBLIC_VERSION} — see CHANGELOG.md for details."

# ── Report ───────────────────────────────────────────────────────────────
echo ""
echo "─── mirror status ───"
echo "Files:  $(git ls-files | wc -l | xargs)"
echo "LOC:    $(git ls-files | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Tag:    $PUBLIC_VERSION"
echo "Author: $(git log -1 --format='%an <%ae>')"

# ── Push if requested ────────────────────────────────────────────────────
if [[ "$MODE" == "push" ]]; then
  echo ""
  echo "─── pushing to $PUSH_URL ───"
  git remote add origin "$PUSH_URL"
  # Force-push because the public repo already has earlier squashed history
  # (v10.0 + 2 doc fixup commits). We're replacing the entire history with
  # the current private repo state on each public release.
  git push -u --force origin main
  git push --force origin "$PUBLIC_VERSION"
  echo ""
  echo "✓ Pushed. Public repo URL above."
  echo "Mirror still at $MIRROR_DIR for inspection."
else
  echo ""
  echo "═══ DRY RUN — nothing pushed ═══"
  echo "Inspect the mirror at: $MIRROR_DIR"
  echo "To push: ./scripts/squash-for-oss.sh --push <git-url>"
fi
