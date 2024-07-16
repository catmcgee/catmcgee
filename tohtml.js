const fs = require('fs');

function enhancedMarkdownToHtml(markdown) {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
    // Bold
    .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*)\*/gm, '<em>$1</em>')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/gm, '<a href="$2">$1</a>')
    // Lists
    .replace(/^\s*[\-\*] (.*)/gm, '<li>$1</li>')
    // Wrap lists in <ul> tags
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Preserve emojis (this is a simple approach, might not cover all cases)
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '&#x$1;')
    // Line breaks
    .replace(/\n/gm, '<br>');
}

// Read the README.md file
const readmeContent = fs.readFileSync('README.md', 'utf-8');

// Convert Markdown to HTML
const htmlContent = enhancedMarkdownToHtml(readmeContent);

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