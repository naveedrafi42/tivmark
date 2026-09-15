# PitchCentric local demo

## Architecture

Prospective podcast guests share a website, shape a private profile and see relevant shows before signup. The host is Tivmark's existing Next.js Pages Router at http://localhost:4002. `apps/assistant/src/pitchcentric-server.ts` owns the MCP tools and inline cards. `noodle dev` runs separately on port 4011. The managed Noodle renderer owns conversational turns, streaming, errors, confirmations and linked Apps. A public mixed surface allowlists only PitchCentric tools; no enterprise workspace privileges are exposed. The local operator owns the OpenAI-compatible assistant model configuration.

The host chooses routing. Browser input cannot choose an MCP URL or caller key. Noodle caller-scoped state expires after 24 hours and opts into verified authentication adoption. The credential-free local guided adapter uses an HTTP-only, SameSite cookie with an unguessable state key; it is explicitly loopback-only and disabled unless PITCHCENTRIC_LOCAL_DEMO=true. It is not a production authentication service.

The existing PitchCentric prototype supplied the profile contracts, transition logic, fictional scenarios and brand assets. Tivmark supplied the Next.js shell, managed assistant, inline-view patterns and account-continuation architecture. The production Tivmark enterprise entrypoint remains separate. The homepage and dedicated PitchCentric journey have no upfront account gate.

## Modes and configuration

- Guided fallback: real local MCP calls and state, fixed prompts, synthetic company/social/media data, fictional podcasts, simulated account creation. No model or identity credentials required.
- Conversational mode: set NEXT_PUBLIC_PITCHCENTRIC_EMBED_ID and NEXT_PUBLIC_PITCHCENTRIC_SERVICE_URL to the local Noodle dev output. Configure ASSISTANT_MODEL_BASE_URL, ASSISTANT_MODEL, ASSISTANT_MODEL_API_KEY securely in the assistant runtime. These secrets must never use NEXT_PUBLIC names. The browser mounts the managed Noodle assistant; the model chooses the shared tools. No scripted responses run in this mode.
- Research: fixture adapters in pitchcentric-onboarding-runtime.ts. Unknown URLs and names return no results. Replace enrichment and discovery separately with reviewed providers. Tivmark's Gemini URL-context research offers a pattern for cited company suggestions but is not social discovery. Noodle knowledge-site crawling supports declared sites, not arbitrary visitor URL research. No arbitrary URL is fetched by this demo.
- Podcast inventory: fictional catalog, topic-ranked with explicit fit explanations and low-fit caveats. Replace with licensed podcast data; demo scores are not booking probabilities.
- Signup: Google and email/password choices are simulations and do not collect credentials. Production requires Google OAuth credentials/callbacks or the existing Tivmark email/password account service, database configuration, and server-bound Noodle ticket elevation. No real account is created by this demo.

Use https://brightwave.example, Alex Morgan, Brightwave for the fictional identity-confirmation path. The reserved .example links are intentionally not real accounts. Other people have no mock identity candidates. Company facts never populate a person's role or biography. Changes invalidate matches and pending signup; review again to regenerate them. The same draft and matches survive simulated signup and browser reload while the runtime retains state. A service restart can expire local anonymous state; this is not permanent account storage.

## Run

From the task checkout:

```sh
npm ci
npm --prefix apps/assistant ci
# terminal 1
cd apps/assistant
npx noodle dev src/pitchcentric-local-server.ts --org local --app pitchcentric --port 4011 --no-preview
# terminal 2, repository root
PITCHCENTRIC_LOCAL_DEMO=true APP_URL=http://localhost:4002 npm run dev:web
# optional Noodle tool/card inspector
cd apps/assistant
npx noodle devtools src/pitchcentric-local-server.ts --port 4010 --headless
```

Open http://localhost:4002. Research and identity providers should later use bounded background jobs with source provenance, cancellation and revision checks, following Tivmark's research pattern. Only reviewed suggestions may update a profile. Never promote fictional content or a guessed social profile to verified evidence.

## Brand provenance

Reference: https://pitchcentric.com/ inspected 2026-09-15. Local assets reused from the supplied PitchCentric prototype: original logo and microphone, Jost headings, Inter body. Lime #B0D641, turquoise #65C7C5, dark green #192320. Brand assets remain their owners' property. No runtime asset request is made to the reference site.

## Integration details and limitations

The conversational entrypoint is `src/pitchcentric-server.ts`; it requires model configuration. The credential-free entrypoint `src/pitchcentric-local-server.ts` shares its tools/cards and omits the assistant model declaration. Tool calls prepare proposals; `save_guest_draft` is the only confirmed state mutation. This follows Noodle's stateful-draft pattern and avoids an unsupported confirmed read/compute/conditional-write flow. The guided host passes only the exact server-generated proposal into that save, using a submitted form as its explicit local approval. The managed conversational renderer supplies its own confirmation UI. Inline edits send corrections through the assistant and create a new reviewed card.

Only the local demo flag changes Tivmark's root homepage; the existing production auth homepage remains the default. Set PITCHCENTRIC_DEMO_ENABLED=true only when deliberately enabling the branded homepage elsewhere. No hosted deployment or real identity configuration was performed.

Anonymous state is caller-scoped with a 24-hour TTL. Browser reload is tested in the guided adapter using its HTTP-only cookie. Noodle's public continuity restores bounded conversation text, not old authority; full live reload and real signup adoption need verification with the configured assistant and identity service. Do not promise cross-device or permanent persistence.

The current company fixture completes as a bounded MCP operation with a visible loading state. A live background research worker, source citations from a provider and social discovery credentials remain integrations to add; the existing Tivmark enterprise worker is not invoked for anonymous visitors.

## Local validation

- Web: production build, TypeScript, lint, Prettier and 167 unit tests passed.
- Assistant: 126 tests passed before the final cancellation case; the focused PitchCentric suite now has 15 passing cases.
- Noodle: both entrypoints validate; embedded-assistant compatibility check passes. Remaining warnings concern the parent Tivmark project name, public privacy disclosure and real customer auth, which are not configured for this local simulation.
- Noodle DevTools: synthetic company research and its inline editable card rendered, including the 390px mobile preview.
- `node scripts/test-pitchcentric.mjs` exercises the actual loopback host/MCP/state boundary with synthetic visitors, both signup choices, stale edits, unknown research, wrong origins and cookie isolation. It deliberately paces calls under the local MCP request limit.

The schema records a private draft. A proposal is not persisted until `save_guest_draft` succeeds. Successful save receipts set `write:false` so the assistant never loops saving the same proposal. Real authentication must replace the simulated account marker; an app-only visibility hint is not an authorization boundary.
