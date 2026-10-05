# Pulse widgets

## AI-grenser på iPhone (`AiLimits.js`)

Viser Claude (5t og 7d) og Codex (ukesvindu) fra Pulse `GET /api/usage/limits`, med prosent, stolpe og tid til reset. Samme idé som CodexBar på Mac, men dataene kommer fra Surface der agentene kjører. Ingen tokens ligger på telefonen.

**Krav:** iPhone på tailnet (Tailscale-appen på) og appen [Scriptable](https://apps.apple.com/app/scriptable/id1405459188).

1. Kopier innholdet i `AiLimits.js` til et nytt skript i Scriptable. Kall det `AI-grenser`.
2. Hjemskjerm: legg til en Scriptable-widget (liten eller medium). Velg skriptet `AI-grenser`.
3. Låseskjerm: legg til Scriptable som rektangulær widget med samme skript.
4. Annen Pulse-adresse: skriv den i widgetens `Parameter`-felt.

**Datakilder** (lest av `modules/usage.ts`):

- Claude: `~/.claude/LIFEOS/MEMORY/STATE/usage-cache.json`, oppdatert av `UpdateCounts`-hooken.
- Codex: siste `rate_limits` i nyeste `~/.codex/sessions/**/*.jsonl`, skrevet av Codex CLI per tur.

Tallene er like ferske som siste Claude- eller Codex-økt på Surface. iOS bestemmer selv hvor ofte widgeten oppdateres (typisk 15 til 30 min).
