export const resolveAssetUrl = (value?: string | null, apiBaseUrl?: string): string => {
  if (!value) return '';

  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  const normalizedApiBase = (apiBaseUrl || '').replace(/\/?api\/?$/, '');

  if (value.startsWith('/uploads')) {
    return `${normalizedApiBase}${value}`;
  }

  if (value.startsWith('/')) {
    return `${normalizedApiBase}${value}`;
  }

  return value;
};
