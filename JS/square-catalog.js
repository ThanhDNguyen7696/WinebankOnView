// Shared loader for the cellar wines served by /api/square-catalog.
export async function loadSquareCellar() {
  const response = await fetch('/api/square-catalog', { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body.items || [];
}
