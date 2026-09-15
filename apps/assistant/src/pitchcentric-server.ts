import {
  annotations,
  connector,
  server,
  tool,
  z,
  embeddedAssistant,
  publicWebsite,
  openAICompatible,
  secret,
  variable,
} from "@noodleseed/one";
import { transition, gateCommit } from "./pitchcentric-onboarding-runtime.js";

const text = z.string().trim().min(1).max(600);
const url = z
  .string()
  .url()
  .max(2000)
  .refine((v) => v.startsWith("https://"), "Use an HTTPS URL");
const profile = z.object({
  name: text.optional(),
  companyName: text.optional(),
  companyUrl: url.optional(),
  expertise: text.optional(),
  experience: text.optional(),
  mediaNotes: z.string().max(600).optional(),
  role: text.optional(),
  bio: text.optional(),
  tagline: text.optional(),
  city: text.optional(),
  workHistory: z
    .array(
      z.object({
        company: text,
        role: text,
        website: url.optional(),
        startYear: z.number().int().min(1900).max(2100).optional(),
        endYear: z.number().int().min(1900).max(2100).optional(),
      }),
    )
    .max(20)
    .optional(),
  achievements: z.array(text).max(10).optional(),
  photoUrl: url.optional(),
  bannerUrl: url.optional(),
  website: url.optional(),
  socialLinks: z
    .array(z.object({ platform: text, url }))
    .max(10)
    .optional(),
});
const revision = { expectedVersion: z.number().int().min(0) };
const state = connector("noodle_state")
  .version("1.0.0")
  .operation("read_state", {
    type: "read",
    input: z.object({ handle: z.string(), key: z.string().optional() }),
    output: z.object({
      value: z.unknown(),
      revision: z.number(),
      status: z.string(),
      ok: z.boolean().optional(),
    }),
  })
  .operation("patch_state", {
    type: "action",
    input: z.object({
      handle: z.string(),
      key: z.string().optional(),
      expectedRevision: z.number(),
      value: z.unknown(),
    }),
    output: z.object({
      value: z.unknown(),
      revision: z.number(),
      status: z.string(),
      ok: z.boolean().optional(),
    }),
  });
const draftSchema = z.object({
  version: z.number().int(),
  profile,
  candidates: z
    .array(
      z.object({
        id: text,
        platform: text,
        url,
        name: text,
        headline: text,
        source: text,
        confidence: z.literal("possible"),
        decision: z.enum(["proposed", "accepted", "rejected"]),
      }),
    )
    .max(10),
  company: z
    .object({ name: text, url, summary: text, source: text })
    .optional(),
  media: z
    .array(
      z.object({
        id: text,
        title: text,
        url,
        kind: text,
        selected: z.boolean(),
      }),
    )
    .max(20),
  topics: z.array(text).max(5),
  audience: z.string().max(600),
  objective: z.string().max(600),
  language: text,
  plan: text,
  reviewedVersion: z.number().int(),
  matches: z
    .array(z.object({ id: text, title: text, reason: z.string().max(1500) }))
    .max(3),
  matchVersion: z.number().int(),
  signup: z.enum(["none", "pending", "demo-created"]),
  signupMethod: z.string().optional(),
  provenance: z.record(z.string(), z.string()),
});
const result = z.object({
  status: z.string(),
  message: z.string(),
  draft: draftSchema.nullable(),
  extra: z.record(z.string(), z.unknown()),
  write: z.boolean(),
  mock: z.boolean(),
});
const gateway = connector("pitchcentric_onboarding")
  .version("1.0.0")
  .compute("transition", {
    type: "read",
    input: z.object({
      state: z.unknown(),
      action: z.string(),
      args: z.record(z.string(), z.unknown()),
      readOk: z.boolean().optional(),
    }),
    output: result,
    limits: { timeoutMs: 1000, maxOutputBytes: 65536 },
    run: transition,
  })
  .compute("gate", {
    type: "read",
    input: z.object({ proposal: result, commit: z.unknown().optional() }),
    output: result,
    run: gateCommit,
  });

const definitions = [
  [
    "get_onboarding_state",
    "Review guest profile",
    "Read the anonymous draft, saved version and missing fields. Start here; no login needed.",
    z.object({}),
    false,
  ],
  [
    "research_guest",
    "Find social profiles",
    "Find possible social identities from person and company. Synthetic Alex Morgan / Brightwave fixture; other names return no results. Show Is this you? Never accept candidates automatically.",
    z.object({ name: text, companyName: text, ...revision }),
    true,
  ],
  [
    "confirm_guest_identity",
    "Confirm social identities",
    "Record Yes / Some are mine / None of these using returned candidate IDs. Only selected links belong to the visitor.",
    z.object({
      decision: z.enum(["yes", "some", "none"]),
      acceptedIds: z.array(text).max(10),
      ...revision,
    }),
    true,
  ],
  [
    "enrich_companies",
    "Research company",
    "Reuse the supplied website. Returns a separate company summary. Unknown sites return no results; personal role and bio are not inferred.",
    z.object({ website: url, ...revision }),
    true,
  ],
  [
    "update_guest_profile",
    "Update guest details",
    "Save visitor-provided or explicitly confirmed profile details. Ask only for gaps. Work history, websites, achievements and images are optional; corrections replace previous values.",
    z.object({ profile, ...revision }),
    true,
  ],
  [
    "discover_media",
    "Find media appearances",
    "Suggest mock media only after identity confirmation. Results are unselected until the visitor confirms.",
    z.object({}),
    true,
  ],
  [
    "curate_media",
    "Choose media and links",
    "Confirm discovered media IDs or add supplied press, podcast, YouTube and other links. Empty selections let visitors skip media.",
    z.object({
      selectedIds: z.array(text).max(20),
      links: z
        .array(
          z.object({
            title: text,
            url,
            kind: z.enum(["press", "podcast", "youtube", "link"]),
          }),
        )
        .max(20)
        .default([]),
      ...revision,
    }),
    true,
  ],
  [
    "suggest_topics",
    "Suggest discussion topics",
    "Propose topics from the draft. Do not treat suggestions as selected preferences.",
    z.object({}),
    false,
  ],
  [
    "set_outreach_preferences",
    "Set podcast goals",
    "Save one to five visitor-chosen topics, target audience, objective and language.",
    z.object({
      topics: z.array(text).min(1).max(5),
      audience: text,
      objective: text,
      language: text.default("English"),
      ...revision,
    }),
    true,
  ],
  [
    "recommend_plan",
    "Explore plans",
    "Show screenshot-based mock plans. Free is default; never gate preview matches on a paid plan.",
    z.object({}),
    false,
  ],
  [
    "select_plan",
    "Choose a demo plan",
    "Save an optional plan choice. No billing, payment or trial activation.",
    z.object({
      plan: z.enum(["Free", "Founder Solo", "Founder Pro"]),
      ...revision,
    }),
    true,
  ],
  [
    "complete_onboarding",
    "Confirm guest profile",
    "After showing the current draft, record the visitor confirmation. Completes the anonymous profile, never creates an account.",
    z.object({ confirmed: z.boolean(), ...revision }),
    true,
  ],
  [
    "find_podcast_matches",
    "Preview podcast matches",
    "Generate three fictional matches for the reviewed profile while anonymous. Show the results before suggesting account creation. No booking probabilities.",
    z.object({}),
    true,
  ],
  [
    "begin_account_creation",
    "Continue with an account",
    "Only after showing current matches and the visitor chooses signup, hand off to a host form for Google OAuth or email/password. No credential arguments.",
    z.object({ method: z.enum(["google", "email_password"]), ...revision }),
    true,
  ],
  [
    "cancel_account_creation",
    "Keep browsing anonymously",
    "Cancel pending signup without discarding profile or matches.",
    z.object({ ...revision }),
    true,
  ],
] as const;
const capabilities = definitions
  .filter(([name]) => name !== "recommend_plan" && name !== "select_plan")
  .map(([name, title, description, input]) =>
    tool(name, {
      title,
      description,
      input: input.extend({
        draftKey: z.string().min(1).max(100).default("current"),
      }),
      output: z.object({ result, revision: z.number().int() }),
      view: {
        component: "pitchcentric-profile",
        entry: "./views/pitchcentric-profile.tsx",
      },
      viewTitle: title,
      viewDescription:
        "Your private guest profile, identity choices and podcast matches.",
      invoking: "Preparing your guest profile…",
      invoked: "Profile update ready",
      csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
      annotations: annotations.readOnly(),
      fulfil: ({ input, connectors }) => {
        const current = connectors.state.readState({
          handle: "guest",
          key: input.draftKey,
        });
        const proposal = connectors.gateway.transition({
          state: current.value,
          action: name,
          args: input,
          readOk: current.ok,
        });
        return { result: proposal, revision: current.revision };
      },
    }),
  );
const finish = tool("finish_demo_account", {
  title: "Simulate signup completion",
  description:
    "App-only local simulation after the signup form. Does not authenticate a real user or create a production account.",
  visibility: ["app"],
  input: z.object({ draftKey: z.string().min(1).max(100).default("current") }),
  output: z.object({ result, revision: z.number().int() }),
  annotations: annotations.readOnly(),
  fulfil: ({ input, connectors }) => {
    const current = connectors.state.readState({
      handle: "guest",
      key: input.draftKey,
    });
    const proposal = connectors.gateway.transition({
      state: current.value,
      action: "finish_demo_account",
      args: input,
      readOk: current.ok,
    });
    return { result: proposal, revision: current.revision };
  },
});
const save = tool("save_guest_draft", {
  title: "Save reviewed guest profile",
  description:
    "Persist the exact proposal returned by a PitchCentric tool, using its revision. Never fabricate a proposal. This saves private demo state for 24 hours, not a public profile or real account.",
  input: z.object({
    proposal: result.extend({ draft: draftSchema }),
    expectedRevision: z.number().int().min(0),
    draftKey: z.string().min(1).max(100).default("current"),
  }),
  output: z.object({ result, revision: z.number().int() }),
  annotations: annotations.localAction({ destructive: false, confirm: true }),
  view: {
    component: "pitchcentric-profile",
    entry: "./views/pitchcentric-profile.tsx",
  },
  viewTitle: "Your saved guest profile",
  viewDescription: "Saved private profile and reviewed matches.",
  invoking: "Saving your profile…",
  invoked: "Profile saved",
  csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
  fulfil: ({ input, connectors }) => {
    const committed = connectors.state.patchState({
      handle: "guest",
      key: input.draftKey,
      expectedRevision: input.expectedRevision,
      value: input.proposal.draft,
    });
    const checked = connectors.gateway.gate({
      proposal: input.proposal,
      commit: committed,
    });
    return { result: checked, revision: committed.revision };
  },
});

export function createPitchcentric(assistantEnabled = true) {
  return server(
    "pitchcentric_onboarding",
    {
      title: "PitchCentric",
      version: "1.0.0",
      interactions: { confirmationFallback: "host" },
      branding: {
        name: "PitchCentric",
        accent: "#426422",
        surface: "#ffffff",
        radius: "lg",
        typography: "system",
      },
      assistant: assistantEnabled
        ? embeddedAssistant({
            model: openAICompatible({
              baseUrl: variable("ASSISTANT_MODEL_BASE_URL"),
              model: variable("ASSISTANT_MODEL"),
              apiKey: secret("ASSISTANT_MODEL_API_KEY"),
            }),
            access: publicWebsite({
              origins: ["http://localhost:4002", "http://127.0.0.1:4002"],
              capabilities: [...capabilities, finish, save],
              signIn: true,
              continuity: { enabled: true },
            }),
            layout: { mode: "inline" },
            labels: {
              composerPlaceholder: "Tell me about your story…",
              signUpAction: "Create account",
              signInHeading: "Save your profile and matches",
            },
            suggestedPrompts: [],
          })
        : undefined,
      instructions:
        "Help a prospective podcast guest in short, natural conversation. On the first turn use the website already present in page context or the message; never ask for it again. Read get_onboarding_state, then enrich_companies once per website. Use draftKey current for the whole conversation. Every tool except save_guest_draft returns a PROPOSAL, not persisted state. After any result with write:true, immediately call save_guest_draft with that exact result and returned revision as expectedRevision. Wait for successful confirmation before continuing. Save every supplied detail progressively. Ask only for missing fields, one short question at a time; role, background, expertise, relevant experience, optional media, audience and up to five priority topics. A visitor may skip experience and media. After name and company are known call research_guest; present Is this you? before accepting any candidate. Never infer a person’s experience from their company. Corrections override suggestions. Use the linked cards for editable review and matches. This is a local demo with synthetic research and podcasts. Research → Is this you? → confirmed profile → topics and audience → review → SHOW MATCHES → optional signup. Never invent research results or claim live crawling. Do not ask twice for known information. Profile is private and anonymous until signup. Passwords and OAuth stay in the host form. A result is a proposal until commit succeeds; if commit reports conflict or failure, reread and ask before retrying. No publishing, payments, mailbox connection or sending pitches.",
      use: { state, gateway },

      state: {
        handles: {
          guest: {
            kind: "draft",
            scope: "caller",
            version: "v1",
            ttlSeconds: 86400,
            claimOnAuthentication: true,
            schema: draftSchema,
          },
        },
      },
      agentGuide: {
        description:
          "Build a guest profile, prove value with matches and preserve the draft through optional signup.",
        useWhen: ["A visitor wants to find podcasts they could speak on."],
        workflows: [
          {
            id: "guest_onboarding",
            title: "Profile to matches",
            steps: definitions
              .filter((d) =>
                [
                  "get_onboarding_state",
                  "research_guest",
                  "confirm_guest_identity",
                  "update_guest_profile",
                  "set_outreach_preferences",
                  "complete_onboarding",
                  "find_podcast_matches",
                  "begin_account_creation",
                ].includes(d[0]),
              )
              .map((d) => ({
                capability: { kind: "tool" as const, name: d[0] },
                guidance: d[2],
              })),
          },
        ],
        boundaries: [
          "Mock results are not live evidence.",
          "User corrections outrank research.",
          "No signup before showing matches; never collect credentials in chat.",
        ],
      },
    },
    [...capabilities, finish, save],
  );
}
export default createPitchcentric();
