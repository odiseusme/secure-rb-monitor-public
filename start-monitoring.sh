#!/usr/bin/env bash
set -Eeuo pipefail

# Universal, copy-paste-safe launcher for the uploader.
# Policy: >= 12 characters OR >= 3 words, AND at least 3 of 4 classes (lower/upper/digit/symbol).
# A tiny denylist blocks only obvious demo passwords.

SYNC_JS="${SYNC_JS:-cloudflare-sync.js}"

if [[ -z "${DASH_PASSPHRASE:-}" ]]; then
  echo "[ERROR] DASH_PASSPHRASE is not set. Export a strong passphrase and re-run." >&2
  exit 1
fi

# refuse known demo/weak passphrases (allow your real one)
DEMO_LIST_REGEX='^(TestPassphrase123!|password|Passw0rd|123456|qwerty)$'
if [[ "${DASH_PASSPHRASE}" =~ ${DEMO_LIST_REGEX} ]]; then
  echo "[ERROR] This passphrase is known-weak/demo. Choose a stronger one." >&2
  exit 2
fi

pass="${DASH_PASSPHRASE}"
len_ok=0; classes=0; words_ok=0

# policy: ≥12 chars OR ≥3 words (split on spaces or hyphens)
[[ ${#pass} -ge 12 ]] && len_ok=1
IFS=' -' read -r -a parts <<< "${pass}"
[[ ${#parts[@]} -ge 3 ]] && words_ok=1

# character classes: need 3 of 4
[[ "${pass}" =~ [a-z] ]] && ((classes++))
[[ "${pass}" =~ [A-Z] ]] && ((classes++))
[[ "${pass}" =~ [0-9] ]] && ((classes++))
[[ "${pass}" =~ [^[:alnum:]] ]] && ((classes++))

if ! { [[ "$len_ok" -eq 1 || "$words_ok" -eq 1 ]] && [[ "$classes" -ge 3 ]]; }; then
  echo "[ERROR] Weak passphrase. Use ≥12 chars (3+ classes) or a ≥3-word phrase (3+ classes)." >&2
  exit 3
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p logs
node "${SYNC_JS}" | tee -a ./logs/cloudflare-sync.log
