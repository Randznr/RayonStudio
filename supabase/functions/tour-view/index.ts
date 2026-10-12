// Client UUID links are bearer capabilities. The public sample has a known ID.
// No catalog endpoint, public bucket, or permanent asset URL is exposed here.
const base = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers = {apikey: secret, Authorization: `Bearer ${secret}`};
const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Expose-Headers': 'X-Tour-Remaining-Ms, X-Tour-Revision',
  'Cache-Control': 'no-store, private', 'Content-Type': 'application/json'};
const reply = (status: number, message: string) => new Response(JSON.stringify({message}), {status, headers: cors});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
  if (req.method !== 'GET') return reply(405, 'Method not allowed.');
  try {
    const url = new URL(req.url), id = url.searchParams.get('id') || '';
    if (id !== 'sample' && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) return reply(404, 'Tour unavailable.');
    const result = await fetch(`${base}/rest/v1/rayon_tours?id=eq.${id}&select=object_path,revision,published,expires_at`, {headers});
    if (!result.ok) return reply(503, 'Unable to check this tour. Please try again.');
    const [tour] = await result.json();
    if (!tour || !tour.published) return reply(404, 'Tour unavailable. Contact the studio for a viewing link.');
    const remaining = () => tour.expires_at ? Date.parse(tour.expires_at) - Date.now() : -1;
    if (tour.expires_at && remaining() <= 0) return reply(410, 'This tour has expired. Contact the studio to extend access.');
    const responseHeaders = () => ({...cors, 'X-Tour-Remaining-Ms': String(remaining()), 'X-Tour-Revision': tour.revision});
    if (url.searchParams.get('status') === '1') return new Response(JSON.stringify({revision: tour.revision}), {headers: responseHeaders()});
    const asset = await fetch(`${base}/storage/v1/object/authenticated/rayon-tours/${tour.object_path}`, {headers});
    if (!asset.ok) return reply(503, 'The tour could not load. Please try again.');
    if (tour.expires_at && remaining() <= 0) {await asset.body?.cancel();return reply(410, 'This tour has expired.');}
    return new Response(asset.body, {headers: responseHeaders()});
  } catch {return reply(503, 'The tour could not load. Please try again.');}
});
