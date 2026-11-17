const CREATIVE_ROLE_SLUGS = new Set([
  'content_creator',
  'video_editor',
  'graphic_designer',
]);

export const normalizeRoleSlug = (role: string | null | undefined) =>
  (role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const isCreativeRole = (role: string | null | undefined) =>
  CREATIVE_ROLE_SLUGS.has(normalizeRoleSlug(role));
