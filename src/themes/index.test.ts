import { describe, it, expect, afterEach } from 'vitest';
import {
  THEME_LIST,
  THEMES,
  DEFAULT_THEME_ID,
  resolveThemeId,
  resolveTheme,
} from './index';
import type { VoiceType } from '../engine/types';

const VOICES: VoiceType[] = ['peach', 'gold', 'rose', 'lilac', 'aqua', 'sky'];

describe('theme registry', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('has five themes with sumi as default', () => {
    expect(THEME_LIST).toHaveLength(5);
    expect(DEFAULT_THEME_ID).toBe('sumi');
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it('every theme defines all six voice colors and identity fields', () => {
    for (const t of THEME_LIST) {
      for (const v of VOICES) {
        const c = t.render.palette[v];
        expect(c, `${t.id}.${v}`).toHaveLength(3);
        for (const ch of c) {
          expect(ch).toBeGreaterThanOrEqual(0);
          expect(ch).toBeLessThanOrEqual(255);
        }
      }
      expect(t.favicon).toMatch(/\/favicons\/.+\.svg$/);
      expect(t.og.image).toMatch(/\/og\/.+\.(png|svg)$/);
      expect(t.font.googleHref).toContain('fonts.googleapis.com');
      expect(t.chrome['--mote-bg']).toBeTruthy();
    }
  });

  it('resolves the query param first', () => {
    expect(resolveThemeId('?theme=aurora', 'botanical')).toBe('aurora');
  });

  it('falls back to the injected theme when there is no query', () => {
    expect(resolveThemeId('', 'botanical')).toBe('botanical');
  });

  it('ignores unknown ids and falls back to the default', () => {
    expect(resolveThemeId('?theme=nope', undefined)).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme('?theme=nope').id).toBe(DEFAULT_THEME_ID);
  });

  it('reads localStorage when no query or injected theme', () => {
    const store: Record<string, string> = { 'mote.theme': 'riso' };
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    };
    expect(resolveThemeId('', undefined)).toBe('riso');
  });
});
