import assert from "node:assert/strict";
// Synthetic end-to-end host -> MCP -> state test. Start the two local services first.
// Uses the local SDK's 60-call hourly anonymous allowance. Restart MCP before a separate demo.
const origin = "http://localhost:4002";
function visitor() {
  let cookie = "";
  return async (action, args = {}, website) => {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const r = await fetch(`${origin}/api/pitchcentric/onboarding`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ action, args, website }),
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await r.json();
    assert.equal(r.status, 200, `${action}: ${JSON.stringify(data)}`);
    return data.result;
  };
}
for (const method of ["google", "email_password"]) {
  const call = visitor();
  let r = await call("start", {}, "https://brightwave.example");
  assert.equal(r.draft.version, 1);
  assert.equal(r.draft.profile.name, undefined);
  r = await call("research_guest", {
    name: "Alex Morgan",
    companyName: "Brightwave",
    expectedVersion: 1,
  });
  assert.equal(r.draft.profile.companyUrl, "https://brightwave.example/");
  assert.equal(r.draft.candidates.length, 3);
  r = await call("confirm_guest_identity", {
    decision: "some",
    acceptedIds: ["linkedin"],
    expectedVersion: 2,
  });
  assert.deepEqual(
    r.draft.candidates.map((c) => c.decision),
    ["accepted", "rejected", "rejected"],
  );
  r = await call("update_guest_profile", {
    profile: {
      role: "Founder",
      bio: "I help small teams adopt AI.",
      expertise: "Practical AI adoption",
      mediaNotes: "Skipped",
    },
    expectedVersion: 3,
  });
  r = await call("set_outreach_preferences", {
    topics: ["AI adoption", "Small business"],
    audience: "Small business owners",
    objective: "Share practical lessons",
    language: "English",
    expectedVersion: 4,
  });
  assert.equal(
    (await call("begin_account_creation", { method, expectedVersion: 5 }))
      .status,
    "needs_matches",
  );
  r = await call("complete_onboarding", {
    confirmed: true,
    expectedVersion: 5,
  });
  assert.equal(r.status, "ready");
  r = await call("find_podcast_matches");
  assert.equal(r.draft.matches.length, 3);
  assert.equal(r.draft.signup, "none");
  const before = structuredClone(r.draft);
  r = await call("begin_account_creation", { method, expectedVersion: 5 });
  assert.equal(r.draft.signup, "pending");
  r = await call("finish_demo_account");
  assert.equal(r.draft.signup, "demo-created");
  assert.deepEqual(r.draft.profile, before.profile);
  assert.deepEqual(r.draft.matches, before.matches);
  r = await call("start", {}, "https://brightwave.example");
  assert.equal(r.draft.signup, "demo-created");
  r = await call("update_guest_profile", {
    profile: { bio: "Corrected background" },
    expectedVersion: 5,
  });
  assert.equal(r.draft.matches.length, 0);
  assert.equal(r.draft.signup, "none");
  r = await call("update_guest_profile", {
    profile: { bio: "Stale biography" },
    expectedVersion: 5,
  });
  assert.equal(r.status, "conflict");
  r = await call("get_onboarding_state");
  assert.equal(r.draft.profile.bio, "Corrected background");
  const stranger = visitor();
  r = await stranger("start", {}, "https://unknown.example");
  assert.equal(r.draft.profile.name, undefined);
  assert.equal(r.draft.company, undefined);
  r = await stranger("research_guest", {
    name: "Pat Example",
    companyName: "Independent",
    expectedVersion: 1,
  });
  assert.equal(r.status, "no_results");
  assert.equal(r.draft.candidates.length, 0);
  console.log(
    `PASS ${method}: anonymous matching, identity selection, same-draft signup, reload, corrections, stale-write rejection, visitor isolation and unknown research.`,
  );
}
const bad = await fetch(`${origin}/api/pitchcentric/onboarding`, {
  method: "POST",
  headers: {
    Origin: "https://untrusted.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "start",
    website: "https://brightwave.example",
  }),
});
assert.equal(bad.status, 403);
console.log("PASS wrong-origin request blocked.");
