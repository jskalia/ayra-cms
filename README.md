# ayra-cms

The **Payload CMS** application for the AyraAgent web program — one content backend serving
both sites headlessly ([ayraagentai-web](../ayraagentai-web/) · [heyayraai-web](../heyayraai-web/)).
Admin panel at **`/admin`** on both apex domains via site rewrites; REST at **`/cms-api`**
(namespaced to avoid colliding with the sites' future `/api` routes).

- **Spec source of truth:**
  [tech_stack.md](../../../_sdd/_about/About%20Ayra%20Agent/tech_stack.md) (CMS section +
  required-pieces checklist) · [status ledger](../../../_sdd/_about/About%20Ayra%20Agent/status.md) item 2.6.
- **Stack:** Next.js (CMS server shell only — the sites themselves are Vite) + Payload 3 +
  Postgres (Vercel-integrated Neon) + Vercel Blob (media) + `@payloadcms/plugin-mcp` (opt-in
  via `PAYLOAD_MCP_ENABLED=1`). Pattern proven by
  [slai-web](../../../_code/SaveLifeAI/slai-web/).
- **Collections:** Users (roles) · Posts (drafts + published-only public read) · Categories ·
  Authors · Media (Blob, sized images via sharp).

## Rules (binding)

1. **Schema push is opt-in** — `PAYLOAD_PUSH_SCHEMA=1` only, never on ordinary deploys
   (slai-web outage lesson). Move to real migrations when the model stabilizes.
2. **One database, one Blob store, one bill** — created through Vercel's Storage tab only;
   never a direct neon.tech signup ([platform rule](../../../_sdd/_about/About%20Ayra%20Agent/tech_stack.md)).
3. Schema is TypeScript in git — `payload.config.ts` and `src/collections/*` are the content
   model of record; regenerate `payload-types.ts` after model changes.
4. Public access is narrow by default: only published `posts`, `categories`, `authors`,
   `media` are publicly readable over `/cms-api`; everything else requires an authenticated
   user.
5. The AyraAgent application lives on bDevMain — this repo never touches it.
