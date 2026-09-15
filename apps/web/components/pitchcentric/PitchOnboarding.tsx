/* eslint-disable i18next/no-literal-string */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  GlobeAltIcon,
  MicrophoneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { GuestDraft, ToolResult } from '@/lib/pitchcentric/contracts';
import styles from './pitch-onboarding.module.css';

type Stage =
  | 'identity'
  | 'social'
  | 'profile'
  | 'goals'
  | 'review'
  | 'matches'
  | 'signup'
  | 'complete';
type Message = { role: 'assistant' | 'user'; text: string };
function nextStage(d: GuestDraft): Stage {
  if (!d.profile.name) return 'identity';
  if (d.candidates.some((c) => c.decision === 'proposed')) return 'social';
  if (!d.profile.role || !d.profile.bio || !d.profile.expertise)
    return 'profile';
  if (!d.topics.length || !d.audience || !d.objective) return 'goals';
  if (d.signup === 'demo-created') return 'complete';
  if (d.signup === 'pending') return 'signup';
  if (d.matches.length && d.matchVersion === d.version) return 'matches';
  return 'review';
}
const responses: Record<string, string> = {
  update_guest_profile: 'Thanks—that gives me a clearer picture of your story.',
  set_outreach_preferences:
    'That sounds like an audience you can help. Here’s your profile to review.',
  begin_account_creation:
    'Great. Your profile and matches are ready to carry into your account.',
  finish_demo_account:
    'Your demo account is ready. Everything we built is still here.',
};
const prompts: Record<Stage, string> = {
  identity:
    'Let’s put a person behind the website. What’s your name, and which company are you representing?',
  social:
    'Is this you? Select only the profiles that belong to you. You can also tell me none of these are yours.',
  profile:
    'What do you do, and what could a podcast audience learn from you? A sentence or two is plenty.',
  goals:
    'Who would you love to reach? Choose the topics you want to talk about and tell me what a great appearance would achieve.',
  review:
    'Your story is taking shape. Take a look at your guest profile. If it feels right, let’s find your shows.',
  matches:
    'Here are three places your story could fit. Your matches are ready—create an account whenever you want to keep going.',
  signup:
    'Let’s keep your profile and matches together. This demo previews the account step without collecting sign-in details.',
  complete:
    'You’re all set. Your demo account has the guest profile and matches we built together.',
};
export function PitchOnboarding({ website }: { website: string }) {
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [stage, setStage] = useState<Stage>('identity');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(0);
  const boot = useRef<Promise<ToolResult> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [expertise, setExpertise] = useState('');
  const [experience, setExperience] = useState('');
  const [mediaNotes, setMediaNotes] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [topics, setTopics] = useState('');
  const [audience, setAudience] = useState('');
  const [objective, setObjective] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  async function call(
    action: string,
    args: Record<string, unknown> = {}
  ): Promise<ToolResult> {
    const response = await fetch('/api/pitchcentric/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, args }),
    });
    const data = await response.json();
    if (!response.ok || !data.result)
      throw new Error(
        data.error ?? 'That step could not be saved. Please try again.'
      );
    const r = data.result as ToolResult;
    if (
      [
        'conflict',
        'unavailable',
        'invalid',
        'needs_input',
        'needs_review',
        'needs_matches',
      ].includes(r.status)
    )
      throw new Error(r.message);
    return r;
  }
  function adopt(d: GuestDraft) {
    setDraft(d);
    setName(d.profile.name ?? '');
    setCompany(d.profile.companyName ?? d.company?.name ?? '');
    setRole(d.profile.role ?? '');
    setExpertise(d.profile.expertise ?? '');
    setExperience(d.profile.experience ?? '');
    setMediaNotes(d.profile.mediaNotes ?? '');
    setBio(d.profile.bio ?? '');
    setCity(d.profile.city ?? '');
    setTopics(d.topics.join(', '));
    setAudience(d.audience);
    setObjective(d.objective);
    setSelected(
      d.candidates.filter((c) => c.decision === 'accepted').map((c) => c.id)
    );
  }
  useEffect(() => {
    let live = true;
    if (!website) {
      setError('Start with your website to begin.');
      setBusy(false);
      return;
    }
    setError('');
    setBusy(true);
    if (!boot.current)
      boot.current = (async () => {
        const r = await fetch('/api/pitchcentric/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', website }),
        });
        const data = await r.json();
        if (!r.ok || !data.result?.draft)
          throw new Error(data.error ?? 'Could not start onboarding.');
        return data.result as ToolResult;
      })();
    boot.current
      .then((r) => {
        if (!live || !r.draft) return;
        setError('');
        adopt(r.draft);
        const next = nextStage(r.draft);
        setStage(next);
        setMessages([
          { role: 'user', text: website },
          {
            role: 'assistant',
            text: r.draft.company
              ? `I have your website. ${r.draft.company.summary}`
              : 'I have your website. There isn’t a research record for it in this demo, so we’ll build your story together.',
          },
        ]);
        setBusy(false);
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => {
      live = false;
    };
  }, [website, started]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);
  async function act(
    action: string,
    args: Record<string, unknown>,
    said: string,
    follow?: string
  ) {
    if (busy || !draft) return;
    setBusy(true);
    setError('');
    try {
      let r = await call(action, args);
      if (follow) r = await call(follow);
      if (!r.draft)
        throw new Error(
          'The draft was not saved. Please reload its current state.'
        );
      const next = nextStage(r.draft);
      adopt(r.draft);
      setStage(next);
      setMessages((m) => [
        ...m,
        { role: 'user', text: said },
        {
          role: 'assistant',
          text:
            action === 'research_guest' && r.status === 'no_results'
              ? 'I couldn’t find reliable social matches in this demo. We can carry on with the details you share.'
              : action === 'confirm_guest_identity'
                ? 'Thanks. I’ll use only the profiles you confirmed.'
                : action === 'complete_onboarding'
                  ? 'Your profile is ready. I’ve put together three sample podcast matches.'
                  : (responses[action] ?? 'Your progress is saved.'),
        },
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }
  function identity(e: FormEvent) {
    e.preventDefault();
    void act(
      'research_guest',
      { name, companyName: company, expectedVersion: draft?.version },
      `I’m ${name}, from ${company}.`
    );
  }
  function details(e: FormEvent) {
    e.preventDefault();
    void act(
      'update_guest_profile',
      {
        profile: {
          role,
          bio,
          expertise,
          ...(experience.trim() ? { experience } : {}),
          mediaNotes: mediaNotes.trim() || 'Skipped',
          ...(city.trim() ? { city } : {}),
        },
        expectedVersion: draft?.version,
      },
      `${role} — ${bio}`
    );
  }
  function goals(e: FormEvent) {
    e.preventDefault();
    const chosen = topics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (chosen.length < 1 || chosen.length > 5) {
      setError('Choose between one and five topics, separated by commas.');
      return;
    }
    void act(
      'set_outreach_preferences',
      {
        topics: chosen,
        audience,
        objective,
        language: 'English',
        expectedVersion: draft?.version,
      },
      `I’d like to talk about ${chosen.join(', ')} with ${audience}.`
    );
  }
  async function topicIdeas() {
    setBusy(true);
    setError('');
    try {
      const r = await call('suggest_topics');
      setSuggestions((r.extra.suggestions as string[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function startOver() {
    try {
      const response = await fetch('/api/pitchcentric/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (!response.ok) throw new Error();
      window.location.assign('/');
    } catch {
      setError('Could not start over. Check your connection and try again.');
    }
  }
  const progress =
    stage === 'identity' || stage === 'social'
      ? 0
      : stage === 'profile'
        ? 1
        : stage === 'goals' || stage === 'review'
          ? 2
          : 3;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="PitchCentric home">
          <Image
            src="/images/pitchcentric/logo.png"
            alt="PitchCentric"
            width={184}
            height={44}
            priority
          />
        </Link>
        <span>
          <span className={styles.liveDot} /> Your next conversation starts here
        </span>
        <Link href="/" className={styles.back}>
          <ArrowLeftIcon /> Back
        </Link>
      </header>
      <main className={styles.layout}>
        <section
          className={styles.conversation}
          aria-label="Your onboarding conversation"
        >
          <div className={styles.heading}>
            <span className={styles.eyebrow}>
              GUIDED DEMO · LIVE MCP TOOLS · NO LANGUAGE MODEL
            </span>
            <h1>Let’s find your people.</h1>
            <p>
              Build your guest profile and see your shows before you sign up.
            </p>
            <p className={styles.note}>
              Guided fallback: these prompts are fixed. Research, social results
              and signup are simulated; your edits run through the real MCP
              tools.
            </p>
          </div>
          <ol className={styles.progress} aria-label="Your progress">
            {['Your website', 'Your story', 'Your audience', 'Your shows'].map(
              (label, i) => (
                <li
                  key={label}
                  aria-current={i === progress ? 'step' : undefined}
                  className={i <= progress ? styles.reached : ''}
                >
                  <span>{i < progress ? <CheckIcon /> : i + 1}</span>
                  {label}
                </li>
              )
            )}
          </ol>
          <div
            className={styles.transcript}
            role="log"
            aria-label="Conversation history"
          >
            {messages.map((m, i) => (
              <div
                className={m.role === 'user' ? styles.user : styles.assistant}
                key={i}
              >
                {m.role === 'assistant' && (
                  <span className={styles.avatar}>
                    <SparklesIcon />
                  </span>
                )}
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          {busy && (
            <div className={styles.working} role="status">
              <span />{' '}
              {draft ? 'Saving your progress…' : 'Opening your conversation…'}
            </div>
          )}
          {error && (
            <div className={styles.error} role="alert">
              {error}
              {!draft && website && (
                <button
                  onClick={() => {
                    boot.current = null;
                    setBusy(true);
                    setError('');
                    setStarted((v) => v + 1);
                  }}
                >
                  Retry connection
                </button>
              )}
              {draft && (
                <button
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await call('get_onboarding_state');
                      if (r.draft) {
                        adopt(r.draft);
                        setStage(nextStage(r.draft));
                        setError('');
                      }
                    } catch {
                      setError(
                        'The saved draft is still unavailable. Please reconnect the MCP service.'
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Reload saved step
                </button>
              )}
            </div>
          )}
          {!website && (
            <Link href="/" className={styles.primary}>
              Add your website <ArrowRightIcon />
            </Link>
          )}
          {draft && (
            <div className={styles.activeStep}>
              {draft.profile.name && stage !== 'identity' && (
                <button
                  className={styles.linkButton}
                  disabled={busy}
                  onClick={() => setStage('identity')}
                >
                  Correct my name or company
                </button>
              )}
              <div className={styles.question}>
                <span className={styles.avatar}>
                  <SparklesIcon />
                </span>
                <p>{prompts[stage]}</p>
              </div>
              <fieldset disabled={busy} className={styles.controls}>
                {stage === 'identity' && (
                  <form onSubmit={identity}>
                    <div className={styles.row}>
                      <label>
                        Your name
                        <input
                          required
                          autoComplete="name"
                          maxLength={100}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Alex Morgan"
                        />
                      </label>
                      <label>
                        Company
                        <input
                          required
                          autoComplete="organization"
                          maxLength={100}
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Your company"
                        />
                      </label>
                    </div>
                    <button className={styles.primary}>
                      Find my profiles <ArrowRightIcon />
                    </button>
                  </form>
                )}
                {stage === 'social' && (
                  <>
                    <p className={styles.note}>
                      Sample profiles for the demo. These are not verified live
                      social accounts.
                    </p>
                    <div className={styles.identities}>
                      {draft.candidates.map((c) => (
                        <label key={c.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={(e) =>
                              setSelected((s) =>
                                e.target.checked
                                  ? [...s, c.id]
                                  : s.filter((id) => id !== c.id)
                              )
                            }
                          />
                          <span className={styles.socialIcon}>
                            {c.platform === 'linkedin'
                              ? 'in'
                              : c.platform === 'youtube'
                                ? '▶'
                                : '𝕏'}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <span>{c.headline}</span>
                            <small>
                              {c.platform} · {c.url.replace('https://', '')}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.primary}
                        disabled={!selected.length}
                        onClick={() =>
                          void act(
                            'confirm_guest_identity',
                            {
                              decision:
                                selected.length === draft.candidates.length
                                  ? 'yes'
                                  : 'some',
                              acceptedIds: selected,
                              expectedVersion: draft.version,
                            },
                            selected.length === draft.candidates.length
                              ? 'Yes, these are me.'
                              : 'These selected profiles are mine.'
                          )
                        }
                      >
                        These are mine <CheckIcon />
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={() =>
                          void act(
                            'confirm_guest_identity',
                            {
                              decision: 'none',
                              acceptedIds: [],
                              expectedVersion: draft.version,
                            },
                            'None of these are mine.'
                          )
                        }
                      >
                        None of these
                      </button>
                    </div>
                  </>
                )}
                {stage === 'profile' && (
                  <form onSubmit={details}>
                    <label>
                      Your role
                      <input
                        required
                        value={role}
                        maxLength={160}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Founder, data leader, author…"
                      />
                    </label>
                    <label>
                      Your story
                      <textarea
                        required
                        rows={3}
                        value={bio}
                        maxLength={600}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="I help small businesses put AI to work. I’d love to share what we’ve learned…"
                      />
                    </label>
                    <label>
                      Your expertise
                      <input
                        required
                        maxLength={600}
                        value={expertise}
                        onChange={(e) => setExpertise(e.target.value)}
                        placeholder="What do people come to you for?"
                      />
                    </label>
                    <label>
                      Relevant experience <small>optional</small>
                      <textarea
                        maxLength={600}
                        value={experience}
                        onChange={(e) => setExperience(e.target.value)}
                        placeholder="Projects, previous roles or lessons you can share"
                      />
                    </label>
                    <label>
                      Media appearances{' '}
                      <small>optional · leave blank to skip</small>
                      <textarea
                        maxLength={600}
                        value={mediaNotes}
                        onChange={(e) => setMediaNotes(e.target.value)}
                        placeholder="Podcast, video or press appearances you want to include"
                      />
                    </label>
                    <label>
                      City <small>optional</small>
                      <input
                        value={city}
                        maxLength={100}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Where are you based?"
                      />
                    </label>
                    <button className={styles.primary}>
                      That’s my story <ArrowRightIcon />
                    </button>
                  </form>
                )}
                {stage === 'goals' && (
                  <form onSubmit={goals}>
                    <label>
                      Topics you could talk about
                      <textarea
                        required
                        rows={2}
                        maxLength={1000}
                        value={topics}
                        onChange={(e) => setTopics(e.target.value)}
                        placeholder="Practical AI, building a business, leadership"
                      />
                      <small>Up to five topics, separated by commas.</small>
                    </label>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => void topicIdeas()}
                    >
                      <SparklesIcon /> Suggest a few topics
                    </button>
                    {suggestions.length > 0 && (
                      <div className={styles.chips}>
                        {suggestions.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setTopics((s) =>
                                Array.from(
                                  new Set([
                                    ...s
                                      .split(',')
                                      .map((x) => x.trim())
                                      .filter(Boolean),
                                    t,
                                  ])
                                )
                                  .slice(0, 5)
                                  .join(', ')
                              )
                            }
                          >
                            {t} +
                          </button>
                        ))}
                      </div>
                    )}
                    <label>
                      Your ideal audience
                      <input
                        required
                        maxLength={200}
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        placeholder="Small business owners, founders, marketers…"
                      />
                    </label>
                    <label>
                      What would a great appearance achieve?
                      <input
                        required
                        maxLength={200}
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder="Share useful lessons and build awareness"
                      />
                    </label>
                    <button className={styles.primary}>
                      Review my profile <ArrowRightIcon />
                    </button>
                  </form>
                )}
                {stage === 'review' && (
                  <>
                    <div className={styles.review}>
                      <h2>{draft.profile.name}</h2>
                      <p>
                        {draft.profile.role} at {draft.profile.companyName}
                      </p>
                      <p>{draft.profile.bio}</p>
                      <p>
                        <strong>Expertise:</strong> {draft.profile.expertise}
                      </p>
                      <p>
                        <strong>Experience:</strong>{' '}
                        {draft.profile.experience || 'Skipped'}
                      </p>
                      <p>
                        <strong>Media:</strong>{' '}
                        {draft.profile.mediaNotes || 'Skipped'}
                      </p>
                      <div className={styles.chips}>
                        {draft.topics.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                      <p>
                        <strong>Audience:</strong> {draft.audience}
                      </p>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.primary}
                        onClick={() =>
                          void act(
                            'complete_onboarding',
                            { confirmed: true, expectedVersion: draft.version },
                            'That looks right. Show me my matches.',
                            'find_podcast_matches'
                          )
                        }
                      >
                        Looks right. Find my shows <ArrowRightIcon />
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={() => setStage('profile')}
                      >
                        Edit my story
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={() => setStage('goals')}
                      >
                        Edit topics
                      </button>
                    </div>
                  </>
                )}
                {(stage === 'matches' ||
                  stage === 'signup' ||
                  stage === 'complete') && (
                  <>
                    <div className={styles.matches}>
                      {draft.matches.map((m, i) => (
                        <article key={m.id}>
                          <div
                            className={`${styles.cover} ${i === 1 ? styles.aqua : i === 2 ? styles.lilac : ''}`}
                          >
                            <MicrophoneIcon />
                            <strong>{m.title}</strong>
                            <small>PODCAST PREVIEW</small>
                          </div>
                          <div>
                            <span className={styles.matchLabel}>
                              A conversation worth exploring
                            </span>
                            <h2>{m.title}</h2>
                            <p>
                              {m.reason
                                .replace(
                                  'Demo editorial fit for',
                                  'A sample fit for'
                                )
                                .replace(' Not a booking probability.', '')}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                    <p className={styles.note}>
                      Fictional shows for this demo. Your profile stays private.
                    </p>
                  </>
                )}
                {stage === 'matches' && (
                  <button
                    className={styles.secondary}
                    onClick={() => setStage('profile')}
                  >
                    Correct my profile
                  </button>
                )}
                {stage === 'matches' && (
                  <div className={styles.signup}>
                    <h2>Your next chapter starts here.</h2>
                    <p>
                      Create an account to keep your profile and these matches
                      together.
                    </p>
                    <div className={styles.actions}>
                      <button
                        className={styles.primary}
                        onClick={() =>
                          void act(
                            'begin_account_creation',
                            {
                              method: 'google',
                              expectedVersion: draft.version,
                            },
                            'Continue with Google.'
                          )
                        }
                      >
                        Continue with Google <ArrowRightIcon />
                      </button>
                      <button
                        className={styles.secondary}
                        onClick={() =>
                          void act(
                            'begin_account_creation',
                            {
                              method: 'email_password',
                              expectedVersion: draft.version,
                            },
                            'Use email and password.'
                          )
                        }
                      >
                        Use email and password
                      </button>
                    </div>
                    <small>Account creation is simulated in this demo.</small>
                  </div>
                )}
                {stage === 'signup' && (
                  <div className={styles.signup}>
                    <h2>
                      {draft.signupMethod === 'google'
                        ? 'Continue with Google'
                        : 'Create your account'}
                    </h2>
                    <p>
                      In the live experience, your secure signup form opens
                      here. For this preview, no password or Google access is
                      needed.
                    </p>
                    <button
                      className={styles.primary}
                      onClick={() =>
                        void act(
                          'finish_demo_account',
                          {},
                          'Create my demo account.'
                        )
                      }
                    >
                      Create demo account <ArrowRightIcon />
                    </button>
                    <button
                      className={styles.secondary}
                      onClick={() =>
                        void act(
                          'cancel_account_creation',
                          { expectedVersion: draft.version },
                          'Cancel signup and keep my matches.'
                        )
                      }
                    >
                      Cancel, keep browsing
                    </button>
                  </div>
                )}
                {stage === 'complete' && (
                  <div className={styles.success}>
                    <CheckIcon />
                    <div>
                      <h2>Your demo account is ready.</h2>
                      <p>
                        Your story and all three matches are saved together for
                        this local session.
                      </p>
                    </div>
                  </div>
                )}
              </fieldset>
            </div>
          )}
          <div ref={end} />
          <footer className={styles.footer}>
            Guided MCP demo · Powered by Noodle Seed{' '}
            <button disabled={busy} onClick={() => void startOver()}>
              Start over
            </button>
          </footer>
        </section>
        <aside className={styles.sidebar} aria-label="Your guest profile">
          <span className={styles.eyebrow}>YOUR STORY, COMING TOGETHER</span>
          <div className={styles.profileIcon}>
            {draft?.profile.name ? draft.profile.name[0] : <MicrophoneIcon />}
          </div>
          <h2>{draft?.profile.name || 'Your next great introduction.'}</h2>
          <p>
            {draft?.profile.role
              ? `${draft.profile.role} · ${draft.profile.companyName}`
              : 'A little context helps us find the right conversations for you.'}
          </p>
          <div className={styles.website}>
            <GlobeAltIcon />
            <span>{website.replace('https://', '').replace(/\/$/, '')}</span>
            <CheckIcon />
          </div>
          {draft?.company && (
            <div className={styles.fact}>
              <small>ABOUT YOUR COMPANY · DEMO SOURCE</small>
              <p>{draft.company.summary}</p>
            </div>
          )}
          {draft?.profile.bio && (
            <div className={styles.fact}>
              <small>YOUR STORY</small>
              <p>{draft.profile.bio}</p>
            </div>
          )}
          {!!draft?.topics.length && (
            <div className={styles.fact}>
              <small>WHAT YOU WANT TO TALK ABOUT</small>
              <div className={styles.chips}>
                {draft.topics.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {draft?.audience && (
            <div className={styles.fact}>
              <small>YOUR AUDIENCE</small>
              <p>{draft.audience}</p>
            </div>
          )}
          <div className={styles.privateNote}>
            <CheckIcon />{' '}
            {draft?.signup === 'demo-created'
              ? 'Saved to your demo account'
              : 'Private until you choose to share'}
          </div>
          <p className={styles.demoNote}>
            Research uses sample data. Your choices and profile are saved
            through the local onboarding service.
          </p>
        </aside>
      </main>
    </div>
  );
}
