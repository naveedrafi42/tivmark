import type { ToolResult } from './contracts';

export const onboardingTools = new Set([
  'get_onboarding_state',
  'research_guest',
  'confirm_guest_identity',
  'enrich_companies',
  'update_guest_profile',
  'discover_media',
  'curate_media',
  'suggest_topics',
  'set_outreach_preferences',
  'complete_onboarding',
  'find_podcast_matches',
  'begin_account_creation',
  'finish_demo_account',
  'cancel_account_creation',
]);
const endpoint = 'http://127.0.0.1:4011/o/local/pitchcentric/dev/mcp';
type Proposal = { result: ToolResult & { write: boolean }; revision: number };
async function invoke(
  name: string,
  args: Record<string, unknown>
): Promise<Proposal> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 429) throw new Error('MCP_RATE_LIMIT');
  if (!response.ok) {
    console.warn('[PitchCentric MCP]', name, 'HTTP', response.status);
    throw new Error('MCP unavailable.');
  }
  const raw = await response.text();
  const payload = response.headers
    .get('content-type')
    ?.includes('text/event-stream')
    ? JSON.parse(
        raw
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5))
          .find((line) => line.includes('"result"')) || '{}'
      )
    : JSON.parse(raw);
  if (
    payload.error ||
    payload.result?.isError ||
    !payload.result?.structuredContent?.result
  ) {
    console.warn(
      '[PitchCentric MCP]',
      name,
      'error',
      payload.error?.code,
      payload.result?.isError ? 'tool-error' : 'missing-result'
    );
    throw new Error('MCP action failed.');
  }
  return payload.result.structuredContent;
}
/** The host owns routing and scope. A submitted form approves this exact local change. */
export async function callOnboardingTool(
  name: string,
  args: Record<string, unknown>,
  draftKey: string
): Promise<ToolResult> {
  if (!onboardingTools.has(name)) throw new Error('Unsupported action.');
  const proposal = await invoke(name, { ...args, draftKey });
  if (!proposal.result.write) return proposal.result;
  // Use only the service's exact proposal, never a browser-supplied state snapshot.
  const saved = await invoke('save_guest_draft', {
    proposal: proposal.result,
    expectedRevision: proposal.revision,
    draftKey,
  });
  return saved.result;
}
