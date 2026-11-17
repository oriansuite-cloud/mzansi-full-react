# MzansiCloud — One-Click Business in a Box

**Product commitment:** Software purchased outright under the applicable written licence. Customers control infrastructure, domains, access, data and backups. Optional managed service is a separate agreement. No mandatory EasyPanel subscription.

## Two editions, same owned platform

| Capability | Webhosting Business in a Box | Corporate Private Hosting in a Box |
|---|---|---|
| Target | White-label reseller hosting business | Customer-owned private hosting |
| Accounts | Reseller and customer workspaces | Corporate admins and invited teams |
| Runtime | Tenant hosting, Node, Python, static, WordPress | Public websites and private business applications |
| DNS | Authoritative public zones after delegation | Public plus internal split-horizon zones |
| Payments | PayFast/Paystack after merchant setup | Contract billing or optional payments |
| Provisioning | MBC Hosting Engine | MBC Hosting Engine |
| Control | Komodo | Komodo |

## One-command private bootstrap — implemented in v0.2

On a fresh supported Linux server with Docker Engine and Docker Compose v2 installed, unpack the release source and execute:

    sudo bash infra/mzansi-box.sh install --edition reseller

Or use --edition corporate. Installer flow:

1. Verify installed prerequisites, protected storage and the private configuration directory.
2. Generate strong database and authentication secrets under /etc/mzansicloud-box with strict file permissions.
3. Create PostgreSQL, run Drizzle migrations, build and start React 19 + Hono.
4. Start Komodo (Mongo, Core and Periphery) unless already running.
5. Start Technitium DNS unless already running.
6. Check live web/API/Komodo/DNS HTTP responses.
7. Restrict web, Komodo, DNS console and test DNS listeners to 127.0.0.1; public deployment is separate.

Check or preview:

    bash infra/mzansi-box.sh doctor
    bash infra/mzansi-box.sh verify
    bash infra/mzansi-box.sh install --edition corporate --dry-run
    bash infra/test-mzansi-box.sh

### VPS-1 policy

VPS-1 already has the application, Komodo and Technitium running with existing private configurations. The installer verifies their health. It intentionally refuses to create replacement database secrets over an existing installation. **Do not use fresh install mode on VPS-1.** Do not detach, format or delete its XFS /dev/vdb tenant volume: Rosetta MariaDB recovery remains incomplete.

## Customer-facing one-click release gates — not yet delivered

- First-owner secure bootstrap and one-time recovery credentials; registration stays closed to the public.
- Setup wizard for business identity, edition, tenant policies, domain ownership and TLS.
- Verified licence/entitlement terms and third-party redistribution audit (including Komodo and MongoDB dependencies).
- MBC Hosting Engine provisioning, quotas, suspend/resume, payment capture evidence, backups and isolated restore tests.
- Narrow, auditable Komodo API integration; do not expose Periphery or the Docker socket to customers.
- Technitium authoritative zone API, public/internal split-horizon design and secondary DNS.
- Verified PayFast/Paystack merchant integration, idempotent payment capture and guarded fulfilment; old WordPress plugin files do not prove live integration.
- Public HTTPS cutover, Cloud Firewall review, monitoring and recovery procedures.
- Fresh Ubuntu 24.04 install test, upgrade/rollback test and reproducible marketplace image.

**Important:** One-click installation does not remove domain ownership, payment merchant verification or external service contract requirements.

**Status:** Private installation script and automated service verification exist. A completed one-click commercial marketplace installer does not yet exist.
