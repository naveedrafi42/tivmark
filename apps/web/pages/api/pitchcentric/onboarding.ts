import { randomUUID } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { callOnboardingTool, onboardingTools } from '@/lib/pitchcentric/mcp';
import { normalizeWebsite } from '@/lib/pitchcentric/contracts';

const cookie = 'pitchcentric_demo_draft';
const validKey = (key: unknown): key is string =>
  typeof key === 'string' && /^[a-f0-9-]{36}$/.test(key);
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store');
  // This credential-free guided adapter is a loopback demo only. Hosted access uses Noodle's caller scope.
  if (
    process.env.PITCHCENTRIC_LOCAL_DEMO !== 'true' ||
    !['localhost:4002', '127.0.0.1:4002'].includes(req.headers.host || '')
  )
    return res.status(404).json({ error: 'Local demo is disabled.' });
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Use POST.' });
  if (req.headers.origin !== `http://${req.headers.host}`)
    return res.status(403).json({ error: 'Invalid origin.' });
  if (!req.headers['content-type']?.startsWith('application/json'))
    return res.status(415).json({ error: 'Use JSON.' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return res.status(400).json({ error: 'Invalid request.' });
  const existing = req.cookies[cookie];
  let key = validKey(existing) ? existing : randomUUID();
  const setCookie = (value: string, age = 86400) =>
    res.setHeader(
      'Set-Cookie',
      `${cookie}=${value}; HttpOnly; SameSite=Strict; Path=/api/pitchcentric; Max-Age=${age}`
    );
  try {
    if (body.action === 'reset') {
      setCookie('', 0);
      return res.json({ reset: true });
    }
    if (body.action === 'start') {
      let website: string;
      try {
        website = normalizeWebsite(body.website || '');
      } catch {
        return res
          .status(400)
          .json({ error: 'Enter a valid public HTTPS website.' });
      }
      let result = await callOnboardingTool('get_onboarding_state', {}, key);
      if (!result.draft || result.status === 'unavailable') throw new Error();
      if (result.draft.profile.companyUrl !== website) {
        if (result.draft.version) key = randomUUID();
        result = await callOnboardingTool(
          'enrich_companies',
          { website, expectedVersion: 0 },
          key
        );
      }
      setCookie(key);
      return res.json({ result });
    }
    if (!validKey(existing))
      return res
        .status(409)
        .json({ error: 'Start with your website to open a private draft.' });
    if (
      !onboardingTools.has(body.action) ||
      !body.args ||
      typeof body.args !== 'object' ||
      Array.isArray(body.args) ||
      'draftKey' in body.args
    )
      return res.status(400).json({ error: 'Invalid onboarding action.' });
    const result = await callOnboardingTool(body.action, body.args, key);
    return res.json({ result });
  } catch (error) {
    if (error instanceof Error && error.message === 'MCP_RATE_LIMIT')
      return res.status(429).json({
        error:
          'This demo’s hourly request limit has been reached. Please try again later, then reload your saved progress before retrying.',
      });
    return res.status(503).json({
      error:
        'The local MCP service could not complete that step. Reconnect, then reload your saved progress.',
    });
  }
}
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };
