const fs = require('fs');
const marked = require('marked');

// Read the README.md file
const readmeContent = fs.readFileSync('README.md', 'utf-8');

// Convert Markdown to HTML
const htmlContent = marked.parse(readmeContent);

// Create a simple HTML template
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Personal Site</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
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