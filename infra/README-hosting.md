# MzansiCloud Private Hosting in a Box

Release v0.2 implements a reproducible **private installation workflow** for the Corporate and Reseller editions. The platform is React 19 + Hono + PostgreSQL, paired with Komodo and Technitium DNS. The MBC Hosting Engine adapter is still an explicit integration gate; provisioning is not yet live.

## Fast start — fresh server only

Requirements: supported Linux host (Ubuntu 24.04 LTS is the target), Docker Engine and Docker Compose v2, curl, openssl, access to container registries and root rights for initial installation.

    sudo bash infra/mzansi-box.sh install --edition corporate

For the white-label webhosting business:

    sudo bash infra/mzansi-box.sh install --edition reseller

Safe preview:

    bash infra/mzansi-box.sh install --edition reseller --dry-run

Verify the stack without changing configuration:

    bash infra/mzansi-box.sh doctor
    bash infra/mzansi-box.sh verify

The installer generates secrets in /etc/mzansicloud-box with strict permissions. It starts PostgreSQL, runs migrations, deploys the web/API, adopts or creates a private Komodo installation, and adopts or creates Technitium DNS.

**Default access is deliberately local only:**
- Application: http://127.0.0.1:8788/
- Komodo: http://127.0.0.1:9120/
- Technitium console: http://127.0.0.1:5380/
- Technitium test resolver: 127.0.0.1:5353 TCP/UDP

Use an authenticated SSH tunnel from an operator workstation. Public TLS and real DNS zone delegation are later verified steps.

## VPS-1 is an existing installation, not a fresh target

The current MzansiCloud instance runs on VPS-1 at /opt/mzansicloud-private-hosting with a different *private secrets path* (/etc/mzansicloud-hosting/production.env). It is dangerous to regenerate credentials for it. The installer therefore **refuses fresh installation over the existing database**. Use doctor/verify only. Existing EasyPanel routes still own ports 80/443, and the Rosetta XFS tenant volume /dev/vdb must be preserved during Vultr storage recovery.

## Remaining production gates

Owner account bootstrap is not implemented in the one-click installer yet: public registration stays disabled. The application creates draft records; it does not yet provision hosting, activate public DNS, collect payments or deliver customer websites. The MBC Hosting Engine, Komodo privileged actions, Technitium authoritative DNS, PayFast/Paystack captures, backups/restore and public HTTPS cutover require verified integrations.

See docs/engineering/one-click-box-deployment.md for the product scope and launch acceptance checklist.

No installer operation may delete a volume, detach block storage, reset a legacy database, replace a public TLS proxy, or open a port on 0.0.0.0 without a separate explicit cutover procedure.
