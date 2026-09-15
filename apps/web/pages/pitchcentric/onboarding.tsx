/* eslint-disable i18next/no-literal-string */
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { NextPageWithLayout } from 'types';
import { PitchOnboarding } from '@/components/pitchcentric/PitchOnboarding';
const Assistant = dynamic(
  () => import('@/components/pitchcentric/LiveAssistant'),
  { ssr: false }
);
const Onboarding: NextPageWithLayout = () => {
  const router = useRouter();
  const [website, setWebsite] = useState('');
  useEffect(() => {
    if (router.isReady)
      setWebsite(
        typeof router.query.website === 'string'
          ? router.query.website
          : sessionStorage.getItem('pitchcentric.website') || ''
      );
  }, [router.isReady, router.query.website]);
  const live =
    !!process.env.NEXT_PUBLIC_PITCHCENTRIC_EMBED_ID &&
    router.query.mode !== 'guided';
  return (
    <>
      <Head>
        <title>Your guest profile · PitchCentric</title>
      </Head>
      {live ? (
        <Assistant website={website} />
      ) : (
        router.isReady && <PitchOnboarding website={website} />
      )}
    </>
  );
};
Onboarding.getLayout = (page) => page;
export default Onboarding;
