#!/usr/bin/env bash
# MzansiCloud one-command PRIVATE installation (no EasyPanel dependency).
set -Eeuo pipefail
umask 077
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$HERE/.." && pwd -P)"
APP="$HERE/docker-compose.hosting.yml"
DNS="$HERE/docker-compose.technitium.yml"
KOMODO="$HERE/docker-compose.komodo.yml"
ACTION="${1:-help}"
(( $# == 0 )) || shift
EDITION=corporate
CONFIG_DIR="${MZC_CONFIG_DIR:-/etc/mzansicloud-box}"
HTTP_PORT="${MZC_HTTP_PORT:-8788}"
WITH_KOMODO=true
WITH_DNS=false
DRY_RUN=false

usage() {
  cat <<'HELP'
MzansiCloud — Corporate Private Hosting / Webhosting Business in a Box

sudo bash infra/mzansi-box.sh install --edition corporate
sudo bash infra/mzansi-box.sh install --edition reseller
bash infra/mzansi-box.sh doctor
bash infra/mzansi-box.sh verify
bash infra/mzansi-box.sh install --dry-run

Options:
  --edition corporate|reseller
  --config-dir /absolute/private/config/path
  --http-port 8788
  --without-komodo       do not install/check Komodo
  --with-technitium      optional internal DNS lab (last phase)
  --without-dns          compatibility alias: skip Technitium
  --dry-run              preview; perform NO writes
  --help

Installs to localhost-only ports: React 8788, Komodo 9120, DNS UI 5380,
DNS test port 5353. Does NOT create public DNS, TLS, merchant accounts,
customer tenants, or payment entitlements. Those require verified setup.
HELP
}
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '[MzansiCloud] %s\n' "$*"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "Missing prerequisite: $1"; }
running() { docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true; }
healthy_url() {
  local url="$1" code n
  for n in {1..15}; do
    code="$(curl -s -o /dev/null --max-time 4 -w '%{http_code}' "$url")" || code=000
    if [[ "$code" == 200 ]]; then info "HTTP 200: $url"; return 0; fi
    sleep 2
  done
  fail "$url failed verification after 15 attempts (last HTTP $code)"
}

while (( $# )); do
  case "$1" in
    --edition) (( $# >= 2 )) || fail "Missing --edition value"; EDITION="$2"; shift 2;;
    --config-dir) (( $# >= 2 )) || fail "Missing --config-dir value"; CONFIG_DIR="$2"; shift 2;;
    --http-port) (( $# >= 2 )) || fail "Missing --http-port value"; HTTP_PORT="$2"; shift 2;;
    --without-komodo) WITH_KOMODO=false; shift;;
    --with-technitium) WITH_DNS=true; shift;;
    --without-dns) WITH_DNS=false; shift;;
    --dry-run) DRY_RUN=true; shift;;
    --help|-h) usage; exit 0;;
    *) fail "Unknown option $1";;
  esac
done
[[ "$ACTION" == help || "$ACTION" == --help || "$ACTION" == -h || "$ACTION" == install || "$ACTION" == doctor || "$ACTION" == verify ]] ||
  fail "Unknown action $ACTION"
[[ "$EDITION" == corporate || "$EDITION" == reseller ]] || fail "Unsupported edition"
[[ "$CONFIG_DIR" == /* ]] || fail "Config path must be absolute"
[[ "$HTTP_PORT" =~ ^[0-9]+$ ]] && (( HTTP_PORT >= 1024 && HTTP_PORT < 65536 )) ||
  fail "HTTP port must be 1024–65535"
[[ -r "$APP" && -r "$DNS" && -r "$KOMODO" ]] || fail "Installer bundle incomplete"
if [[ "$ACTION" == help || "$ACTION" == --help || "$ACTION" == -h ]]; then usage; exit 0; fi

info "Mode=$ACTION, edition=$EDITION, config=$CONFIG_DIR, private port=$HTTP_PORT"
info "Komodo=$WITH_KOMODO, Technitium=$WITH_DNS"
info "Public DNS, 80/443, host firewall, other Compose projects and legacy data untouched."
if [[ "$DRY_RUN" == true ]]; then
  info "Dry run: would install private secrets if absent, then build web/API, migrate DB,"
  info "deploy Komodo/DNS if selected, run health checks. No changes made."
  exit 0
fi

need docker
docker compose version >/dev/null || fail "Docker Compose v2 required"
need curl
need openssl
APP_ENV="$CONFIG_DIR/app.env"
DNS_ENV="$CONFIG_DIR/dns.env"
KOMODO_ENV="$CONFIG_DIR/komodo.env"
export MZC_KOMODO_ENV_FILE="$KOMODO_ENV"
export MZC_HTTP_PORT="$HTTP_PORT"
export MZC_KOMODO_ROOT_DIR=/etc/komodo
app() { docker compose --env-file "$APP_ENV" -f "$APP" "$@"; }
dns() { docker compose --env-file "$DNS_ENV" -f "$DNS" "$@"; }
komodo() { docker compose --env-file "$KOMODO_ENV" -f "$KOMODO" "$@"; }

if [[ "$ACTION" == doctor ]]; then
  info "Docker $(docker version --format '{{.Server.Version}}')"
  info "Compose $(docker compose version --short)"
  [[ -f "$APP_ENV" ]] && info 'Installer-managed application secrets present' ||
    info 'Installer-managed application secrets not yet created'
  for container in mzansi-hosting-v0-web-1 mzansi-hosting-v0-api-1 mzansi-hosting-v0-db-1 mzansi-komodo-core-1 mzansi-technitium-dns-1; do
    if running "$container"; then info "$container: running"; else info "$container: not running"; fi
  done
  exit 0
fi
if [[ "$ACTION" == verify ]]; then
  for svc in mzansi-hosting-v0-web-1 mzansi-hosting-v0-api-1 mzansi-hosting-v0-db-1; do
    running "$svc" || fail "$svc not running"
  done
  healthy_url "http://127.0.0.1:$HTTP_PORT/"
  healthy_url "http://127.0.0.1:$HTTP_PORT/api/health"
  if [[ "$WITH_KOMODO" == true ]]; then
    running mzansi-komodo-core-1 || fail 'Komodo Core not running'
    healthy_url http://127.0.0.1:9120/
  fi
  if [[ "$WITH_DNS" == true ]]; then
    running mzansi-technitium-dns-1 || fail 'Technitium not running'
    healthy_url http://127.0.0.1:5380/
  fi
  info 'Private application baseline VERIFIED. No commercial payments/provisioning asserted.'
  exit 0
fi

# Install: existing deployments with external credentials must not be overwritten.
(( EUID == 0 )) || fail 'Install needs root/sudo'
need findmnt
docker_fs="$(findmnt -n -T /var/lib/docker -o SOURCE)"
[[ "$docker_fs" != /dev/vdb* ]] || fail 'Docker points to protected tenant XFS volume'
if running mzansi-hosting-v0-db-1 && [[ ! -f "$APP_ENV" ]]; then
  fail "Existing MzansiCloud DB detected with a different secrets path; refusing to recreate it"
fi
if [[ -f "$APP_ENV" ]]; then
  installed_edition="$(grep -m1 '^MZC_EDITION=' "$APP_ENV" | cut -d= -f2- || true)"
  if [[ -n "$installed_edition" && "$installed_edition" != "$EDITION" ]]; then
    fail "Existing installation is $installed_edition; refusing silent switch to $EDITION"
  fi
  grep -qx "BETTER_AUTH_URL=http://127.0.0.1:$HTTP_PORT" "$APP_ENV" ||
    fail "Requested private port differs from stored authentication origin"
fi
install -d -m 700 "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

if [[ ! -f "$APP_ENV" ]]; then
  [[ ! -e "$APP_ENV" ]] || fail "Application environment path exists but is not a file"
  db_password="$(openssl rand -hex 32)"
  auth_secret="$(openssl rand -hex 48)"
  tmp="$(mktemp "$CONFIG_DIR/.app.XXXXXXXX")"
  cat > "$tmp" <<ENV
POSTGRES_PASSWORD=$db_password
DATABASE_URL=postgresql://mzansihosting:$db_password@db:5432/mzansihosting
BETTER_AUTH_SECRET=$auth_secret
BETTER_AUTH_URL=http://127.0.0.1:$HTTP_PORT
FRONTEND_URL=http://127.0.0.1:$HTTP_PORT
MZC_ALLOW_SIGNUP=false
MZC_EDITION=$EDITION
MZC_DNS_PROVIDER=domains.co.za
ENV
  chmod 600 "$tmp"
  mv -n "$tmp" "$APP_ENV"
  [[ -e "$tmp" ]] && rm -f "$tmp"
  info 'Generated private application secrets (not printed).'
else
  info 'Reusing existing application secrets (no rotation).'
fi

if [[ "$WITH_KOMODO" == true ]]; then
  if running mzansi-komodo-core-1; then
    info 'Existing Komodo detected; left unchanged.'
  else
    if [[ ! -e "$KOMODO_ENV" ]]; then
      admin_pass="$(openssl rand -hex 32)"
      tmp="$(mktemp "$CONFIG_DIR/.komodo.XXXXXXXX")"
      cat > "$tmp" <<ENV
KOMODO_DATABASE_USERNAME=komodo
KOMODO_DATABASE_PASSWORD=$(openssl rand -hex 32)
KOMODO_HOST=http://127.0.0.1:9120
KOMODO_LOCAL_AUTH=true
KOMODO_INIT_ADMIN_USERNAME=mzansi-operator
KOMODO_INIT_ADMIN_PASSWORD=$admin_pass
KOMODO_DISABLE_USER_REGISTRATION=true
KOMODO_ENABLE_NEW_USERS=false
KOMODO_DISABLE_NON_ADMIN_CREATE=true
KOMODO_WEBHOOK_SECRET=$(openssl rand -hex 32)
KOMODO_JWT_SECRET=$(openssl rand -hex 32)
KOMODO_TITLE=MzansiCloud-Private-Hosting
PERIPHERY_ROOT_DIRECTORY=/etc/komodo
PERIPHERY_DISABLE_TERMINALS=true
PERIPHERY_DISABLE_CONTAINER_TERMINALS=true
PERIPHERY_CORE_ADDRESS=ws://core:9120
PERIPHERY_CONNECT_AS=local-node
KOMODO_FIRST_SERVER_NAME=local-node
ENV
      chmod 600 "$tmp"
      mv -n "$tmp" "$KOMODO_ENV"
      [[ -e "$tmp" ]] && rm -f "$tmp"
      printf 'Komodo initial user: mzansi-operator\nInitial password: %s\n' "$admin_pass" > "$CONFIG_DIR/komodo-first-login.txt"
      chmod 600 "$CONFIG_DIR/komodo-first-login.txt"
    fi
    komodo up -d
    info 'Komodo started on localhost 9120.'
  fi
fi

app config --quiet
app up -d db
app build api web
app run --rm api node dist/db/migrate.mjs
app up -d --no-build
info 'React, Hono API and PostgreSQL deployed.'

if [[ "$WITH_DNS" == true ]]; then
  if running mzansi-technitium-dns-1; then
    info 'Existing Technitium detected; no zones changed.'
  else
    if [[ ! -e "$DNS_ENV" ]]; then
      tmp="$(mktemp "$CONFIG_DIR/.dns.XXXXXXXX")"
      printf 'DNS_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 32)" > "$tmp"
      chmod 600 "$tmp"
      mv -n "$tmp" "$DNS_ENV"
      [[ -e "$tmp" ]] && rm -f "$tmp"
    fi
    dns up -d
    info 'Technitium started on localhost 5380.'
  fi
fi

# Preserve the exit status of verification; no false success on partial deployment.
args=(verify --edition "$EDITION" --http-port "$HTTP_PORT" --config-dir "$CONFIG_DIR")
[[ "$WITH_KOMODO" == false ]] && args+=(--without-komodo)
[[ "$WITH_DNS" == true ]] && args+=(--with-technitium)
"$0" "${args[@]}"
info 'Operator bootstrap and production DNS/HTTPS cutover remain separate approval gates.'
