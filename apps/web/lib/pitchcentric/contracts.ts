export type GuestDraft = {
  version: number;
  profile: {
    name?: string;
    companyName?: string;
    companyUrl?: string;
    expertise?: string;
    experience?: string;
    mediaNotes?: string;
    role?: string;
    bio?: string;
    city?: string;
  };
  company?: { name: string; url: string; summary: string; source: string };
  candidates: {
    id: string;
    platform: string;
    url: string;
    name: string;
    headline: string;
    decision: 'proposed' | 'accepted' | 'rejected';
  }[];
  topics: string[];
  audience: string;
  objective: string;
  language: string;
  media: { id: string; title: string; url: string; selected: boolean }[];
  reviewedVersion: number;
  matchVersion: number;
  matches: { id: string; title: string; reason: string }[];
  signup: 'none' | 'pending' | 'demo-created';
  signupMethod?: string;
};
export type ToolResult = {
  status: string;
  message: string;
  draft: GuestDraft | null;
  extra: Record<string, unknown>;
  mock: true;
};
export function normalizeWebsite(value: string): string {
  const raw = value.trim();
  if (!raw || raw.length > 2000)
    throw new Error('Enter your company or personal website.');
  const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !url.hostname.includes('.') ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use a public website, such as yourcompany.com, without a query or sign-in link.'
    );
  return url.href;
}
