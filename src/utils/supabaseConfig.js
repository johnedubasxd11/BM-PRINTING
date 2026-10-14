// Reports whether real Supabase credentials are present in the build.
// The documented placeholders (YOUR_PROJECT / YOUR_PUBLIC_ANON_KEY) count as
// unconfigured so the UI can skip the provider call entirely instead of
// letting the browser surface a DNS failure as "Failed to fetch".
export function isSupabaseConfigured() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return false;
  if (/YOUR_PROJECT|YOUR_PUBLIC/i.test(url) || /YOUR_PUBLIC/i.test(key)) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
