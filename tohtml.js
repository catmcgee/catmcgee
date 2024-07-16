const fs = require('fs');

function improvedMarkdownToHtml(markdown) {
  let inList = false;
  
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '</p><h3>$1</h3><p>')
    .replace(/^#### (.*$)/gm, '</p><h4>$1</h4><p>')
    .replace(/^##### (.*$)/gm, '</p><h5>$1</h5><p>')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/gm, '<a href="$2">$1</a>')
    // Lists
    .replace(/^\s*[\-\*] (.*)/gm, (match, p1) => {
      if (!inList) {
        inList = true;
        return `</p><ul><li>${p1}</li>`;
      }
      return `<li>${p1}</li>`;
    })
    // End list if next line is not a list item
    .replace(/(<\/li>)(?!\s*<li>)/g, (match, p1) => {
      if (inList) {
        inList = false;
        return `${p1}</ul><p>`;
      }
      return p1;
    })
    // Wrap content in paragraphs
    .replace(/^(?!<[uh]|<li|<\/ul|<p|<\/p)(.+)/gm, '<p>$1</p>')
    // Remove empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Ensure document starts and ends with paragraph tags
    .replace(/^(?!<p)/, '<p>')
    .replace(/(?!<\/p>)$/, '</p>');
}

// Read the README.md file
const readmeContent = fs.readFileSync('README.md', 'utf-8');

// Convert Markdown to HTML
const htmlContent = improvedMarkdownToHtml(readmeContent);

// Create a simple HTML template with emoji favicon and updated title
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat McGee</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👩‍💻</text></svg>">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        ul {
            padding-left: 20px;
            margin-top: 0.5em;
            margin-bottom: 0.5em;
        }
        li {
            margin-bottom: 0.25em;
        }
        h3, h4, h5 {
            margin-top: 1em;
            margin-bottom: 0.5em;
        }
        p {
            margin-top: 0.5em;
            margin-bottom: 0.5em;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>
`;

// Write the HTML content to index.html
fs.writeFileSync('index.html', htmlTemplate);

console.log('index.html has been created successfully!');