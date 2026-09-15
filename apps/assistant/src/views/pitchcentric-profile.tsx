import { useState } from "react";
import {
  useToolInfo,
  useSendFollowUpMessage,
  useCallTool,
  useWidgetReady,
} from "../helpers.js";
import type { Draft } from "../pitchcentric-onboarding-runtime.js";
import "./pitchcentric.css";

export default function PitchCentricProfile() {
  const info = useToolInfo();
  const ready = useWidgetReady();
  const follow = useSendFollowUpMessage();
  const finish = useCallTool("finish_demo_account");
  const save = useCallTool("save_guest_draft");
  const payload = info.structuredContent as
    | { result?: { draft: Draft | null; message: string; status: string } }
    | undefined;
  const d = payload?.result?.draft;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function send(prompt: string) {
    setBusy(true);
    setError("");
    try {
      await follow({ prompt });
    } catch {
      setError(
        "That update could not be sent. Your saved profile is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <div className="pc-card" role="status">
        Building your guest profile…
      </div>
    );
  if (!d || info.isError)
    return (
      <div className="pc-card" role="alert">
        Your profile could not be loaded. Ask the assistant to reopen your saved
        profile.
      </div>
    );
  const candidates = d.candidates.filter((c) => c.decision === "proposed");
  return (
    <section className="pc-card" aria-label="PitchCentric guest profile">
      <header>
        <span className="pc-pill">PRIVATE GUEST PROFILE · REVIEW</span>
        <span>PitchCentric</span>
      </header>
      <h2>{d.profile.name || "Your story starts here"}</h2>
      <p>
        {[d.profile.role, d.profile.companyName].filter(Boolean).join(" · ")}
      </p>
      {d.profile.companyUrl && (
        <div className="pc-source">
          <small>WEBSITE YOU SHARED</small>
          <p>{d.profile.companyUrl}</p>
          {d.company ? (
            <>
              <p>{d.company.summary}</p>
              <small>Company context only · {d.company.source}</small>
            </>
          ) : (
            <p>
              No research record available. We can continue with the information
              you share.
            </p>
          )}
        </div>
      )}
      {candidates.length > 0 && (
        <section>
          <h3>Is this you?</h3>
          <p className="pc-muted">
            Fictional candidates for this demo, not verified social accounts.
            Select only those you want to accept.
          </p>
          {candidates.map((c) => (
            <label className="pc-identity" key={c.id}>
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((v) =>
                    e.target.checked
                      ? [...v, c.id]
                      : v.filter((id) => id !== c.id),
                  )
                }
              />
              <span>
                <strong>
                  {c.name} · {c.platform}
                </strong>
                <small>{c.headline}</small>
                <small>{c.url}</small>
              </span>
            </label>
          ))}
          <div className="pc-actions">
            <button
              type="button"
              disabled={busy || !selected.length}
              onClick={() =>
                void send(
                  `Confirm my identity: only candidate IDs ${JSON.stringify(selected)} are mine; reject all others. Use the current draft version.`,
                )
              }
            >
              These are mine
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void send(
                  "None of these social profiles are mine. Reject all candidates and continue without them.",
                )
              }
            >
              None of these
            </button>
          </div>
        </section>
      )}
      <dl>
        {[
          ["Background", d.profile.bio],
          ["Expertise", d.profile.expertise],
          ["Relevant experience", d.profile.experience],
          ["Media appearances", d.profile.mediaNotes],
          ["Audience", d.audience],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {!!d.topics.length && (
        <div className="pc-topics">
          {d.topics.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {!!d.candidates.filter((c) => c.decision === "accepted").length && (
        <p className="pc-muted">
          Accepted by you:{" "}
          {d.candidates
            .filter((c) => c.decision === "accepted")
            .map((c) => c.platform)
            .join(", ")}
          . This does not independently verify your identity.
        </p>
      )}
      <button
        type="button"
        className="pc-link"
        disabled={busy}
        onClick={() => {
          setEdits(
            Object.fromEntries(
              Object.entries(d.profile).filter(
                ([, v]) => typeof v === "string",
              ),
            ) as Record<string, string>,
          );
          setEditing(!editing);
        }}
      >
        {editing ? "Close editor" : "Edit my profile"}
      </button>
      {editing && (
        <div>
          <div className="pc-fields">
            {[
              ["name", "Name"],
              ["companyName", "Company"],
              ["role", "Role"],
              ["bio", "Background"],
              ["expertise", "Expertise"],
              ["experience", "Relevant experience"],
              ["mediaNotes", "Media appearances"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  name={key}
                  maxLength={600}
                  value={edits[key] || ""}
                  onChange={(e) =>
                    setEdits((v) => ({ ...v, [key]: e.target.value }))
                  }
                  required={!["experience", "mediaNotes"].includes(key)}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void send(
                `Please apply these corrections to my guest profile: ${JSON.stringify(edits)}. Re-read the saved version first and review new matches afterward.`,
              );
              setEditing(false);
            }}
          >
            Save corrections
          </button>
        </div>
      )}
      {!d.matches.length && d.profile.bio && d.topics.length > 0 && (
        <button
          type="button"
          disabled={busy || !!candidates.length}
          onClick={() =>
            void send(
              "I have reviewed the guest profile shown here and confirm it. Find my podcast matches before asking me to sign up.",
            )
          }
        >
          Looks right. Find my shows →
        </button>
      )}
      {!!d.matches.length && (
        <section>
          <h3>Your next conversations</h3>
          <p className="pc-muted">
            Fictional podcast matches · editorial examples, not booking
            probabilities.
          </p>
          {d.matches.map((m, i) => (
            <article className="pc-match" key={m.id}>
              <div className={`pc-cover pc-cover-${i}`}>{m.title}</div>
              <div>
                <h4>{m.title}</h4>
                <p>{m.reason}</p>
              </div>
            </article>
          ))}
        </section>
      )}
      {!!d.matches.length && d.signup === "none" && (
        <section className="pc-save">
          <h3>Keep your story and your shows together.</h3>
          <p>Account creation is simulated in this local demo.</p>
          <div className="pc-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void send(
                  "I want to save these matches. Begin simulated account creation with Google.",
                )
              }
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void send(
                  "I want to save these matches. Begin simulated email/password account creation.",
                )
              }
            >
              Use email and password
            </button>
          </div>
        </section>
      )}
      {d.signup === "pending" && !done && (
        <section className="pc-save">
          <h3>
            {d.signupMethod === "google"
              ? "Google signup preview"
              : "Email/password signup preview"}
          </h3>
          <p>
            No Google access or password is collected. This simulates account
            creation and retains the same draft.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const response = await finish.callTool({ draftKey: "current" });
                const proposed = response as {
                  structuredContent?: {
                    result?: Record<string, unknown>;
                    revision?: number;
                  };
                };
                if (!proposed.structuredContent?.result) throw new Error();
                const saved = await save.callTool({
                  draftKey: "current",
                  proposal: proposed.structuredContent.result,
                  expectedRevision: proposed.structuredContent.revision,
                });
                const receipt = saved as {
                  structuredContent?: { result?: { draft?: Draft } };
                };
                if (
                  receipt.structuredContent?.result?.draft?.signup !==
                  "demo-created"
                )
                  throw new Error();
                setDone(true);
              } catch {
                setError(
                  "Signup was not confirmed. Ask the assistant to reopen your draft before trying again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Create demo account
          </button>
          <button
            type="button"
            className="pc-link"
            disabled={busy}
            onClick={() =>
              void send(
                "Cancel signup for now. Keep my profile and matches available.",
              )
            }
          >
            Cancel signup
          </button>
        </section>
      )}
      {(done || d.signup === "demo-created") && (
        <p className="pc-save" role="status">
          Demo account created. Your profile and matches are retained in this
          session. No real account was created.
        </p>
      )}
      {busy && <p role="status">Updating your profile…</p>}
      {error && <p role="alert">{error}</p>}
      <footer>Demo research · Your corrections always take priority.</footer>
    </section>
  );
}
