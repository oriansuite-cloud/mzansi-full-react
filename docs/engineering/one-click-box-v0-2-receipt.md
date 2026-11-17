# MzansiCloud — One-Command Box Installer v0.2 Receipt

Date: 2026-11-17 (Africa/Johannesburg).
Scope: VPS-1 / MzansiCloud engineering repository only. Other nodes intentionally untouched.

## Implemented
- Corporate Private Hosting and Webhosting Business in a Box installation profiles.
- Bash one-command private installer in infra/mzansi-box.sh.
- Installer discovery, dry-run and live health-verification commands.
- Compose package for independent Komodo Mongo/Core/Periphery, existing React/Hono/PostgreSQL, and Technitium DNS.
- Cryptographically generated initial secrets with private config directory and files.
- Fail-closed database configuration adoption; reinstall cannot casually overwrite running database secrets.
- Existing edition/authorization-origin mismatch checks.
- Private default host binds; no automatic public port 80/443, firewall or DNS changes.
- API returns installed edition in authenticated hosting overview; React dashboard displays corresponding edition heading.
- Documentation of acceptance criteria and explicit incomplete commercial gates.

## Verified
- 9 installer input/dry-run tests passed; no installation side effects during tests.
- Hono API TypeScript type-check passed.
- React frontend TypeScript type-check passed.
- 50 backend tests and 50 frontend tests passed.
- New production Docker images built on VPS-1 and its existing API/web containers recreated using preserved PostgreSQL volume and credentials.
- PostgreSQL healthy.
- MZC_EDITION=corporate verified in running VPS-1 Hono container.
- GET /api/health from VPS-1 returned healthy.
- Actual VPS-1 installer 'doctor' and 'verify' commands passed against running app, Komodo and Technitium:
  - http://127.0.0.1:8788/ HTTP 200
  - http://127.0.0.1:8788/api/health HTTP 200
  - http://127.0.0.1:9120/ HTTP 200
  - http://127.0.0.1:5380/ HTTP 200
- Docker Compose configuration syntax validated for all three component stacks.

## Boundaries
- Fresh-server install command is implemented but has NOT been executed and proven on a clean Ubuntu 24.04 VPS. No completed one-click marketplace image is claimed.
- React owner account bootstrap is incomplete. Public registration remains disabled; earlier zero-user state was confirmed.
- Hono hosting records remain DRAFT-only; no real paid customer provisioning.
- MBC Hosting Engine remains preserved but has NOT been integrated into Hono/Komodo production provisioning.
- PayFast and Paystack legacy WordPress plugin files were observed; payment validation, gateway activation and settlement were NOT tested.
- Public DNS, HTTPS, SMTP, product licensing and third-party package redistribution require dedicated review.
- EasyPanel, its Swarm and legacy WordPress/Forgejo services are still on VPS-1 and are NOT decommissioned.
- VPS-1 /dev/vdb XFS block storage contains the Rosetta pilot database without verified full recovery; volume was not touched.

## Engineering continuation
1. Secure first-owner bootstrap and customer-side setup wizard.
2. MBC Hosting Engine API adapter, quotas, tenant creation/suspension and backup restore proof.
3. Komodo integration with scoped privilege and audit trails.
4. Technitium authoritative DNS workflow, zone safety and second nameserver.
5. Merchant verification, HTTPS, backup/restore and fresh-machine one-click acceptance test.
6. Public cutover and only then EasyPanel removal.

This receipt documents a reproducible PRIVATE install baseline, not a finished commercial hosting product.
