import { describe, expect, it } from 'vitest';
import { getLandmark} from '../world';

describe('getLandmark', () => {
  it('returns the landmark when given a known valid ID', () => {
    const id = 'blossom-plaza';
    const landmark = getLandmark(id);
    expect(landmark).toBeDefined();
    expect(landmark?.id).toBe(id);
    expect(landmark?.name).toBe('Blossom Plaza');
  });

  it('returns undefined when given an unknown ID', () => {
    const id = 'non-existent-landmark-12345';
    const landmark = getLandmark(id);
    expect(landmark).toBeUndefined();
  });
});
