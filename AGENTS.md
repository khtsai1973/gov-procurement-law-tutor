# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 15 (App Router) + Prisma + PostgreSQL app (`gov-procurement-law-tutor`),
a Traditional-Chinese government-procurement-law tutor (RAG Q&A chatbot + mock-exam system).
Standard commands live in `README.md` and `package.json` scripts — reference those; only the
non-obvious cloud caveats are captured here.

### Services

- Next.js dev server: `npm run dev` → http://localhost:3000 (Turbopack).
- PostgreSQL 16: installed natively (not Docker). The repo's `.ps1` helper scripts are Windows-only;
  on this Linux VM use the `npm run ...` equivalents.

### Postgres is not auto-started on boot
Postgres does not start automatically in this VM. Start it at the beginning of a session with:

```
sudo pg_ctlcluster 16 main start
```

Connection string (already in `.env`): `postgresql://postgres:postgres@localhost:5432/gov_procurement`.
The database data and the `.env` file persist in the VM snapshot (`.env` is gitignored, so it is not
in the repo — do not delete it). If the DB is ever empty, re-seed with `npm run db:init` (generate +
push + seed; the seed also ingests the corpus and imports the ~900-item question bank).

### OpenAI is optional and disabled by default
`.env` sets `OPENAI_DISABLED="true"` and an empty `OPENAI_API_KEY`. The chatbot then answers with
knowledge-base excerpts only (no embeddings; RAG runs in keyword mode). This is expected — everything
works without an OpenAI key. To enable semantic RAG, set a real `OPENAI_API_KEY` and
`OPENAI_DISABLED="false"`, then run `npm run corpus:rag-init` to build embeddings.

### The whole app is Google-OAuth gated — how to log in without real Google credentials
Every core feature (chat Q&A, mock exam, teacher tools) requires a signed-in user. `.env` has
placeholder Google OAuth values, so the real Google login flow will not work in this environment.
To exercise authenticated features, forge a valid NextAuth (Auth.js v5, JWT session strategy)
session cookie for a seeded user — no code changes required.

1. Create a user row and print a signed session cookie. Save this as a temporary script in the repo
   root (module resolution fails from `/tmp`) and run it, then delete it:

```js
// tmp-mksession.mjs
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
const prisma = new PrismaClient();
const email = "admin@example.com"; // matches ADMIN_EMAILS in .env
const user = await prisma.user.upsert({
  where: { email },
  update: { role: "ADMIN", name: "測試管理員" },
  create: { email, name: "測試管理員", role: "ADMIN", emailVerified: new Date() },
});
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
const token = await encode({
  token: { sub: user.id, email, name: user.name, role: user.role },
  secret,
  salt: "authjs.session-token", // cookie name == salt (dev/http)
  maxAge: 30 * 24 * 60 * 60,
});
console.log("COOKIE=" + token);
await prisma.$disconnect();
```

Run with: `node --env-file=.env ./node_modules/.bin/tsx ./tmp-mksession.mjs`

2. Use the printed token as the `authjs.session-token` cookie:
   - API: `curl -H "Cookie: authjs.session-token=<TOKEN>" ...`
   - Browser: open DevTools console on http://localhost:3000 and run
     `document.cookie = "authjs.session-token=<TOKEN>; path=/"`, then reload.

The dev/http cookie name is `authjs.session-token` (would be `__Secure-authjs.session-token` over
HTTPS). `ADMIN_EMAILS` / `TEACHER_EMAILS` in `.env` control the role assigned on login.

### Lint / test / build
- Lint: `npm run lint` (Next.js ESLint; prints a deprecation notice, still works).
- Tests: there is no test runner script. The `src/lib/*.test.ts` files are plain assertion scripts —
  run individually, e.g. `node --env-file=.env ./node_modules/.bin/tsx src/lib/mock-exam.test.ts`.
- Build: `npm run build` (runs `prisma generate && next build`).
