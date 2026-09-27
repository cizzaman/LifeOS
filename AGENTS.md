# LifeOS (fork)

Fork of `danielmiessler/LifeOS` (`upstream`). `origin` is `cizzaman/LifeOS`. Installed on Surface from this checkout, not from the upstream release.

## Design

- Follow Personal OS «HYROX - Minimalistic» and its Work modals (`~/Projects/training-health`, read-only): near-monochrome Dark and «Light yellow», hairline panels, 10px radius, 2px tracks; no shadows, gradients, glows or new fonts.
- Type: responsive 11–13px base (`--type-base`); key numbers and page titles are base +7 = 18–20px (`--type-figure`). Numbers use Fira Code, weight 400 and tabular figures; titles use Outfit 500, section headings 15–16px, body Albert Sans 13–15px, mono caps labels 10–11px. Show full text; wrap instead of truncating.
- Colour is allowed only on 7px dimension/category/status keys, a single 1px left category rule on explicitly categorised panels/rows, dimension progress fills/rings and chart marks. Use the existing dimension, data and status tokens. Text, headings, icons, chip/button fills and other panel borders stay neutral. Teal (Dark) / brown (Light yellow) is the shared hover/focus/selection accent, with a faint primary tint; keep the shared 10s `--cycle` for live indicators.
- Tokens and the minimal layer: `LifeOS/install/LIFEOS/PULSE/Observability/src/app/globals.css`; shared primitives: `src/components/ui/chrome.tsx`. Tailwind folds chromatic text/border/ring classes to neutrals; category rules opt in via `Panel dim`. Standalone Work, ISA and Markdown pages follow the same scale.
- Preserve `pulse-theme` (`dark` / `light`) and the pre-paint theme script. Never hardcode colours outside theme tokens. Canvas/graph code resolves tokens with `cssVar()` and redraws on `useTheme()` (`src/lib/theme.ts`).
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

## User data

- The personal LifeOS data lives outside this public fork, in the private repo `cizzaman/lifeos-user`, checked out at `~/.config/LIFEOS/USER` (symlinked as `~/.claude/LIFEOS/USER`). `~/.claude/LIFEOS/MEMORY` is a symlink to `USER/MEMORY`, as in the upstream layout; its `.gitignore` keeps runtime logs, caches and credentials local.
- Never commit anything from the USER tree to this fork. Commit and push USER changes in `~/.config/LIFEOS/USER`.

## Pulse address

- Loopback port: `31337` (permanent, locally and via Tailscale).
- Local URL: `http://127.0.0.1:31337/`
- Tailscale URL: `https://linux-surface.tail5af7c2.ts.net:31337/` (Tailscale Serve on the machine's MagicDNS name; no tag identity, so no `svc:lifeos`).
- Runtime: `com.lifeos.pulse.service` (systemd user unit, linger on). Drop-in `~/.config/systemd/user/com.lifeos.pulse.service.d/path.conf` adds the mise bun path and `LIFEOS_PULSE_EXTRA_HOSTS=linux-surface.tail5af7c2.ts.net` so the host guard accepts the Serve host.
- Publish: `tailscale serve --bg --https=31337 http://127.0.0.1:31337`
- Pulse has no auth. It stays bound to `127.0.0.1`; never set `LIFEOS_PULSE_BIND_ALL=1`.
