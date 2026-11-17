# MzansiCloud corporate hosting v0.1
Independent standalone Docker Compose; not managed by EasyPanel.
Deployment target VPS-1 only; original XFS tenant volume /dev/vdb is NOT mounted by this stack.

## Safety
- PostgreSQL uses a named root-disk Docker volume, no public database listener.
- The web service is reachable only on loopback 127.0.0.1:8788.
- DNS/hosting/app records are drafts. No provisioning, billing or authoritative DNS mutation in this release.
- No live customer payment is accepted.
- MZC_ALLOW_SIGNUP defaults false; initial bootstrap requires local-only temporary true setting.
- Before public cutover the HTTPS frontend origin and Better Auth URLs must match and HTTPS must terminate on a trusted proxy.
- Do not remove pilot-001 XFS storage or its database volume.

## Build and launch
On VPS-1 create /etc/mzansicloud-hosting/production.env mode 0600
with unique POSTGRES_PASSWORD, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL and FRONTEND_URL.
Then:
docker compose --env-file /etc/mzansicloud-hosting/production.env -f infra/docker-compose.hosting.yml build
docker compose --env-file /etc/mzansicloud-hosting/production.env -f infra/docker-compose.hosting.yml up -d db
docker compose --env-file /etc/mzansicloud-hosting/production.env -f infra/docker-compose.hosting.yml run --rm api node dist/db/migrate.mjs
docker compose --env-file /etc/mzansicloud-hosting/production.env -f infra/docker-compose.hosting.yml up -d
Verify curl http://127.0.0.1:8788/api/health/.
