import { describe, it, expect } from 'vitest';
import { resolveAssetUrl } from './resolveAssetUrl';

describe('resolveAssetUrl', () => {
  it('resolves backend-upload URLs from a relative /uploads path', () => {
    expect(resolveAssetUrl('/uploads/payment-proofs/test.png', 'http://localhost:5001/api')).toBe('http://localhost:5001/uploads/payment-proofs/test.png');
  });

  it('keeps already absolute URLs unchanged', () => {
    const url = 'https://cdn.example.com/proof.png';
    expect(resolveAssetUrl(url, 'http://localhost:5001/api')).toBe(url);
  });

  it('returns an empty string for missing values', () => {
    expect(resolveAssetUrl('', 'http://localhost:5001/api')).toBe('');
  });
});
