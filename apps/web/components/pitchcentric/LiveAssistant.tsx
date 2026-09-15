/* eslint-disable i18next/no-literal-string */
import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { NoodleAssistant } from '@noodleseed/assistant/react';
import type { NoodleAssistantElement } from '@noodleseed/assistant';
import styles from './pitch-onboarding.module.css';
export default function LiveAssistant({ website }: { website: string }) {
  const ref = useRef<NoodleAssistantElement | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/">
          <Image
            src="/images/pitchcentric/logo.png"
            alt="PitchCentric"
            width={184}
            height={44}
          />
        </Link>
        <span>Your next conversation starts here</span>
      </header>
      <main style={{ maxWidth: 1050, margin: '0 auto', padding: '40px 20px' }}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>
            YOUR STORY. YOUR AUDIENCE. YOUR SHOWS.
          </span>
          <h1>Let’s find your people.</h1>
          <p>Website: {website}</p>
          <p>
            Company research, social profiles, matches and signup use clearly
            labelled demo integrations.
          </p>
        </div>
        {!started && (
          <button
            className={styles.primary}
            disabled={!ready || !website}
            onClick={async () => {
              if (!ref.current) return;
              setStarted(true);
              try {
                await ref.current.sendMessage(
                  `Find my shows. My website is ${website}. Research this website, save it to my anonymous draft, then ask only for missing information. Show my profile and podcast matches before offering signup.`
                );
              } catch {
                setError(
                  'The assistant could not start. Check the model configuration or use the guided demo.'
                );
              }
            }}
          >
            Begin with my website →
          </button>
        )}
        <NoodleAssistant
          ref={ref}
          embedId={process.env.NEXT_PUBLIC_PITCHCENTRIC_EMBED_ID}
          serviceUrl={process.env.NEXT_PUBLIC_PITCHCENTRIC_SERVICE_URL}
          open
          theme="light"
          pageContext={{
            route: '/pitchcentric/onboarding',
            surface: 'guest_onboarding',
            website,
          }}
          onReady={() => setReady(true)}
          onError={() =>
            setError(
              'The assistant is unavailable. Your saved draft has not been replaced.'
            )
          }
          appearance={{
            light: { primaryButton: { surface: '#B0D641', text: '#192320' } },
          }}
        />
        {error && <p role="alert">{error}</p>}
        <p className={styles.note}>
          <Link
            href={{
              pathname: '/pitchcentric/onboarding',
              query: { website, mode: 'guided' },
            }}
          >
            Open a separate guided demo (no model required)
          </Link>
        </p>
      </main>
    </div>
  );
}
