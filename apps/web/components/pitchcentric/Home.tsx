/* eslint-disable i18next/no-literal-string */
import Head from 'next/head';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import type { NextPageWithLayout } from 'types';
import { normalizeWebsite } from '@/lib/pitchcentric/contracts';
import styles from '@/components/pitchcentric/home.module.css';

const Home: NextPageWithLayout = () => {
  const router = useRouter();
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  function start(event: FormEvent) {
    event.preventDefault();
    try {
      const url = normalizeWebsite(website);
      sessionStorage.setItem('pitchcentric.website', url);
      void router.push({
        pathname: '/pitchcentric/onboarding',
        query: { website: url },
      });
    } catch {
      setError('Enter a website such as yourcompany.com.');
    }
  }
  return (
    <div className={styles.page}>
      <Head>
        <title>PitchCentric · Find your next great conversation</title>
        <meta
          name="description"
          content="Build your guest profile and discover podcasts before you create an account."
        />
      </Head>
      <header className={styles.header}>
        <Image
          src="/images/pitchcentric/logo.png"
          alt="PitchCentric"
          width={184}
          height={44}
          priority
        />
        <nav>
          <a href="#how">How it works</a>
          <span>Conversational onboarding demo</span>
        </nav>
      </header>
      <main>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>
              YOUR EXPERTISE. THE RIGHT AUDIENCE.
            </span>
            <h1>
              Your story deserves
              <br />a <em>bigger stage.</em>
            </h1>
            <p>
              Meet the podcasts that need your perspective.
              <br />
              Start with your website. We’ll build the rest together.
            </p>
            <form onSubmit={start}>
              <label htmlFor="website">Your company or personal website</label>
              <div className={styles.inputRow}>
                <span aria-hidden="true">↗</span>
                <input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="yourcompany.com"
                  autoComplete="url"
                  required
                  maxLength={2000}
                />
                <button>
                  Find my shows <span aria-hidden="true">→</span>
                </button>
              </div>
              {error && <p role="alert">{error}</p>}
            </form>
            <small>
              No account needed. See your profile and matches first.
            </small>
            <button
              className={styles.sample}
              onClick={() => setWebsite('https://brightwave.example')}
            >
              Try the fictional Brightwave sample ↗
            </button>
          </div>
          <div className={styles.art}>
            <div className={styles.orbit} />
            <Image
              src="/images/pitchcentric/microphone.png"
              alt="A studio microphone ready for your next conversation"
              width={650}
              height={650}
              priority
            />
            <div className={styles.note}>
              <span>MADE FOR YOUR NEXT CHAPTER</span>
              <strong>A voice worth hearing.</strong>
              <p>
                From what you know
                <br />
                to who needs to hear it.
              </p>
            </div>
          </div>
        </section>
        <section id="how" className={styles.how}>
          <span className={styles.eyebrow}>
            LESS FILLING IN. MORE FINDING YOUR FIT.
          </span>
          <h2>One conversation. Your next opportunity.</h2>
          <div>
            {[
              [
                '01',
                'Start with your world',
                'Share your website. Review the company context we can find.',
              ],
              [
                '02',
                'Make it your story',
                'Confirm your identity and shape an editable guest profile.',
              ],
              [
                '03',
                'Meet your shows',
                'Explore relevant matches, then choose an account to save them.',
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        PitchCentric × Noodle Seed{' '}
        <span>
          Research and podcast inventory are clearly labelled demo data.
        </span>
      </footer>
    </div>
  );
};
Home.getLayout = (page) => page;
export default Home;
