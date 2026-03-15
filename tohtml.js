const fs = require('fs');
const path = require('path');
const { site } = require('./site-data');

const outRoot = __dirname;
const localeCodes = Object.keys(site.locales);
const pageIds = Object.keys(site.pageRoutes);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(markdown) {
  return escapeHtml(markdown).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
}

function stripMarkdown(markdown) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

function ensureTrailingSlash(route) {
  return route === '/' ? route : route.replace(/\/?$/, '/');
}

function routeDir(route) {
  return ensureTrailingSlash(route).replace(/^\/|\/$/g, '');
}

function routeOutputPath(route) {
  const cleanDir = routeDir(route);
  return cleanDir ? path.join(outRoot, cleanDir, 'index.html') : path.join(outRoot, 'index.html');
}

function absoluteUrl(route) {
  const cleanRoute = ensureTrailingSlash(route).replace(/^\//, '');
  return new URL(cleanRoute, `${site.siteUrl}/`).toString();
}

function relativeRoute(fromRoute, toRoute) {
  const fromDir = routeDir(fromRoute) || '.';
  const toDir = routeDir(toRoute) || '.';
  const relative = path.posix.relative(fromDir, toDir);
  return relative ? `${relative}/` : './';
}

function relativeAsset(fromRoute, assetName) {
  const fromDir = routeDir(fromRoute) || '.';
  return path.posix.relative(fromDir, assetName);
}

function parseReadme(markdown) {
  const lines = markdown.split(/\r?\n/);
  const model = {
    greeting: '',
    heroTitle: '',
    intro: '',
    now: [],
    previously: [],
    projects: {},
    locations: [],
  };

  let currentSection = null;
  let currentProjectGroup = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith('### ')) {
      model.greeting = line.slice(4).trim();
      continue;
    }

    if (line.startsWith('#### ')) {
      currentSection = line.slice(5).trim();
      currentProjectGroup = null;

      if (!model.heroTitle) {
        model.heroTitle = currentSection;
        currentSection = 'hero';
      }

      continue;
    }

    if (line.startsWith('##### ')) {
      currentProjectGroup = line.slice(6).trim();
      model.projects[currentProjectGroup] = [];
      continue;
    }

    if (line.startsWith('- ')) {
      const item = line.slice(2).trim();

      if (currentSection === 'NOW') {
        model.now.push(item);
      } else if (currentSection === 'PREVIOUSLY') {
        model.previously.push(item);
      } else if (currentSection === 'PROJECTS' && currentProjectGroup) {
        model.projects[currentProjectGroup].push(item);
      } else if (currentSection === 'Find me irl') {
        model.locations.push(item);
      }

      continue;
    }

    if (currentSection === 'hero' && !model.intro) {
      model.intro = line;
    }
  }

  return model;
}

function assertLength(actual, expected, label) {
  if (actual.length !== expected.length) {
    throw new Error(`README structure drift detected for ${label}. Expected ${expected.length} items, got ${actual.length}.`);
  }
}

function validateReadmeModel(model) {
  if (!model.greeting || !model.heroTitle || !model.intro) {
    throw new Error('README parsing failed. Expected greeting, hero title, and intro paragraph.');
  }

  assertLength(model.now, site.translations.ca.now, 'now');
  assertLength(model.previously, site.translations.ca.previously, 'previously');
  assertLength(model.locations, site.translations.ca.locations, 'locations');

  const expectedGroups = Object.keys(site.readmeSnapshot.projects);
  const actualGroups = Object.keys(model.projects);
  assertLength(actualGroups, expectedGroups, 'projectGroups');

  for (const group of expectedGroups) {
    if (!model.projects[group]) {
      throw new Error(`README structure drift detected. Missing project group "${group}".`);
    }

    assertLength(model.projects[group], site.translations.ca.projects[group], `projects.${group}`);
  }
}

function localizedModel(model, locale) {
  if (locale === 'en') {
    return model;
  }

  return {
    greeting: site.translations.ca.greeting,
    heroTitle: site.translations.ca.heroTitle,
    intro: site.translations.ca.intro,
    now: site.translations.ca.now,
    previously: site.translations.ca.previously,
    projects: site.translations.ca.projects,
    locations: site.translations.ca.locations,
  };
}

function projectCard(item) {
  const parts = item.split(/\s+-\s+/);
  const title = parts[0];
  const description = parts.slice(1).join(' - ');

  return `<article class="project-card">
    <h3>${renderInlineMarkdown(title)}</h3>
    ${description ? `<p>${renderInlineMarkdown(description)}</p>` : ''}
  </article>`;
}

function listItems(items) {
  return `<ul class="clean-list">${items
    .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
    .join('')}</ul>`;
}

function readmeSourcePanel(locale) {
  const ui = site.ui[locale];
  return `<section class="panel">
    <div class="note-card">
      <span class="kicker">${escapeHtml(ui.readmeSourceLabel)}</span>
      <p>${escapeHtml(ui.readmeSourceText)}</p>
    </div>
  </section>`;
}

function renderLanguageSwitcher(locale, pageId) {
  const ui = site.ui[locale];
  const links = localeCodes
    .map((code) => {
      const route = site.pageRoutes[pageId];
      const href = relativeRoute(route[locale], route[code]);
      const active = code === locale ? ' active' : '';
      return `<a class="lang-link${active}" href="${href}" lang="${site.locales[code].code}" hreflang="${site.locales[code].code}">${escapeHtml(
        site.locales[code].switcherLabel
      )}</a>`;
    })
    .join('');

  return `<div class="language-switcher" aria-label="${escapeHtml(ui.languageLabel)}"><span class="language-switcher-label">${escapeHtml(
    ui.languageLabel
  )}</span>${links}</div>`;
}

function renderHeader(locale, pageId) {
  const ui = site.ui[locale];
  const nav = site.navOrder
    .map((navId) => {
      const href = relativeRoute(site.pageRoutes[pageId][locale], site.pageRoutes[navId][locale]);
      const active = navId === pageId ? ' active' : '';
      return `<a class="nav-link${active}" href="${href}">${escapeHtml(ui.nav[navId])}</a>`;
    })
    .join('');

  return `<header class="site-header">
    <a class="brand" href="${relativeRoute(site.pageRoutes[pageId][locale], site.pageRoutes.home[locale])}">
      <span class="brand-mark" aria-hidden="true">CM</span>
      <span class="brand-text">
        <span class="brand-name">${escapeHtml(site.brandName)}</span>
        <span class="brand-meta">${escapeHtml(ui.brandMeta)}</span>
      </span>
    </a>
    <nav class="header-nav" aria-label="Primary">
      ${nav}
    </nav>
    ${renderLanguageSwitcher(locale, pageId)}
  </header>`;
}

function renderFooter(locale, pageId) {
  const ui = site.ui[locale];
  const nav = site.navOrder
    .map((navId) => {
      const href = relativeRoute(site.pageRoutes[pageId][locale], site.pageRoutes[navId][locale]);
      return `<a class="footer-link" href="${href}">${escapeHtml(ui.nav[navId])}</a>`;
    })
    .join('');

  return `<footer class="site-footer">
    <div class="footer-copy">
      <strong>${escapeHtml(site.brandName)}</strong>
      <p class="footer-text">${escapeHtml(ui.footerBlurb)}</p>
      <div class="footer-meta-row">
        <nav class="footer-nav" aria-label="Footer">
          ${nav}
        </nav>
        <a class="button-secondary" href="${relativeRoute(site.pageRoutes[pageId][locale], site.pageRoutes.contact[locale])}">${escapeHtml(
    ui.footerCta
  )}</a>
      </div>
    </div>
    ${renderLanguageSwitcher(locale, pageId)}
  </footer>`;
}

function heroSection(eyebrow, title, intro, currentRoute, primaryRoute, primaryLabel, secondaryRoute, secondaryLabel) {
  return `<section class="hero">
    <span class="eyebrow">${escapeHtml(eyebrow)}</span>
    <div class="hero-copy">
      <h1>${escapeHtml(stripMarkdown(title))}</h1>
      <p class="hero-summary">${renderInlineMarkdown(intro)}</p>
    </div>
    <div class="hero-actions">
      <a class="button" href="${relativeRoute(currentRoute, primaryRoute)}">${escapeHtml(primaryLabel)}</a>
      <a class="button-secondary" href="${relativeRoute(currentRoute, secondaryRoute)}">${escapeHtml(secondaryLabel)}</a>
    </div>
  </section>`;
}

function ctaPanel(title, body, currentRoute, primaryRoute, primaryLabel, secondaryRoute, secondaryLabel) {
  return `<section class="cta-panel">
    <div class="panel-header">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
    </div>
    <div class="button-row">
      <a class="button" href="${relativeRoute(currentRoute, primaryRoute)}">${escapeHtml(primaryLabel)}</a>
      <a class="button-secondary" href="${relativeRoute(currentRoute, secondaryRoute)}">${escapeHtml(secondaryLabel)}</a>
    </div>
  </section>`;
}

function renderHomePage(model, locale) {
  const ui = site.ui[locale];
  const content = localizedModel(model, locale);
  const currentRoute = site.pageRoutes.home[locale];
  const primaryLocale = 'ca';

  return `<div class="page-grid">
    ${heroSection(
      content.greeting,
      content.heroTitle,
      content.intro,
      currentRoute,
      site.pageRoutes.contact[primaryLocale],
      ui.homePrimaryCta,
      site.pageRoutes.projects[locale],
      ui.homeSecondaryCta
    )}
    <div class="grid-two">
      <section class="panel">
        <div class="note-card">
          <span class="kicker">${escapeHtml(ui.homeNoteLabel)}</span>
          <p>${escapeHtml(ui.homeNoteText)}</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>${escapeHtml(ui.currentFocusTitle)}</h2>
        </div>
        ${listItems(content.now)}
      </section>
    </div>
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(ui.projectsTitle)}</h2>
      </div>
      <div class="project-grid">
        ${Object.values(content.projects)
          .flat()
          .map(projectCard)
          .join('')}
      </div>
    </section>
    ${ctaPanel(
      ui.homeCtaTitle,
      ui.homeCtaBody,
      currentRoute,
      site.pageRoutes.contact[primaryLocale],
      ui.homePrimaryCta,
      site.pageRoutes.projects[locale],
      ui.homeSecondaryCta
    )}
  </div>`;
}

function renderAboutPage(model, locale) {
  const ui = site.ui[locale];
  const content = localizedModel(model, locale);
  const currentRoute = site.pageRoutes.about[locale];

  return `<div class="page-grid">
    ${heroSection(
      ui.aboutHeroEyebrow,
      ui.aboutHeroTitle,
      ui.aboutHeroIntro,
      currentRoute,
      site.pageRoutes.projects[locale],
      ui.aboutPrimaryCta,
      site.pageRoutes.contact[locale],
      ui.aboutSecondaryCta
    )}
    <div class="grid-two">
      <section class="panel">
        <div class="panel-header">
          <h2>${escapeHtml(ui.aboutSummaryTitle)}</h2>
          <p>${escapeHtml(ui.aboutSummaryBody)}</p>
        </div>
        <p>${renderInlineMarkdown(content.intro)}</p>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>${escapeHtml(ui.areasTitle)}</h2>
        </div>
        ${listItems(ui.areasItems)}
      </section>
    </div>
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(ui.currentFocusTitle)}</h2>
      </div>
      ${listItems(content.now)}
    </section>
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(ui.previousWorkTitle)}</h2>
      </div>
      ${listItems(content.previously)}
    </section>
    ${readmeSourcePanel(locale)}
  </div>`;
}

function renderProjectsPage(model, locale) {
  const ui = site.ui[locale];
  const content = localizedModel(model, locale);
  const currentRoute = site.pageRoutes.projects[locale];
  const projectGroups = Object.entries(content.projects)
    .map(([groupName, items]) => {
      return `<section class="panel">
        <div class="panel-header">
          <span class="kicker">${escapeHtml(ui.projectGroups[groupName])}</span>
        </div>
        <div class="project-grid">
          ${items.map(projectCard).join('')}
        </div>
      </section>`;
    })
    .join('');

  return `<div class="page-grid">
    ${heroSection(
      ui.projectsHeroEyebrow,
      ui.projectsHeroTitle,
      ui.projectsHeroIntro,
      currentRoute,
      site.pageRoutes.about[locale],
      ui.projectsPrimaryCta,
      site.pageRoutes.contact[locale],
      ui.projectsSecondaryCta
    )}
    ${projectGroups}
    <section class="panel">
      <div class="panel-header">
        <h2>${escapeHtml(ui.projectsSummaryTitle)}</h2>
        <p>${escapeHtml(ui.projectsSummaryBody)}</p>
      </div>
      <div class="grid-two">
        <article class="role-card">
          <span class="role-meta">${escapeHtml(ui.roleNowLabel)}</span>
          ${listItems(content.now)}
        </article>
        <article class="role-card">
          <span class="role-meta">${escapeHtml(ui.rolePreviousLabel)}</span>
          ${listItems(content.previously)}
        </article>
      </div>
    </section>
    ${readmeSourcePanel(locale)}
  </div>`;
}

function renderContactPage(model, locale) {
  const ui = site.ui[locale];
  const content = localizedModel(model, locale);
  const currentRoute = site.pageRoutes.contact[locale];

  return `<div class="page-grid">
    ${heroSection(
      ui.contactHeroEyebrow,
      ui.contactHeroTitle,
      ui.contactHeroIntro,
      currentRoute,
      site.pageRoutes.projects[locale],
      ui.contactPrimaryCta,
      site.pageRoutes.about[locale],
      ui.contactSecondaryCta
    )}
    <div class="grid-two">
      <section class="panel">
        <div class="panel-header">
          <h2>${escapeHtml(ui.contactLinksTitle)}</h2>
          <p>${escapeHtml(ui.contactLinksIntro)}</p>
        </div>
        <div class="link-grid grid-two">
          <article class="link-card">
            <h3><a class="project-link" href="https://www.twitter.com/catmcgee/" target="_blank" rel="noreferrer">Twitter/X</a></h3>
            <p>${renderInlineMarkdown(content.intro)}</p>
          </article>
          <article class="link-card">
            <h3><a class="project-link" href="${site.githubProfile}" target="_blank" rel="noreferrer">GitHub</a></h3>
            <p>${locale === 'en' ? 'Browse repositories and public code.' : 'Consulta repositoris i codi públic.'}</p>
          </article>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>${escapeHtml(ui.locationCardTitle)}</h2>
        </div>
        ${listItems(content.locations)}
      </section>
    </div>
    ${readmeSourcePanel(locale)}
  </div>`;
}

function structuredData(pageId, locale) {
  const meta = site.pageMeta[pageId];
  const websiteId = `${site.siteUrl}/#website`;

  return `<script type="application/ld+json">${JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': websiteId,
      name: site.brandName,
      url: site.siteUrl,
      inLanguage: locale,
    },
    {
      '@context': 'https://schema.org',
      '@type': meta.schemaType,
      url: absoluteUrl(site.pageRoutes[pageId][locale]),
      name: meta.title[locale],
      description: meta.description[locale],
      inLanguage: locale,
      isPartOf: {
        '@id': websiteId,
      },
      mainEntity: {
        '@type': 'Person',
        name: site.brandName,
        homeLocation: {
          '@type': 'Place',
          name: 'Buenos Aires',
        },
        worksFor: {
          '@type': 'Organization',
          name: 'Solana Foundation',
        },
        sameAs: ['https://www.twitter.com/catmcgee/', site.githubProfile],
      },
    },
  ])}</script>`;
}

function renderHead(pageId, locale) {
  const meta = site.pageMeta[pageId];
  const route = site.pageRoutes[pageId][locale];
  const alternates = localeCodes
    .map((code) => {
      return `<link rel="alternate" hreflang="${code}" href="${absoluteUrl(site.pageRoutes[pageId][code])}">`;
    })
    .concat(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(site.pageRoutes[pageId].en)}">`)
    .join('\n    ');

  return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(meta.title[locale])}</title>
    <meta name="description" content="${escapeHtml(meta.description[locale])}">
    <meta name="robots" content="index,follow">
    <meta name="theme-color" content="#11513f">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(site.brandName)}">
    <meta property="og:title" content="${escapeHtml(meta.title[locale])}">
    <meta property="og:description" content="${escapeHtml(meta.description[locale])}">
    <meta property="og:url" content="${absoluteUrl(route)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(meta.title[locale])}">
    <meta name="twitter:description" content="${escapeHtml(meta.description[locale])}">
    <link rel="canonical" href="${absoluteUrl(route)}">
    ${alternates}
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%2311513f'/%3E%3Ctext x='50' y='58' text-anchor='middle' font-family='Arial' font-size='36' fill='white'%3ECM%3C/text%3E%3C/svg%3E">
    <link rel="stylesheet" href="${relativeAsset(route, 'styles.css')}">
    ${structuredData(pageId, locale)}
  </head>`;
}

function renderPage(pageId, locale, model) {
  const ui = site.ui[locale];
  const renderers = {
    home: renderHomePage,
    about: renderAboutPage,
    projects: renderProjectsPage,
    contact: renderContactPage,
  };

  return `<!DOCTYPE html>
<html lang="${locale}">
${renderHead(pageId, locale)}
<body>
  <a class="skip-link" href="#content">${escapeHtml(ui.skipLink)}</a>
  <div class="site-shell">
    ${renderHeader(locale, pageId)}
    <main id="content">
      ${renderers[pageId](model, locale)}
    </main>
    ${renderFooter(locale, pageId)}
  </div>
</body>
</html>`;
}

function writeRoute(route, html) {
  const outputPath = routeOutputPath(route);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const body = pageIds
    .map((pageId) => {
      return localeCodes
        .map((locale) => {
          const alternates = localeCodes
            .map((code) => {
              return `    <xhtml:link rel="alternate" hreflang="${code}" href="${absoluteUrl(site.pageRoutes[pageId][code])}" />`;
            })
            .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(site.pageRoutes[pageId].en)}" />`)
            .join('\n');

          return `  <url>
    <loc>${absoluteUrl(site.pageRoutes[pageId][locale])}</loc>
${alternates}
    <lastmod>${today}</lastmod>
  </url>`;
        })
        .join('\n');
    })
    .join('\n');

  fs.writeFileSync(
    path.join(outRoot, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`
  );
}

function buildRobots() {
  fs.writeFileSync(
    path.join(outRoot, 'robots.txt'),
    `User-agent: *
Allow: /

Sitemap: ${site.siteUrl}/sitemap.xml
`
  );
}

function buildCname() {
  fs.writeFileSync(path.join(outRoot, 'CNAME'), `${site.customDomain}\n`);
}

function buildSite() {
  const readme = fs.readFileSync(path.join(outRoot, 'README.md'), 'utf8');
  const model = parseReadme(readme);
  validateReadmeModel(model);

  for (const locale of localeCodes) {
    for (const pageId of pageIds) {
      writeRoute(site.pageRoutes[pageId][locale], renderPage(pageId, locale, model));
    }
  }

  buildSitemap();
  buildRobots();
  buildCname();
}

buildSite();

console.log(`Generated ${pageIds.length * localeCodes.length} pages from README.md.`);
