#!/usr/bin/env bash
# Backfill every showcase row into both locales.
#  - English-source dev tools  → translate en→it (adds mission/context/personas)
#  - Italian-source own-work    → translate it→en (full body + mission)
#
# Requires in env: ANTHROPIC_API_KEY
# Derives SUPABASE_URL + SUPABASE_SERVICE_KEY from the local Supabase project.
#
# Run:  ANTHROPIC_API_KEY=sk-ant-... bash scripts/translate-showcase-all.sh [--dry-run]
set -euo pipefail

: "${ANTHROPIC_API_KEY:?set ANTHROPIC_API_KEY in env before running}"

REF=$(grep -oE 'project_id = "[^"]+"' supabase/config.toml | cut -d'"' -f2)
export SUPABASE_URL="https://${REF}.supabase.co"
export SUPABASE_SERVICE_KEY=$(supabase projects api-keys --project-ref "$REF" | grep service_role | awk '{print $NF}')

DRY="${1:-}"

run() { npx tsx scripts/translate-showcase-audit.ts --audit-id "$1" --source "$2" --locale "$3" $DRY; }

# English-source → Italian
run e396d03c-8378-4a8b-b56f-5c3f0ee7a842 en it  # linear
run 5bc6eceb-1f4a-4a20-af97-a888c599ed09 en it  # vercel
run aa2e25b7-df5d-450d-a48d-4a166aee02de en it  # supabase
run ce71cc3c-201b-48a3-82f3-c7461e64ead2 en it  # figma

# Italian-source → English
run 252ba27e-0158-4f7f-8680-ad55ebe3e1ab it en  # pando
run c4007d74-0ce1-4a2a-b76c-8113ae8951da it en  # windtre

echo "✓ all showcase rows translated into both locales"
