import { describe, it, expect } from "vitest";
import app from "../src/pitchcentric-server.js";
import {
  transition,
  gateCommit,
  type Draft,
} from "../src/pitchcentric-onboarding-runtime.js";
function session() {
  let state: Draft | undefined;
  return {
    call(action: string, args: Record<string, unknown> = {}) {
      const result = transition({ state, action, args });
      if (result.write) state = result.draft;
      return result;
    },
    get state() {
      return state;
    },
  };
}
function ready(s: ReturnType<typeof session>) {
  s.call("research_guest", {
    name: "Alex Morgan",
    companyName: "Brightwave",
    expectedVersion: 0,
  });
  s.call("confirm_guest_identity", {
    decision: "some",
    acceptedIds: ["linkedin"],
    expectedVersion: 1,
  });
  s.call("enrich_companies", {
    website: "https://brightwave.example",
    expectedVersion: 2,
  });
  s.call("update_guest_profile", {
    profile: {
      expertise: "Practical AI",
      role: "Founder",
      bio: "I help small businesses adopt AI.",
    },
    expectedVersion: 3,
  });
  s.call("set_outreach_preferences", {
    topics: ["Practical AI"],
    audience: "Small business owners",
    objective: "Share useful lessons",
    language: "English",
    expectedVersion: 4,
  });
  s.call("complete_onboarding", { confirmed: true, expectedVersion: 5 });
  return s.call("find_podcast_matches");
}
describe("PitchCentric conversational onboarding", () => {
  it("retains the website collected before identity research", () => {
    const s = session();
    s.call("enrich_companies", {
      website: "https://brightwave.example/",
      expectedVersion: 0,
    });
    const r = s.call("research_guest", {
      name: "Alex Morgan",
      companyName: "Brightwave",
      expectedVersion: 1,
    });
    expect(r.draft.profile.companyUrl).toBe("https://brightwave.example/");
    expect(r.draft.company?.name).toBe("Brightwave");
  });
  it("initializes the empty object returned by Noodle state", () => {
    expect(
      transition({ state: {}, action: "get_onboarding_state", args: {} }).draft
        .version,
    ).toBe(0);
  });
  it("fails closed on state read and commit failures", () => {
    expect(
      transition({
        state: {},
        action: "research_guest",
        args: {},
        readOk: false,
      }).write,
    ).toBe(false);
    const proposal = transition({
      state: {},
      action: "research_guest",
      args: { name: "Alex Morgan", companyName: "Brightwave" },
    });
    expect(gateCommit({ proposal, commit: { ok: false } })).toMatchObject({
      status: "conflict",
      draft: null,
      write: false,
    });
  });
  it("shows matches anonymously and carries the same snapshot through both simulated signup methods", () => {
    for (const method of ["google", "email_password"]) {
      const s = session();
      const matches = ready(s);
      expect(matches.draft.signup).toBe("none");
      expect(matches.draft.matches).toHaveLength(3);
      const before = structuredClone(s.state);
      expect(
        s.call("begin_account_creation", { method, expectedVersion: 5 }).status,
      ).toBe("host_action_required");
      const done = s.call("finish_demo_account");
      expect(done.draft.signup).toBe("demo-created");
      expect(done.draft.profile).toEqual(before?.profile);
      expect(done.draft.matches).toEqual(before?.matches);
      expect(s.call("finish_demo_account").write).toBe(false);
    }
  });
  it("does not invent social profiles for an unknown person", () => {
    const s = session();
    const r = s.call("research_guest", {
      name: "Pat Smith",
      companyName: "Other Company",
      expectedVersion: 0,
    });
    expect(r.status).toBe("no_results");
    expect(r.draft.candidates).toEqual([]);
  });
  it("requires specific candidate IDs and keeps unselected identities rejected", () => {
    const s = session();
    s.call("research_guest", {
      name: "Alex Morgan",
      companyName: "Brightwave",
    });
    expect(
      s.call("confirm_guest_identity", {
        decision: "some",
        acceptedIds: ["invented"],
      }).status,
    ).toBe("invalid");
    const r = s.call("confirm_guest_identity", {
      decision: "some",
      acceptedIds: ["linkedin"],
    });
    expect(r.draft.candidates.map((c) => c.decision)).toEqual([
      "accepted",
      "rejected",
      "rejected",
    ]);
  });
  it("supports rejecting all candidates and skipping media", () => {
    const s = session();
    s.call("research_guest", {
      name: "Alex Morgan",
      companyName: "Brightwave",
    });
    s.call("confirm_guest_identity", { decision: "none", acceptedIds: [] });
    expect(s.call("discover_media").status).toBe("no_results");
    expect(s.call("curate_media", { selectedIds: [] }).status).toBe("saved");
  });
  it("requires review and matches before signup", () => {
    const s = session();
    expect(s.call("find_podcast_matches").status).toBe("needs_review");
    expect(s.call("complete_onboarding", { confirmed: true }).status).toBe(
      "needs_input",
    );
    expect(s.call("begin_account_creation", { method: "google" }).status).toBe(
      "needs_matches",
    );
    expect(s.call("finish_demo_account").status).toBe("invalid");
  });
  it("invalidates old review, matches and pending signup after a correction", () => {
    const s = session();
    ready(s);
    s.call("begin_account_creation", { method: "google" });
    s.call("update_guest_profile", {
      profile: { bio: "A corrected biography" },
      expectedVersion: 5,
    });
    expect(s.state?.matches).toEqual([]);
    expect(s.call("finish_demo_account").status).toBe("invalid");
    expect(s.call("find_podcast_matches").status).toBe("needs_review");
  });
  it("rejects stale writes without overwriting a corrected profile", () => {
    const s = session();
    ready(s);
    const r = s.call("update_guest_profile", {
      profile: { bio: "stale" },
      expectedVersion: 0,
    });
    expect(r.status).toBe("conflict");
    expect(r.write).toBe(false);
    expect(s.state?.profile.bio).not.toBe("stale");
  });
  it("keeps company overview separate and preserves user corrections", () => {
    const s = session();
    ready(s);
    s.call("enrich_companies", { website: "https://brightwave.example" });
    expect(s.state?.profile.bio).toBe("I help small businesses adopt AI.");
    expect(s.state?.company?.summary).toContain("Brightwave");
  });
  it("deduplicates work history without requiring employer URLs", () => {
    const s = session();
    const row = { company: "Previous Co", role: "Engineer" };
    const r = s.call("update_guest_profile", {
      profile: { workHistory: [row, row] },
    });
    expect(r.draft.profile.workHistory).toEqual([row]);
  });
  it("keeps media proposals unselected and accepts manual links", () => {
    const s = session();
    ready(s);
    const r = s.call("discover_media");
    expect(r.draft.media[0].selected).toBe(false);
    const selected = s.call("curate_media", {
      selectedIds: ["appearance-1"],
      links: [
        {
          title: "My portfolio",
          url: "https://portfolio.example",
          kind: "link",
        },
      ],
    });
    expect(selected.draft.media.filter((m) => m.selected)).toHaveLength(2);
  });
  it("exposes proposal tools, a confirmed save and and an app-only credential-free signup stub", async () => {
    const manifest = await app.toManifest();
    expect(manifest.tools).toHaveLength(15);
    expect(
      manifest.tools.find((t) => t.name === "finish_demo_account")?.visibility,
    ).toEqual(["app"]);
    expect(
      JSON.stringify(manifest.tools.map((t) => t.inputSchema)),
    ).not.toMatch(/"password"|"token"|"otp"/);
    expect(manifest.state?.handles.guest).toMatchObject({
      scope: "caller",
      claimOnAuthentication: true,
    });
  });
});

it("cancels signup without removing matches and does not resave a committed proposal", () => {
  const s = session();
  ready(s);
  const before = structuredClone(s.state?.matches);
  s.call("begin_account_creation", { method: "google" });
  const cancelled = s.call("cancel_account_creation");
  expect(cancelled.draft.signup).toBe("none");
  expect(cancelled.draft.matches).toEqual(before);
  expect(gateCommit({ proposal: cancelled, commit: { ok: true } }).write).toBe(
    false,
  );
});
