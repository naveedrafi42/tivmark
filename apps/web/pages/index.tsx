import Head from 'next/head';
import PitchcentricHome from '@/components/pitchcentric/Home';
import { getCsrfToken } from 'next-auth/react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';

import AuthPortal from '@/components/auth/AuthPortal';
import { authProviderEnabled } from '@/lib/auth';
import env from '@/lib/env';
import { getSession } from '@/lib/session';
import type { NextPageWithLayout } from 'types';
import {
  ONBOARDING_BLUEPRINT_COOKIE,
  parseOnboardingBlueprint,
  safeCallbackUrl,
} from '@/lib/onboarding';

const Home: NextPageWithLayout<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = (props) => {
  if (props.pitchcentricDemo) return <PitchcentricHome />;
  const {
    csrfToken,
    authProviders,
    recaptchaSiteKey,
    initialTab,
    onboardingBlueprint,
  } = props;
  return (
    <>
      <Head>
        <title>
          {initialTab === 'signup'
            ? 'Create Account | Tivmark'
            : 'Sign In | Tivmark'}
        </title>
      </Head>
      <AuthPortal
        csrfToken={csrfToken}
        authProviders={authProviders}
        recaptchaSiteKey={recaptchaSiteKey}
        initialTab={initialTab}
        onboardingBlueprint={onboardingBlueprint ?? undefined}
      />
    </>
  );
};

Home.getLayout = (page) => page;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  if (
    process.env.PITCHCENTRIC_LOCAL_DEMO === 'true' ||
    process.env.PITCHCENTRIC_DEMO_ENABLED === 'true'
  ) {
    return { props: { pitchcentricDemo: true as const } };
  }
  const session = await getSession(context.req, context.res);
  const onboardingBlueprint = parseOnboardingBlueprint(
    context.req.cookies[ONBOARDING_BLUEPRINT_COOKIE]
  );

  if (session) {
    return {
      redirect: {
        destination: safeCallbackUrl(
          context.query.callbackUrl,
          onboardingBlueprint ? '/onboarding' : env.redirectIfAuthenticated
        ),
        permanent: false,
      },
    };
  }

  const { locale, query } = context;

  return {
    props: {
      pitchcentricDemo: false as const,
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
      csrfToken: (await getCsrfToken(context)) || null,
      authProviders: authProviderEnabled(),
      recaptchaSiteKey: env.recaptcha.siteKey,
      initialTab:
        query.tab === 'signup' ? ('signup' as const) : ('login' as const),
      onboardingBlueprint: onboardingBlueprint ?? null,
    },
  };
};

export default Home;
