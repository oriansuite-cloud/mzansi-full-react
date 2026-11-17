# MzansiCloud DNS Zone Composer v0.4 — VPS-1 engineering receipt

Date: 17 November 2026, Africa/Johannesburg. Scope: MzansiCloud VPS-1 only.

## User-directed architecture

- Domains.co.za Premium DNS is the public authoritative destination for customer DNS.
- The MBC Hosting Engine is the intended durable paid provisioning orchestrator; no n8n-style system may bypass its payment evidence, idempotency, tenant ownership, transaction state or audit.
- Technitium is an OPTIONAL later internal-DNS capability, not the public authority.
- The main mzansicloud.co.za domain remains with existing Xneelo nameservers until a verified later migration.
- Mail VPS and additional VPS nodes are managed by other operatives and WERE NOT touched.

## DNS provider contract verified

User supplied Domains_API.postman_collection.json, supported by official Domains.co.za API documentation. Relevant endpoints:
- GET /domain/dns?sld=...&tld=... => intReturnCode=1, arrRecords[id,type,name,content,ttl,prio].
- POST /domain/dns/entry => individual DNS addition; NOT invoked.
- PUT/DELETE /domain/dns/entry?dnsId=... => mutation methods; NOT implemented.
- POST /domain/dns append=false => can replace the whole zone; NEVER used.
- POST /domain/ns?dns=managed => changes delegation; NOT invoked.
- Login and billing operations must remain outside browser and must not be logged.

Code: apps/api/src/lib/dns-zone.ts, apps/api/src/lib/domains-premium-dns.ts, and authenticated API routes /api/hosting/dns/*.

## Pilot zone (live public evidence)

Zone: mzansibusinessmail.co.za, observed address 45.63.3.207.
All four Domains.co.za authoritative servers ns1.tld-ns.com, ns2.tld-ns.net, ns3.tld-ns.com, ns4.tld-ns.net consistently returned:
- @ A 45.63.3.207, TTL 3600
- mail A 45.63.3.207, TTL 3600
- @ MX priority 0 mail.mzansibusinessmail.co.za, TTL 3600
Public resolvers 1.1.1.1, 8.8.8.8 and 9.9.9.9 agreed.
- Apex TXT and _dmarc TXT were not returned at verification time.
- The default DKIM selector was checked and not returned. A differently named selector remains possible.
- WHOIS/registrar transfer COMPLETION and live mail service readiness were NOT verified by these DNS responses.

Pilot fixture: docs/engineering/mzansibusinessmail-dns-pilot.json.
Pilot deterministic output: docs/engineering/mzansibusinessmail-dns-draft-preview.json.
Pilot digest: f7f967761245bf326451797e9242acd23af29ad64dcfa670491cb5659aad9863.
Diff: 3 unchanged, 0 additions, 0 blocked, 0 conflicts, 3 warnings (SPF, DMARC, DKIM).
Never invent a DKIM public key, SPF sending address or active mail service based solely on the A/MX values.

## New DNS engineering functionality

- Typed, deterministic and strict DNS Zone Composer, source-scoped records and valid TTL/priority/domain checks.
- Fail-closed protection against private DKIM key material, duplicate SPF, CNAME collisions, DKIM rollover conflicts, source ownership violations and unverified publication.
- SHA-256 plan digest. Generates non-destructive additions versus an explicitly unverified caller-supplied record baseline; original records remain preserved.
- Read-only Domains.co.za Premium DNS zone REST adapter; requires a private bearer token for verified provider snapshots.
- Safe mapping preview for POST /domain/dns/entry. No actual provider DNS mutation functions shipped.
- Authenticated POST /api/hosting/dns/compose (preview only).
- Authenticated POST /api/hosting/dns/drafts and GET /api/hosting/dns/drafts, GET /api/hosting/dns/drafts/:id.
- Authenticated GET /api/hosting/dns/provider-zone (read-only, unavailable without private token).
- Tenant ownership checks, deduplicated PostgreSQL draft storage and DNS draft creation audit.
- One additive migration: apps/api/drizzle/0004_good_malice.sql with tables hosting_dns_draft and hosting_dns_audit; no destructive SQL.

## Verified in test and live VPS-1

- 13 new DNS-specific tests and 67 total API tests PASS.
- API TypeScript type-check PASS.
- Pre-migration PostgreSQL custom-format dump saved at /root/mzansicloud-backups/mzansi-hono-before-dns-v0-4-20261117.dump (42,188 bytes; mode 0600; SHA-256 c035e62322f679f14392d1433a6ec4187d405776cf3f9bd8cbf7c40ab77e35f5).
- Dump listing integrity checked using pg_restore --list. This is a backup of the React/Hono DB, NOT Rosetta.
- Additive migration applied successfully. Both DNS tables verified to exist, 0 drafts before user/operator creation.
- API rebuilt and recreated on VPS-1 without recreating PostgreSQL or touching WordPress/EasyPanel/Forgejo/Rosetta.
- HTTP 200 /, /api/health, /api/public/catalog, /api/public/domains/search?domain=mzansibusinessmail.co.za.
- Registrar search still returns available=false through the restricted legacy Domains.co.za bridge.
- No public signup; DNS composition unauthenticated POST returned HTTP 401.
- No DNS publish route exists. No public DNS records or delegation changed.

## Publication and orchestration gates NOT complete

1. MBC Hosting Engine needs to own the durable production job state and accept payment/tenant entitlement evidence; Hono DNS drafts are NOT themselves provisioned services.
2. Mail VPS must return authenticated public DKIM, SPF sending policy, MX and DMARC configuration. DKIM private keys never leave Mail VPS.
3. Hosting VPS must return authenticated A/AAAA/CNAME/service verification evidence.
4. Domains.co.za API owner token must be configured in private server environment for GET /domain/dns; no secret belongs in Git or browser.
5. Complete authoritative provider snapshot, drift checks, scoped mutation approval, idempotent per-record updates, audit receipts and authoritative verification must pass before publication.
6. Public nameserver change on mzansicloud.co.za remains a separate later migration.
7. Future publication workflow must never use append=false to rewrite a customer zone without complete verified snapshot and explicit approval.

**Status: deployed functioning DNS draft engineering baseline. Not automatic DNS publication or live merchant provisioning.**
