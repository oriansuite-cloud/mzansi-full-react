#!/usr/bin/env bash
# Safe local installer tests: no containers started, no credentials generated.
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SCRIPT="$HERE/mzansi-box.sh"
bash -n "$SCRIPT"
pass() { printf 'PASS: %s\n' "$*"; }
rejects() {
  if bash "$SCRIPT" "$@" >/dev/null 2>&1; then
    printf 'FAIL: accepted invalid input:' >&2
    printf ' %q' "$@" >&2
    printf '\n' >&2
    exit 1
  fi
}
bash "$SCRIPT" --help | grep -q 'Webhosting Business in a Box'
pass help
bash "$SCRIPT" install --edition corporate --dry-run | grep -q 'No changes made'
pass corporate-dry-run
bash "$SCRIPT" install --edition reseller --dry-run | grep -q 'No changes made'
pass reseller-dry-run
bash "$SCRIPT" install --without-komodo --without-dns --dry-run | grep -q 'Komodo=false, Technitium=false'
pass optional-service-flags
rejects install --edition unknown --dry-run
pass invalid-edition-rejected
rejects install --http-port 80 --dry-run
rejects install --http-port xyz --dry-run
pass unsafe-ports-rejected
rejects install --config-dir relative/path --dry-run
pass relative-secrets-path-rejected
rejects install --surprise --dry-run
pass unknown-flag-rejected
rejects mystery --dry-run
pass unknown-action-rejected
printf 'All MzansiCloud installer tests passed. No production operations were executed.\n'
