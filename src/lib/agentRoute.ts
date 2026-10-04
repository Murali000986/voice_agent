const WORKSPACE_SLUG = 'bask-digital-agency';

export function agentPathFor(name: string, id: string): string {
  const agentSlug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'agent';
  return `/${WORKSPACE_SLUG}/${agentSlug}-${id}`;
}

export function agentIdFromPath(pathname: string): string | null {
  const [workspace, route] = pathname.split('/').filter(Boolean);
  if (workspace !== WORKSPACE_SLUG || !route) return null;
  const id = route.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
  return id || null;
}
