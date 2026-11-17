# MzansiCloud Live Domains v0.3 — VPS-1 engineering receipt

Date: 2026-11-17 (Africa/Johannesburg). Scope: VPS-1 only. This receipt reports checked operation, not a commercial product launch.

## Working, verified
- React 19 + Hono application: localhost port 8788, API health HTTP 200.
- Hono read-only live search: GET /api/public/domains/search?domain=...
- VPS-1 observed genuine live registrar-backed results:
  - mzansicloud.co.za => available: false, HTTP 200.
  - mzansicloud-example-nov17-2026-unlikely.co.za => available: true, HTTP 200.
- Response includes source domains.co.za-legacy-bridge and requiresQuote true, without inventing sales prices or reserving names.
- Temporary read-only bridge health HTTP 200; container mzansi-hosting-v0-legacy-domain-bridge-1 healthy, no host port.
- Bridge resides on both the new private app network and the existing WordPress service network; Hono API remains off the WordPress network and connects only to the bridge.
- 54 API automated tests passed; current application source typecheck passed.
- Running React/Caddy bundle contains Live domain availability and Quotation required UI.
- 11 approved MBC Hosting Engine catalogue SKUs available at /api/public/catalog (checkoutEnabled: false).
- Public auth config: googleSignInEnabled false, registrationOpen false. Owner already created and user showed successful dashboard sign-in.
- Installed package smoke checks: 11 installer checks pass, including both editions and default Technitium disabled.
- Public DNS authoritative nameservers remain ns1.dns-h.com, ns2.dns-h.com, ns1.host-h.net, ns2.host-h.net (Xneelo); no DNS, nameserver, MX, or authoritative zone mutations made.

## Architecture of the transitional search
Browser -> Hono API -> private read-only registrar bridge -> existing WordPress Domains.co.za adapter -> Domains.co.za REST API.

The bridge is intentionally temporary, has no public ports and does not expose registrar credentials to browser or Hono. The original WordPress adapter remains necessary for this feature until the native Hono registrar integration has verified private API credentials. Do not remove WordPress/EasyPanel merely because this read path is now operational.

## Deferred or incomplete
- Automatic provisioning via MBC Hosting Engine inactive and not wired to Hono; payment-capture and quota/restore gating remain mandatory.
- Google OAuth configured code path exists but client secrets/callback not yet set; button stays hidden.
- Checkout via PayFast and Paystack not wired to Hono; legacy WordPress plugin presence does not constitute verified payment.
- Domains.co.za managed authoritative DNS migration and Technitium authoritative DNS are final phases, NOT blockers for the hosting application.
- No fresh-server one-click marketplace deploy was executed.
- Rosetta /dev/vdb XFS recovery was NOT touched. VPS-2 to VPS-6 not touched.

## Operator verification from authorized Fedora SSH tunnel
ssh -N -L 8788:127.0.0.1:8788 mbc-vultr-01

Open http://127.0.0.1:8788/dashboard and use Live domain availability.

This is a working live domain-search increment, not a claim of automatic domain registration, paid provisioning, or completion of the commercial hosting business.
