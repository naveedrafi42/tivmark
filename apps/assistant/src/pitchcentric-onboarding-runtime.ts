export type Profile = {
  name?: string;
  companyName?: string;
  companyUrl?: string;
  expertise?: string;
  experience?: string;
  mediaNotes?: string;
  role?: string;
  bio?: string;
  tagline?: string;
  city?: string;
  workHistory?: {
    company: string;
    role: string;
    website?: string;
    startYear?: number;
    endYear?: number;
  }[];
  achievements?: string[];
  photoUrl?: string;
  bannerUrl?: string;
  website?: string;
  socialLinks?: { platform: string; url: string }[];
};
export type Candidate = {
  id: string;
  platform: string;
  url: string;
  name: string;
  headline: string;
  source: string;
  confidence: "possible";
  decision: "proposed" | "accepted" | "rejected";
};
export type Draft = {
  version: number;
  profile: Profile;
  company?: { name: string; url: string; summary: string; source: string };
  candidates: Candidate[];
  media: {
    id: string;
    title: string;
    url: string;
    kind: string;
    selected: boolean;
  }[];
  topics: string[];
  audience: string;
  objective: string;
  language: string;
  plan: string;
  reviewedVersion: number;
  matches: { id: string; title: string; reason: string }[];
  matchVersion: number;
  signup: "none" | "pending" | "demo-created";
  signupMethod?: string;
  provenance: Record<string, string>;
};
export type Request = {
  state?: unknown;
  draftKey?: string;
  action: string;
  args: Record<string, unknown>;
  readOk?: boolean;
};
/** Self-contained function: Noodle runs this in its compute sandbox. No network or captured state. */
export function transition(input: Request) {
  const d: Draft =
    input.state && typeof (input.state as Draft).version === "number"
      ? JSON.parse(JSON.stringify(input.state))
      : {
          version: 0,
          profile: {},
          candidates: [],
          media: [],
          topics: [],
          audience: "",
          objective: "",
          language: "English",
          plan: "Free",
          reviewedVersion: -1,
          matches: [],
          matchVersion: -1,
          signup: "none",
          provenance: {},
        };
  const a = input.args;
  const reply = (
    status: string,
    message: string,
    extra: Record<string, unknown> = {},
    write = false,
  ) => ({ status, message, draft: d, extra, write, mock: true });
  const changed = () => {
    d.version++;
    d.reviewedVersion = -1;
    d.matches = [];
    d.matchVersion = -1;
    d.signup = "none";
  };
  const missing = () =>
    ["name", "role", "bio", "expertise"]
      .filter((k) => !d.profile[k as keyof Profile])
      .concat(
        !d.profile.companyName ? ["companyName"] : [],
        !d.topics.length ? ["topics"] : [],
        !d.audience ? ["audience"] : [],
        !d.objective ? ["objective"] : [],
      );
  if (input.readOk === false)
    return reply(
      "unavailable",
      "The saved draft could not be read. Retry before making changes.",
    );
  if (input.action === "get_onboarding_state")
    return reply("ready", "Private anonymous draft. No account required.", {
      missing: missing(),
    });
  if (a.expectedVersion !== undefined && a.expectedVersion !== d.version)
    return reply(
      "conflict",
      "Draft changed. Read the current state before retrying.",
    );
  switch (input.action) {
    case "research_guest": {
      const name = String(a.name).trim(),
        company = String(a.companyName).trim();
      if (d.profile.name !== name || d.profile.companyName !== company) {
        const firstIdentity = !d.profile.name;
        d.profile = firstIdentity
          ? { ...d.profile, name, companyName: company }
          : { name, companyName: company, companyUrl: d.profile.companyUrl };
        if (!firstIdentity) d.company = undefined;
        d.candidates = [];
        d.media = [];
        d.topics = [];
        d.audience = "";
        d.objective = "";
        d.provenance = {};
      }
      d.profile.name = name;
      d.profile.companyName = company;
      d.provenance.name = "user";
      d.provenance.companyName = "user";
      // Fictional fixture only. Unknown people never receive these links.
      if (
        name.toLowerCase() === "alex morgan" &&
        company.toLowerCase() === "brightwave"
      ) {
        const existing = d.candidates;
        d.candidates = [
          ["linkedin", "https://profiles.example/alex-morgan/linkedin"],
          ["x", "https://profiles.example/alex-morgan/x"],
          ["youtube", "https://profiles.example/alex-morgan/youtube"],
        ].map(([platform, url]) => ({
          id: platform,
          platform,
          url,
          name,
          headline: "Founder at Brightwave • AI for small businesses",
          source: "synthetic demo fixture; not a verified live profile",
          confidence: "possible" as const,
          decision:
            existing.find((c) => c.id === platform)?.decision ?? "proposed",
        }));
      } else d.candidates = [];
      changed();
      return reply(
        d.candidates.length ? "needs_confirmation" : "no_results",
        d.candidates.length
          ? "Is this you? Choose Yes, Some are mine, or None of these. Confirm each profile before using it."
          : "No reliable mock candidates. Ask for a profile link or a short introduction; never invent an identity.",
        {},
        true,
      );
    }
    case "confirm_guest_identity": {
      const ids = [...new Set(a.acceptedIds as string[])];
      if (ids.some((id) => !d.candidates.some((c) => c.id === id)))
        return reply(
          "invalid",
          "Unknown candidate. Research again or select a returned candidate.",
        );
      if (
        (a.decision === "yes" && ids.length !== d.candidates.length) ||
        (a.decision === "none" && ids.length !== 0) ||
        (a.decision === "some" && !ids.length)
      )
        return reply(
          "invalid",
          "Selection does not match the confirmation choice.",
        );
      d.candidates = d.candidates.map((c) => ({
        ...c,
        decision: ids.includes(c.id) ? "accepted" : "rejected",
      }));
      changed();
      return reply(
        "saved",
        "Only selected social profiles are accepted. Personal biography still needs your review.",
        {},
        true,
      );
    }
    case "enrich_companies": {
      const url = String(a.website);
      d.profile.companyUrl = url;
      d.provenance.companyUrl = "user";
      if (
        url === "https://brightwave.example" ||
        url === "https://brightwave.example/"
      )
        d.company = {
          name: "Brightwave",
          url,
          summary:
            "Brightwave helps small businesses put practical AI tools to work.",
          source: "synthetic company fixture",
        };
      else d.company = undefined;
      changed();
      return reply(
        d.company ? "saved" : "no_results",
        d.company
          ? "Company summary found. This describes the business, not your personal role."
          : "No mock company record. Keep the website and ask what the company does.",
        {},
        true,
      );
    }
    case "update_guest_profile": {
      const patch = a.profile as Profile;
      if (patch.socialLinks?.length)
        return reply(
          "invalid",
          "Confirm social candidates before adding links; use the identity card.",
        );
      if (
        (patch.name && patch.name !== d.profile.name) ||
        (patch.companyName && patch.companyName !== d.profile.companyName)
      ) {
        d.candidates = [];
        d.media = [];
        d.company = undefined;
      }
      if (patch.companyUrl && patch.companyUrl !== d.profile.companyUrl)
        d.company = undefined;
      d.profile = { ...d.profile, ...patch };
      if (patch.workHistory)
        d.profile.workHistory = patch.workHistory.filter(
          (w, i, all) =>
            all.findIndex(
              (x) =>
                x.company.toLowerCase() === w.company.toLowerCase() &&
                x.role.toLowerCase() === w.role.toLowerCase(),
            ) === i,
        );
      for (const key of Object.keys(patch))
        d.provenance[key] = "user-confirmed";
      changed();
      return reply(
        "saved",
        "Profile updated. Optional employer websites and media never block matching.",
        {},
        true,
      );
    }
    case "discover_media": {
      const known = d.candidates.some((c) => c.decision === "accepted");
      const media =
        known && d.profile.name === "Alex Morgan"
          ? [
              {
                id: "appearance-1",
                title: "Practical AI for small teams (demo)",
                url: "https://media.example/practical-ai",
                kind: "podcast",
                selected: false,
              },
            ]
          : [];
      d.media = [
        ...d.media,
        ...media.filter((m) => !d.media.some((x) => x.url === m.url)),
      ];
      return reply(
        media.length ? "found" : "no_results",
        media.length
          ? "Possible media appearance; select it only if it belongs to you."
          : "No mock media found. Add a link or skip this optional step.",
        {},
        true,
      );
    }
    case "curate_media": {
      const ids = a.selectedIds as string[];
      if (d.media.length + ((a.links ?? []) as unknown[]).length > 20)
        return reply("invalid", "Keep at most 20 media links.");
      if (ids.some((id) => !d.media.some((m) => m.id === id)))
        return reply("invalid", "Unknown media selection.");
      d.media = d.media.map((m) => ({ ...m, selected: ids.includes(m.id) }));
      for (const m of (a.links ?? []) as {
        title: string;
        url: string;
        kind: string;
      }[]) {
        if (!d.media.some((x) => x.url === m.url))
          d.media.push({
            ...m,
            id: "manual-" + d.media.length,
            selected: true,
          });
      }
      changed();
      return reply("saved", "Media selection saved.", {}, true);
    }
    case "suggest_topics":
      return reply(
        "ready",
        "Suggestions are proposals. Ask which topics they want to discuss.",
        {
          suggestions: d.profile.bio?.toLowerCase().includes("ai")
            ? [
                "Practical AI adoption",
                "Building AI agents",
                "Growing a small business",
              ]
            : [
                "Lessons from your work",
                "Your industry perspective",
                "Building effective teams",
              ],
        },
      );
    case "set_outreach_preferences":
      if (
        !Array.isArray(a.topics) ||
        a.topics.length < 1 ||
        a.topics.length > 5
      )
        return reply("invalid", "Choose one to five priority topics.");
      d.topics = [...new Set(a.topics as string[])];
      d.audience = String(a.audience);
      d.objective = String(a.objective);
      d.language = String(a.language);
      changed();
      return reply("saved", "Outreach preferences saved.", {}, true);
    case "recommend_plan":
      return reply(
        "ready",
        "Start with Free to explore. Choose a plan after seeing your matches.",
        {
          plans: [
            { name: "Free", monthly: 0 },
            { name: "Founder Solo", monthly: 39 },
            { name: "Founder Pro", monthly: 79 },
          ],
          source: "demo catalog from supplied screenshots; not live pricing",
        },
      );
    case "select_plan":
      d.plan = String(a.plan);
      return reply(
        "saved",
        "Demo plan selected. No charge or trial started.",
        {},
        true,
      );
    case "complete_onboarding": {
      const gaps = missing();
      if (gaps.length)
        return reply(
          "needs_input",
          "Ask only for the remaining required details.",
          { missing: gaps },
        );
      if (a.confirmed !== true)
        return reply(
          "needs_confirmation",
          "Show the draft and ask the visitor to confirm it.",
        );
      if (d.candidates.some((c) => c.decision === "proposed"))
        return reply(
          "needs_confirmation",
          "Please confirm or reject the possible social identities first.",
        );
      d.reviewedVersion = d.version;
      return reply(
        "ready",
        "Guest profile reviewed. Find matches now, before signup.",
        {},
        true,
      );
    }
    case "find_podcast_matches": {
      if (d.reviewedVersion !== d.version)
        return reply(
          "needs_review",
          "Review the current profile before generating matches.",
          { missing: missing() },
        );
      const catalog = [
        {
          title: "Founder Frequency",
          tags: ["founder", "business", "startup", "growth"],
          audience: "founders and small-business operators",
        },
        {
          title: "The Human Side of AI",
          tags: ["ai", "technology", "automation", "data"],
          audience: "people adopting technology at work",
        },
        {
          title: "Build Better",
          tags: ["leadership", "team", "product", "building"],
          audience: "leaders building better teams and products",
        },
        {
          title: "The Creative Practice",
          tags: ["creative", "design", "writing", "media"],
          audience: "independent creators and communicators",
        },
        {
          title: "Work in Progress",
          tags: ["career", "experience", "work", "education"],
          audience: "professionals learning from practical experience",
        },
      ];
      const words = (
        d.topics.join(" ") +
        " " +
        d.profile.expertise +
        " " +
        d.audience
      ).toLowerCase();
      d.matches = catalog
        .map((show) => ({
          ...show,
          score: show.tags.filter((t) => words.includes(t)).length,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((show, i) => ({
          id: "podcast-" + i,
          title: show.title,
          reason: show.score
            ? `Fictional editorial fit: ${show.audience}; your topics (${d.topics.join(", ")}) overlap its demo focus. Intended audience: ${d.audience}.`
            : `Exploratory fictional match for ${d.audience}. Its focus on ${show.audience} has no direct topic overlap; review relevance before pitching.`,
        }));
      d.matchVersion = d.version;
      return reply(
        "ready",
        "Three fictional podcast matches. Show these before offering account creation.",
        {},
        true,
      );
    }
    case "begin_account_creation": {
      if (!d.matches.length || d.matchVersion !== d.version)
        return reply(
          "needs_matches",
          "Show current matches before offering signup.",
        );
      if (d.signup === "demo-created")
        return reply(
          "ready",
          "Demo account already has this profile and these matches.",
        );
      d.signup = "pending";
      d.signupMethod = String(a.method);
      return reply(
        "host_action_required",
        "Open the host-controlled signup form. Never ask for passwords, OAuth tokens or verification codes in chat.",
        { action: "open_signup", method: a.method, simulation: true },
        true,
      );
    }
    case "cancel_account_creation": {
      if (d.signup === "demo-created")
        return reply("invalid", "This demo account is already created.");
      d.signup = "none";
      delete d.signupMethod;
      return reply(
        "saved",
        "Signup cancelled. Your profile and matches are still available.",
        {},
        true,
      );
    }
    case "finish_demo_account": {
      if (d.signup === "demo-created")
        return reply(
          "ready",
          "Demo account already created; no duplicate profile.",
        );
      if (d.signup !== "pending" || d.matchVersion !== d.version)
        return reply("invalid", "Begin signup with current matches first.");
      d.signup = "demo-created";
      return reply(
        "ready",
        "Simulated account created. The same private guest profile and match snapshot are preserved. This is not real authentication.",
        { accountId: "demo-account", profileVersion: d.version },
        true,
      );
    }
    default:
      return reply("invalid", "Unknown onboarding action.");
  }
}

/** Commit failures must never be presented as successful profile changes. */
export function gateCommit(input: {
  proposal: ReturnType<typeof transition>;
  commit?: { ok?: boolean; status?: string };
}) {
  if (input.proposal.write && input.commit?.ok !== true)
    return {
      ...input.proposal,
      status: "conflict",
      message:
        "Draft was not saved. Read current state and retry with its version.",
      draft: null,
      write: false,
      extra: {},
    };
  return { ...input.proposal, write: false };
}
