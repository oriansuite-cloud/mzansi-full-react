# MzansiCloud DNS cutover preflight — VPS-1 only (2026-11-17)

**State: private Technitium DNS is running, public authoritative delegation is NOT changed.**

## Public authoritative baseline, directly verified from DNS queries

| Record | Current observed value |
|---|---|
| mzansicloud.co.za NS | ns1.dns-h.com, ns2.dns-h.com, ns1.host-h.net, ns2.host-h.net |
| mzansicloud.co.za SOA | ns1.host-h.net, serial 2026111601 |
| mzansicloud.co.za A | 95.179.201.105 (VPS-1) |
| www.mzansicloud.co.za A | 95.179.201.105 |
| panel.mzansicloud.co.za A | 95.179.201.105 |
| git.mzansicloud.co.za A | 95.179.201.105 |
| api.mzansicloud.co.za A | 95.179.201.105 |
| my.mzansicloud.co.za A | 95.179.201.105 |
| admin.mzansicloud.co.za A | 95.179.201.105 |
| mzansicloud.co.za MX | 10 mail.mzansicloud.co.za |
| mail.mzansicloud.co.za A | 196.40.97.157 |
| mzansicloud.co.za TXT | v=spf1 mx a include:spf.host-h.net ?all |
| _dmarc.mzansicloud.co.za TXT | v=DMARC1; p=none; rua=mailto:postmaster@mzansicloud.co.za; adkim=r; aspf=r; fo=0 |
| mzansicloud.co.za DS | No DS response observed |

This inventory is **NOT an exhaustive zone export**. Unknown records such as wildcard, DKIM selectors, SRV, AAAA, CNAME, ownership challenges, additional TXT, and TXT-based provider verification can exist. Do not assume absent records from limited discovery. Full zone export from the currently authoritative DNS provider must be obtained before migration.

## Technitium staging

- Running: official Technitium DNS server container on VPS-1.
- Console: http://127.0.0.1:5380/ (loopback only).
- DNS test listener: 127.0.0.1:5353 TCP/UDP.
- Existing public port 53 is NOT opened for authoritative traffic, and DNS is NOT delegated to Technitium.
- Do not create an incomplete mzansicloud.co.za authority zone and point production resolvers at it; it could blackhole uncopied records.
- A Technitium API helper can create and export a private testing zone after trusted administrator login. Keep API tokens and passwords off Git and terminal logs.

## Gated cutover stages

1. **Complete source zone backup:** export all host records, TXT/SPF/DKIM/DMARC, MX, CAA, SRV, NS, glue, TTLs, DNSSEC DS and validation records from the current authoritative DNS provider. Record a checksum and safe storage location.
2. **Prepare Technitium primary + secondary:** at least two publicly reachable authoritative nameservers on independent failure domains, with properly restricted management access. VPS-2 through VPS-6 are not available for this project without their assigned operators' approval.
3. **Mirror and verify:** import the complete original zone, query each Technitium authority directly, compare type, name, value and TTL against source, verify DNSSEC and mail deliverability.
4. **Small cutover first:** preferably delegate a dedicated non-mail subzone (e.g. hosting.mzansicloud.co.za) as a pilot, after establishing secondary NS and verifying DNSSEC/glue as applicable.
5. **Parent-domain delegation only after all gates:** update registrars with authoritative NS, monitor authoritative answers from geographically distinct resolvers, SMTP/IMAP, all websites, payment callbacks, OAuth and certificate renewals. Keep original records and rollback available.
6. **Rollback:** on failed checks, restore original NS ns1.dns-h.com, ns2.dns-h.com, ns1.host-h.net, ns2.host-h.net and the original provider records; expect TTL/cache delays, particularly the existing SOA settings. Do not remove the old DNS provider prematurely.

## Why public delegation was not changed

VPS-1 contains live mail, website, admin and payment routing dependencies; the Technitium instance currently binds only to loopback and has no confirmed secondary authority. Replacing four external nameservers with a single non-public listener would cause an outage. This is an engineering hold, not a decision to keep EasyPanel as the permanent control plane.

## Independent integrations

- Domains.co.za **registrar domain availability** is separate from authoritative DNS management.
- The Hono API has a live registrar search integration, temporarily using a read-only WordPress-based bridge pending server-side migration of registrar credentials.
- Google OAuth callback must use the actual HTTPS origin following proxy cutover.
- Technitium API automation must enforce scoped credentials, zone ownership and audit trails.

**No externally visible DNS change is claimed by this document.**
