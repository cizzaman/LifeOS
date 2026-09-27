# LifeOS (fork)

Fork of `danielmiessler/LifeOS` (`upstream`). `origin` is `cizzaman/LifeOS`. Installed on Surface from this checkout, not from the upstream release.

## Design

- Pulse and the other LifeOS HTML surfaces use the minimal Work-modal design from Personal OS (`~/Projects/training-health`, `personal_os/web/theme.css` + the `work-goals-vision` rules in `app.css`): charcoal ground, cream ink, one teal accent, hairline borders, Fira Code caps labels, Outfit display, Albert Sans text, 7px markers, one shared 10 s `--cycle`.
- Tokens live in `LifeOS/install/LIFEOS/PULSE/Observability/src/app/globals.css`; primitives in `src/components/ui/chrome.tsx`. Color only in small markers, underlines and tracks — never whole headlines.
- After merging upstream, re-apply the palette: `python3 LifeOS/install/LIFEOS/PULSE/Observability/scripts/remap-palette.py LifeOS/install/LIFEOS/PULSE/Observability/src LifeOS/install/LIFEOS/TOOLS/ISARender/template.css`.

## Commands

```bash
# Build Pulse and deploy it to the installed runtime
cd LifeOS/install/LIFEOS/PULSE/Observability && bun install && bun run build
rsync -a --delete out/ ~/.claude/LIFEOS/PULSE/Observability/out/

# Sync the installed skill payload with this checkout
rsync -a --delete --exclude node_modules --exclude .next LifeOS/ ~/.claude/skills/LifeOS/

# Service
systemctl --user restart com.lifeos.pulse.service
bun ~/.claude/LIFEOS/TOOLS/Doctor.ts
```

## Pulse address

- Loopback port: `31337` (permanent, locally and via Tailscale).
- Local URL: `http://127.0.0.1:31337/`
- Tailscale URL: `https://linux-surface.tail5af7c2.ts.net:31337/` (Tailscale Serve on the machine's MagicDNS name; no tag identity, so no `svc:lifeos`).
- Runtime: `com.lifeos.pulse.service` (systemd user unit, linger on). Drop-in `~/.config/systemd/user/com.lifeos.pulse.service.d/path.conf` adds the mise bun path and `LIFEOS_PULSE_EXTRA_HOSTS=linux-surface.tail5af7c2.ts.net` so the host guard accepts the Serve host.
- Publish: `tailscale serve --bg --https=31337 http://127.0.0.1:31337`
- Pulse has no auth. It stays bound to `127.0.0.1`; never set `LIFEOS_PULSE_BIND_ALL=1`.
