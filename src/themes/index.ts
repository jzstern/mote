import type { Theme, ThemeId } from './types';
import { sumi } from './sumi';
import { botanical } from './botanical';
import { riso } from './riso';
import { tidepool } from './tidepool';
import { aurora } from './aurora';

export type { Theme, ThemeId, RGB } from './types';

declare global {
  interface Window {
    __MOTE_THEME__?: string;
  }
}

export const THEMES: Record<ThemeId, Theme> = { sumi, botanical, riso, tidepool, aurora };
export const THEME_LIST: readonly Theme[] = [sumi, botanical, riso, tidepool, aurora];
export const DEFAULT_THEME_ID: ThemeId = 'sumi';

const STORAGE_KEY = 'mote.theme';

function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(THEMES, v);
}

/** Precedence: ?theme= query → injected window.__MOTE_THEME__ → localStorage → default. */
export function resolveThemeId(
  search?: string,
  injected?: string,
): ThemeId {
  const qs = search ?? (typeof location !== 'undefined' ? location.search : '');
  const q = new URLSearchParams(qs).get('theme');
  if (isThemeId(q)) return q;

  const inj = injected ?? (typeof window !== 'undefined' ? window.__MOTE_THEME__ : undefined);
  if (isThemeId(inj)) return inj;

  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (isThemeId(stored)) return stored;
  } catch {
    /* private mode / unavailable */
  }
  return DEFAULT_THEME_ID;
}

export function resolveTheme(search?: string, injected?: string): Theme {
  return THEMES[resolveThemeId(search, injected)];
}

export function rememberTheme(id: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function themeEntryUrl(id: ThemeId): string {
  const dev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (dev) return `?theme=${id}`;
  return id === DEFAULT_THEME_ID ? '/' : `/${id}.html`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, type?: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (type) el.type = type;
}

function applyFont(href: string): void {
  let el = document.getElementById('mote-font') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.id = 'mote-font';
    el.rel = 'stylesheet';
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Apply a theme's identity + chrome variables to the live document. */
export function applyThemeToHead(theme: Theme): void {
  if (typeof document === 'undefined') return;

  document.title = theme.og.title;

  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.chrome)) root.style.setProperty(k, v);
  root.style.setProperty('--mote-font', theme.font.cssStack);
  root.style.setProperty('--mote-wordmark-spacing', theme.font.wordmarkSpacing);
  root.style.setProperty('--mote-wordmark-weight', String(theme.font.wordmarkWeight));
  root.style.colorScheme = theme.scheme;

  upsertMeta('name', 'theme-color', theme.og.themeColor);
  upsertMeta('name', 'description', theme.og.description);
  upsertMeta('property', 'og:title', theme.og.title);
  upsertMeta('property', 'og:description', theme.og.description);
  upsertMeta('property', 'og:image', theme.og.image);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', theme.og.title);
  upsertMeta('name', 'twitter:description', theme.og.description);
  upsertMeta('name', 'twitter:image', theme.og.image);

  upsertLink('icon', theme.favicon, 'image/svg+xml');
  applyFont(theme.font.googleHref);
}
