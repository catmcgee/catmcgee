const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.resolve(__dirname, '../..');
const SITE_DATA_PATH = path.join(ROOT, 'site-data.js');
const README_PATH = path.join(ROOT, 'README.md');

const LOCALES = {
  ca: { name: 'Catalan', note: 'Standard Catalan' },
  es: { name: 'Argentine Spanish', note: 'Use voseo (vos/usá/mirá) and Argentine vocabulary' },
  ga: { name: 'Irish (Gaeilge)', note: 'Standard modern Irish' },
};

async function main() {
  const client = new Anthropic();
  const readme = fs.readFileSync(README_PATH, 'utf8').trim();
  const siteDataSource = fs.readFileSync(SITE_DATA_PATH, 'utf8');

  // Extract the current translations object as a string for context
  const translationsMatch = siteDataSource.match(/translations:\s*\{[\s\S]*?\n  \},/);
  if (!translationsMatch) {
    throw new Error('Could not find translations block in site-data.js');
  }

  const prompt = `You are a translation assistant for a personal website. The site content comes from a GitHub profile README.md. The translations must maintain the EXACT same structure as the parsed README.

Here is the current README.md:
\`\`\`markdown
${readme}
\`\`\`

Here are the current translations in site-data.js:
\`\`\`javascript
${translationsMatch[0]}
\`\`\`

Update the translations to match the current README content. The translations object has this structure for each locale (ca, es, ga):
- greeting: translated greeting (the ### heading)
- heroTitle: translated hero title (the first #### heading)
- intro: translated intro paragraph
- now: array of translated NOW items (must have exactly the same number of items as the README)
- previously: array of translated PREVIOUSLY items (same count as README)
- projects: object with the same group names as keys, each an array of translated project descriptions (same count per group). Keep project names, URLs, and technical terms (like "stealth addresses", "mixer", "confidential transfers") as-is or only lightly adapted. Keep link markdown syntax intact.
- locations: array of translated location items (same count as README)

IMPORTANT RULES:
- The number of items in each array MUST exactly match the README
- Keep all markdown link syntax [text](url) intact
- Keep emojis as-is
- Keep project names and technical terms recognizable
- Translation notes: ${Object.entries(LOCALES).map(([k, v]) => `${k} = ${v.name} (${v.note})`).join('; ')}

Return ONLY valid JavaScript for the translations object value (starting with { and ending with }), with no wrapping code fence or explanation. The object should have keys: ca, es, ga. Use single quotes for strings. Use template-style formatting matching the existing code.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const translationsJs = response.content[0].text.trim();

  // Validate it parses
  let parsed;
  try {
    parsed = eval(`(${translationsJs})`);
  } catch (e) {
    console.error('Failed to parse translations response:', e.message);
    console.error('Response was:', translationsJs);
    process.exit(1);
  }

  // Validate structure
  for (const locale of Object.keys(LOCALES)) {
    const t = parsed[locale];
    if (!t) throw new Error(`Missing locale: ${locale}`);
    if (!t.greeting || !t.heroTitle || !t.intro) throw new Error(`Missing fields in ${locale}`);
    if (!Array.isArray(t.now) || !Array.isArray(t.previously) || !Array.isArray(t.locations)) {
      throw new Error(`Missing arrays in ${locale}`);
    }
  }

  // Replace the translations block in site-data.js
  const updatedSource = siteDataSource.replace(
    /translations:\s*\{[\s\S]*?\n  \},/,
    `translations: ${translationsJs},`
  );

  fs.writeFileSync(SITE_DATA_PATH, updatedSource);
  console.log('Translations updated successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
