const fs = require('fs');
const path = require('path');
const { site } = require('./site-data');

const outRoot = __dirname;
const localeCodes = Object.keys(site.locales);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decorateText(text) {
  return String(text).replace(/Buenos Aires/g, 'Buenos Aires 🇦🇷');
}

function renderInlineMarkdown(markdown) {
  return escapeHtml(decorateText(markdown)).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
}

function stripMarkdown(markdown) {
  return decorateText(markdown).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
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

  const expectedGroups = site.readmeSnapshot.projectGroups;
  const actualGroups = Object.keys(model.projects);
  assertLength(actualGroups, expectedGroups, 'projectGroups');

  expectedGroups.forEach((groupName, index) => {
    if (actualGroups[index] !== groupName) {
      throw new Error(`README structure drift detected. Expected project group "${groupName}".`);
    }
  });

  Object.entries(site.translations).forEach(([locale, translation]) => {
    assertLength(model.now, translation.now, `${locale}.now`);
    assertLength(model.previously, translation.previously, `${locale}.previously`);
    assertLength(model.locations, translation.locations, `${locale}.locations`);

    expectedGroups.forEach((groupName) => {
      assertLength(model.projects[groupName], translation.projects[groupName], `${locale}.projects.${groupName}`);
    });
  });
}

function localizedModel(model, locale) {
  if (locale === 'en') {
    return model;
  }

  return site.translations[locale];
}

function listItems(items) {
  return `<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`;
}

function renderLanguageSwitcher(locale) {
  const ui = site.ui[locale];
  const links = localeCodes
    .map((code) => {
      const localeInfo = site.locales[code];
      const active = code === locale ? ' active' : '';
      const flag = localeInfo.flagAsset
        ? `<img class="lang-flag" src="${relativeAsset(site.locales[locale].route, localeInfo.flagAsset)}" alt="" aria-hidden="true">`
        : '';

      return `<a class="lang-link${active}" href="${relativeRoute(site.locales[locale].route, localeInfo.route)}" lang="${localeInfo.code}" hreflang="${localeInfo.code}">${flag}${escapeHtml(
        localeInfo.switcherLabel
      )}</a>`;
    })
    .join('');

  return `<nav class="language-switcher" aria-label="${escapeHtml(ui.languageLabel)}">${links}</nav>`;
}

function renderProjectSections(locale, content) {
  const projectGroups = site.ui[locale].projectGroups;

  return Object.entries(content.projects)
    .map(([groupName, items]) => {
      return `<h6>${escapeHtml(projectGroups[groupName])}</h6>
${listItems(items)}`;
    })
    .join('\n');
}

function renderContent(locale, model) {
  const content = localizedModel(model, locale);
  const ui = site.ui[locale];

  return `<div class="page">
    ${renderLanguageSwitcher(locale)}
    <p class="greeting">${escapeHtml(content.greeting)}</p>
    <h1>${escapeHtml(stripMarkdown(content.heroTitle))}</h1>
    <p>${renderInlineMarkdown(content.intro)}</p>
    <h2>${escapeHtml(ui.focusTitle)}</h2>
    ${listItems(content.now)}
    <h2>${escapeHtml(ui.previousTitle)}</h2>
    ${listItems(content.previously)}
    <h2>${escapeHtml(ui.projectsTitle)}</h2>
    ${renderProjectSections(locale, content)}
    <h2>${escapeHtml(ui.locationTitle)}</h2>
    ${listItems(content.locations)}
  </div>`;
}

function structuredData(locale) {
  const localeCode = site.locales[locale].code;

  return `<script type="application/ld+json">${JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${site.siteUrl}/#website`,
      name: site.brandName,
      url: site.siteUrl,
      inLanguage: localeCode,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: absoluteUrl(site.locales[locale].route),
      name: site.meta[locale].title,
      description: site.meta[locale].description,
      inLanguage: localeCode,
      isPartOf: {
        '@id': `${site.siteUrl}/#website`,
      },
      mainEntity: {
        '@type': 'Person',
        name: site.brandName,
        homeLocation: {
          '@type': 'Place',
          name: 'Buenos Aires, Argentina',
        },
        worksFor: {
          '@type': 'Organization',
          name: 'Solana Foundation',
        },
        sameAs: [site.twitterProfile, site.githubProfile],
      },
    },
  ])}</script>`;
}

function renderHead(locale) {
  const localeInfo = site.locales[locale];
  const meta = site.meta[locale];
  const route = localeInfo.route;
  const alternates = localeCodes
    .map((code) => `<link rel="alternate" hreflang="${site.locales[code].code}" href="${absoluteUrl(site.locales[code].route)}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(site.locales.en.route)}">`)
    .join('\n    ');

  return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}">
    <meta name="robots" content="index,follow">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(site.brandName)}">
    <meta property="og:title" content="${escapeHtml(meta.title)}">
    <meta property="og:description" content="${escapeHtml(meta.description)}">
    <meta property="og:url" content="${absoluteUrl(route)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(meta.title)}">
    <meta name="twitter:description" content="${escapeHtml(meta.description)}">
    <link rel="canonical" href="${absoluteUrl(route)}">
    ${alternates}
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%2311513f'/%3E%3Ctext x='50' y='58' text-anchor='middle' font-family='Arial' font-size='36' fill='white'%3ECM%3C/text%3E%3C/svg%3E">
    <link rel="stylesheet" href="${relativeAsset(route, 'styles.css')}">
    ${structuredData(locale)}
  </head>`;
}

function renderPage(locale, model) {
  return `<!DOCTYPE html>
<html lang="${site.locales[locale].code}">
${renderHead(locale)}
<body>
  ${renderContent(locale, model)}
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
  const body = localeCodes
    .map((locale) => {
      const alternates = localeCodes
        .map((code) => `    <xhtml:link rel="alternate" hreflang="${site.locales[code].code}" href="${absoluteUrl(site.locales[code].route)}" />`)
        .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(site.locales.en.route)}" />`)
        .join('\n');

      return `  <url>
    <loc>${absoluteUrl(site.locales[locale].route)}</loc>
${alternates}
    <lastmod>${today}</lastmod>
  </url>`;
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

function buildSite() {
  const readme = fs.readFileSync(path.join(outRoot, 'README.md'), 'utf8');
  const model = parseReadme(readme);
  validateReadmeModel(model);

  localeCodes.forEach((locale) => {
    writeRoute(site.locales[locale].route, renderPage(locale, model));
  });

  buildSitemap();
  buildRobots();
}

buildSite();

console.log(`Generated ${localeCodes.length} localized one-page profiles from README.md.`);
