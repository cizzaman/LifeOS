# LifeOS (fork)

Fork of `danielmiessler/LifeOS` (`upstream`). `origin` is `cizzaman/LifeOS`. Installed on Surface from this checkout, not from the upstream release.

## Design

- Pulse and the other LifeOS HTML surfaces follow Personal OS «HYROX - Minimalistic» (`/hyrox-minimalistic/`) and the Work modals (`~/Projects/training-health`, `personal_os/web/theme.css`, `html[data-hyrox-style="minimalistic"]` and `#workGoalModal` rules in `app.css`): near-monochrome, charcoal ground, cream ink, transparent panels drawn by a 1px `--line-3`, Fira Code 10px caps labels, mono numbers, Outfit titles, Albert Sans text, 7px outlined keys, 2px tracks, 10px radius, no shadows or gradients, one shared 10 s `--cycle`.
- Colour belongs to data only: chart series, 7px status keys (ok/warn/err) and progress fills. Text, borders, icons, chips and card backgrounds are never coloured; teal marks only hover, focus and the selected item. One series or one bar is teal.
- Tokens and the minimal layer live in `LifeOS/install/LIFEOS/PULSE/Observability/src/app/globals.css`; primitives in `src/components/ui/chrome.tsx`. `tailwind.config.ts` folds every chromatic `text-*`/`border-*`/`ring-*` class to greys as a safety net.
- Two themes, as in Personal OS: «Dark» (default) and «Light yellow» (`html[data-theme="light"]`, the values of training-health `theme.css` `light`: paper `#faf9f5`, cream panels and modals `#fff7ed`, tan lines, brown accent `#9a5800`). The header swatches (`src/components/ThemeSwitch.tsx`) store the choice in localStorage `pulse-theme`; `src/lib/theme-script.ts` applies it before paint. Pages outside the Next app read the same key. Never hardcode a colour: use the tokens, and have canvas/graph code resolve them with `cssVar()` and redraw on `useTheme()` (`src/lib/theme.ts`).
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
