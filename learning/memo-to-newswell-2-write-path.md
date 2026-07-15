# Memo 2: the write path — a CORS finding, and what we'd need to push templates

**To:** the NewsWell Studio team
**From:** the annotator side — [github.com/ejfox/annotator](https://github.com/ejfox/annotator)
**Re:** `POST /api/templates`, auth for machine clients, and one thing that's currently impossible
**Date:** 2026-07-15
**Follows:** [memo 1](memo-to-newswell.md) (templates, matcher, public GET)

---

## TL;DR

1. There's **no API-key concept** in the codebase. Auth is a signed session cookie, mintable only via `POST /api/auth/login` with username + password.
2. **`Access-Control-Allow-Origin: *` is spec-incompatible with `credentials: 'include'`.** So *no* cross-origin browser client can authenticate to Studio as currently configured — regardless of who holds the password. That's categorical, not a permissions problem.
3. Public **GET** is unaffected and still the right ask (anonymous requests are exactly what `*` is for).
4. To ever push a template from another origin you need to pick one of three paths. We have a favourite, and it's probably the one you already want for other reasons.

---

## The finding

Studio answers `/api/templates` with:

```
HTTP/2 401
access-control-allow-origin: *
access-control-allow-methods: *
access-control-allow-headers: *
```

That wildcard **looks** maximally permissive. It is — but only for *anonymous* requests. The Fetch spec forbids `*` when a request carries credentials: the response must echo the **exact** origin and add `Access-Control-Allow-Credentials: true`. Studio does neither.

Meanwhile `isAuthenticated()` (`server/utils/auth.ts`) only reads a **cookie**:

```ts
const token = getCookie(event, COOKIE_NAME)
if (!token) return false
return verifyToken(token, config.secret) !== null
```

Put those together and the conclusion is stronger than "we need a password":

> **A browser client on any other origin cannot make an authenticated request to Studio today.** The cookie can't legally ride a wildcard-CORS request, so the browser blocks it before it leaves. No credential fixes this.

Worth stating plainly because it's easy to miss — the config that makes public reads trivial is the same config that makes credentialed writes unreachable.

## Three ways out

**1. Same-origin — our favourite, and probably yours.**
The annotator becomes a route inside Studio. Cookie auth just works, CORS stops existing, and "annotate a page" and "author a template" become the same screen instead of two apps trading JSON. This finding is a real argument for folding it in rather than maintaining a cousin app. Biggest change, best end state.

**2. A token path for machine clients.**
Accept `Authorization: Bearer <token>` alongside the cookie. `*` stays valid (a bearer header isn't "credentials" in the CORS sense, so no origin allowlist to maintain), and you get something you'll want regardless: **CI, scripts, and backups can talk to the API.** Right now nothing non-browser can.

**3. Origin echo + `Allow-Credentials: true`.**
Works, smallest diff, but you inherit an origin allowlist to keep in sync forever, and it only helps browsers.

We'd rank **2 for now, 1 eventually**. 3 solves the least for the most ongoing cost.

## The endpoint we'd want

Independent of auth: **`POST /api/templates` — append one template.**

```ts
// POST /api/templates  → 201 { template }
// Appends a single PageTemplate. Race-free, unlike PUT.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ template: unknown }>(event)
  // validate minimally, assign id/createdAt server-side, append, return the row
})
```

Why not just use the existing PUT: it **replaces the entire library, last-write-wins** — your own docstring flags that as an accepted-for-now compromise. That's fine for one human in the admin. It is not fine for a second client: a `GET → append → PUT` from us will silently eat any template someone saved in between. We're not willing to ship that, which is why our "send page as template" button currently just downloads a one-template library file for manual import.

An append endpoint also makes the last-write-wins problem *smaller* for you generally, since the common case (add one) stops needing a full-array write.

## What we're doing in the meantime

- **Download → import.** The button builds a valid `PageTemplate` (infers `cover`/`ad`/`ad-editorial`, carries `role` + `requiresPhoto`/`imageLayout`/`imageRatio`) and hands you a one-template library file. Zero auth, works today, no risk to the shared set.
- **Locally**, our dev server can log in server-side using env credentials and proxy writes — no CORS, no secret in a browser. That's a local convenience, not a product answer, and not something we'd ship.

## Still standing from memo 1

- **The PUT has no auth guard of its own** and `PUBLIC_ROUTES` matches by prefix — so the first person to make the library readable makes it internet-writable. Please give the PUT its own `isAuthenticated()` check regardless of what else you decide. This is the one item we'd call urgent.
- **No CI runs vitest.** `deploy-studio.yml` and `release.yml` never invoke it, so the 8 tests that shipped with [#142](https://github.com/ejfox/newswell/pull/142) only run if someone types `npm test`. Merging to `main` deploys straight to production Azure with no test gate.

## Summary of asks

| ask | size | why |
|---|---|---|
| `isAuthenticated()` guard on the templates PUT | tiny | closes a live foot-gun, independent of us |
| method-aware public `GET /api/templates` | small | lets any client read the library; CORS already allows it |
| `POST /api/templates` (append one) | small | race-free writes; shrinks last-write-wins for everyone |
| a Bearer/token auth path | medium | the only way a non-browser or cross-origin client can ever write; unlocks CI + scripts too |
