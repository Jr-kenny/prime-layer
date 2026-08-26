#!/usr/bin/env bash
# One-off: link the repo to a Vercel project named primelayer (fallback primelayerlive),
# set all production env vars, and deploy to production.
set -e
cd /Users/user/Documents/prime-layer

NAME="primelayer"
if ! vercel projects inspect "$NAME" >/dev/null 2>&1; then
  if ! vercel project add "$NAME" 2>&1; then
    NAME="primelayerlive"
    vercel project add "$NAME" >/dev/null 2>&1 || true
  fi
fi

# Extract values from .env without printing secrets
get() { grep "^$1=" .env | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }

vercel link --yes --project "$NAME" >/dev/null 2>&1 || true

set_env() {
  local key="$1"; local val="$2"
  printf '%s' "$val" | vercel env add "$key" production 2>/dev/null >/dev/null && echo "  $key set" || echo "  $key FAILED"
}

echo "Setting env vars for $NAME..."
set_env DATABASE_URL "$(get DATABASE_URL)"
set_env DATABASE_AUTH_TOKEN "$(get DATABASE_AUTH_TOKEN)"
set_env ZERO_G_NETWORK "mainnet"
set_env ZERO_G_PRIVATE_KEY "$(get ZERO_G_PRIVATE_KEY)"
set_env ZERO_G_COMPUTE_API_KEY "$(get ZERO_G_COMPUTE_API_KEY)"
set_env ZERO_G_COMPUTE_BASE_URL "$(get ZERO_G_COMPUTE_BASE_URL)"
set_env AGENTIC_ID_CONTRACT "$(get AGENTIC_ID_CONTRACT)"
set_env VITE_PRIVY_APP_ID "$(get VITE_PRIVY_APP_ID)"
set_env PRIME_RUN_PRICE_USD "20"
set_env PRIME_OG_USD_RATE "2"

echo "Deploying to production..."
vercel deploy --prod --yes 2>&1 | tail -3
