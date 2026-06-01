import type { Request } from 'express';

const DEFAULT_ALLOWED_IPS = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '110.38.247.29',  // Office IP
  '110.38.254.0/24'  // Office subnet observed in recent logins
];

const normalizeIp = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
};

const ipv4ToInt = (ip: string) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
};

const isIpv4CidrMatch = (ip: string, cidr: string) => {
  const [rangeIp, prefixValue] = cidr.split('/');
  const prefix = Number(prefixValue);
  if (!rangeIp || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipInt = ipv4ToInt(normalizeIp(ip));
  const rangeInt = ipv4ToInt(normalizeIp(rangeIp));
  if (ipInt === null || rangeInt === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
};

const isIpAllowed = (clientIp: string, allowedEntry: string) => {
  const ip = normalizeIp(clientIp);
  const entry = normalizeIp(allowedEntry);

  if (!entry) return false;
  if (entry.includes('/')) {
    return isIpv4CidrMatch(ip, entry);
  }

  return ip === entry;
};

export const getClientIp = (req: Request) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return normalizeIp(firstIp);
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const firstIp = forwardedFor[0]?.split(',')[0]?.trim();
    if (firstIp) return normalizeIp(firstIp);
  }

  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
};

export const getAllowedOfficeIps = () => {
  const configured = process.env.OFFICE_ALLOWED_IPS?.split(',').map((item) => item.trim()).filter(Boolean) || [];
  return Array.from(new Set([...DEFAULT_ALLOWED_IPS, ...configured]));
};

export const isOfficeIpAllowed = (clientIp: string) => {
  const allowedIps = getAllowedOfficeIps();
  return allowedIps.some((entry) => isIpAllowed(clientIp, entry));
};

export const ensureOfficeAccess = (req: Request) => {
  const clientIp = getClientIp(req);
  return {
    clientIp,
    allowed: isOfficeIpAllowed(clientIp),
    allowedIps: getAllowedOfficeIps()
  };
};
