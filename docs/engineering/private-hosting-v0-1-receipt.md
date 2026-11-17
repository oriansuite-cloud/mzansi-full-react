# MzansiCloud Private Hosting v0.1 — engineering receipt (2026-11-17)

Source: oriansuite-cloud/mzansi-full-react, initial template commit 653a5b217985616a77343b1f5bad50a5401364c2. Upstream MIT attribution retained. This work is confined to VPS-1 mbc-operations-01.

## Operational release
- React 19 frontend, Hono API and PostgreSQL 18 deployed independently of EasyPanel.
- VPS-1 root ext4 source: /opt/mzansicloud-private-hosting
- Production secret environment: /etc/mzansicloud-hosting/production.env, mode 0600, not in source control.
- Compose project mzansi-hosting-v0: web, api and postgres containers running.
- GET http://127.0.0.1:8788/ returned HTTP 200 and correct MzansiCloud title.
- GET http://127.0.0.1:8788/api/health returned healthy with live database connectivity.
- PostgreSQL database migration executed, 20 public schema tables.
- Anonymous GET /api/hosting/overview returned HTTP 401.
- 50 API tests and 50 frontend tests passed. API/web typechecks and production builds passed.
- Product schema: hosting tenant, application, domain records; write operations are DRAFT-only.
- Komodo independently running HTTP 200 on localhost 127.0.0.1:9120.
- Technitium v15.6.2 running HTTP 200 on localhost 127.0.0.1:5380 and DNS answer on localhost 5353; Hono API can access its web console on private Docker network. No public DNS change or nameserver delegation.

## Existing services and safety
- Existing VPS-1 EasyPanel, Forgejo, legacy WordPress services and public proxy are NOT removed yet.
- Rosetta pilot-001 original MariaDB is on troubled /dev/vdb XFS after Vultr London Storage incident ALRT-3YSFBAG; database salvage is incomplete. Do not delete, detach, wipe or repair this device while data recovery is outstanding.
- Existing WordPress store includes plugin files woocommerce-payfast-gateway, woo-paystack and custom Paystack adapters. Their activity, credentials and transaction validity were NOT verified; no payment requests were made.
- No actions were taken on VPS-2, 3, 4, 5 or 6.

## Security and known gaps
- New web, Technitium and Komodo consoles are localhost-only, reached by SSH tunnel.
- Public registration is disabled; database still contains zero users. One-time operator bootstrap was blocked by execution safeguards, so no interactive owner login has been verified.
- MBC Hosting Engine remains inactive and is not wired for paid provisioning.
- Komodo remains independent; authenticated Komodo mutation integration is not yet implemented.
- Technitium is only private DNS staging; public authoritative DNS zone design has not been implemented.
- No public HTTPS cutover, tenant production provisioning, billing integration, disaster recovery rehearsal, or removal of EasyPanel has occurred.
- Full corporate hosting product release is NOT claimed.

## Private access from Fedora
ssh -N -L 8788:127.0.0.1:8788 -L 9120:127.0.0.1:9120 -L 5380:127.0.0.1:5380 mbc-vultr-01

Frontend: http://127.0.0.1:8788/
Komodo: http://127.0.0.1:9120/
Technitium: http://127.0.0.1:5380/

## Next release gates
Controlled first owner account, secure MBC Engine adapter and payment authorization, Komodo API orchestration with tenant ownership boundaries, authoritative DNS API with split-horizon safety, Cloud Firewall checks, backup/restore proof, and independent TLS proxy before retiring EasyPanel.

This is an operational PRIVATE ENGINEERING BASELINE, not a public commercial launch.
