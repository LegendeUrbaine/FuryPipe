import { describe, expect, it } from 'vitest';

import {
  FURYPIPE_PUBLIC_SITE_FORMAT,
  FURYPIPE_PUBLIC_SITE_LOCALES,
  FURYPIPE_PUBLIC_SITE_ROUTES,
  renderFuryPipePublicSitePage,
  type FuryPipePublicSiteLocale,
  type FuryPipePublicSiteRoute,
} from '../src/web/public-site.js';

describe('FuryPipe public website foundation', () => {
  it('renders every planned public route in French and English deterministically', () => {
    for (const locale of FURYPIPE_PUBLIC_SITE_LOCALES) {
      for (const path of FURYPIPE_PUBLIC_SITE_ROUTES) {
        const first = renderFuryPipePublicSitePage({
          baseUrl: 'https://furypipe.example/',
          path,
          locale,
        });
        const second = renderFuryPipePublicSitePage({
          baseUrl: 'https://furypipe.example/',
          path,
          locale,
        });

        expect(first.format).toBe(FURYPIPE_PUBLIC_SITE_FORMAT);
        expect(first.sha256).toBe(second.sha256);
        expect(first.html).toBe(second.html);
        expect(first.canonicalUrl).toBe('https://furypipe.example' + path);
        expect(first.externalScripts).toEqual([]);
        expect(first.deploymentClaim).toBe('NOT_DEPLOYED');
      }
    }
  });

  it('reuses the official FuryPipe brand primitives and creator identity', () => {
    const page = renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/about',
      locale: 'fr',
    });

    expect(page.html).toContain('data-brand="furypipe"');
    expect(page.html).toContain('data-brand="furypipe-monogram"');
    expect(page.html).toContain('data-brand="furypipe-wordmark"');
    expect(page.html).toContain('LégendeUrbaine');
    expect(page.html).toContain('BUILD · AUTOMATE · CREATE · BEYOND');
    expect(page.html).toContain('data-deployment="not-deployed"');
  });

  it('ships a static, script-free, restrictive page shell', () => {
    const page = renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/',
      locale: 'en',
    });

    expect(page.html).not.toContain('<script');
    expect(page.html).toContain("default-src &#39;none&#39;");
    expect(page.html).toContain("connect-src &#39;none&#39;");
    expect(page.html).toContain("form-action &#39;none&#39;");
    expect(page.html).toContain('<main id="content"');
    expect(page.html).toContain('class="skip"');
    expect((page.html.match(/<h1>/gu) ?? []).length).toBe(1);
  });

  it('keeps FuryAI explicitly roadmap-only and download claims conservative', () => {
    const furyAi = renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/furyai',
      locale: 'fr',
    });
    const download = renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/download',
      locale: 'en',
    });

    expect(furyAi.html).toContain('NON ENCORE LIVRÉ');
    expect(download.html).toContain('does not claim that a new installer or Web release already exists');
  });

  it('rejects non-HTTPS, credential-bearing, path-bearing and malformed base URLs', () => {
    const invalid = [
      'http://furypipe.example/',
      'https://user:pass@furypipe.example/',
      'https://furypipe.example/base/',
      'not-a-url',
    ];

    for (const baseUrl of invalid) {
      expect(() => renderFuryPipePublicSitePage({
        baseUrl,
        path: '/',
        locale: 'fr',
      })).toThrow();
    }
  });

  it('rejects unknown routes and locales at runtime', () => {
    expect(() => renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/admin' as FuryPipePublicSiteRoute,
      locale: 'fr',
    })).toThrow('unsupported FuryPipe public site route');

    expect(() => renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/',
      locale: 'de' as FuryPipePublicSiteLocale,
    })).toThrow('unsupported FuryPipe public site locale');
  });

  it('marks the current page in navigation without client-side JavaScript', () => {
    const page = renderFuryPipePublicSitePage({
      baseUrl: 'https://furypipe.example/',
      path: '/developers',
      locale: 'en',
    });

    expect(page.html).toContain('href="/developers?lang=en" aria-current="page"');
    expect(page.html).not.toContain('onclick=');
  });
});
