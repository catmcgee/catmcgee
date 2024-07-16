const fs = require('fs');
const marked = require('marked');

const readmeContent = fs.readFileSync('README.md', 'utf-8');

const htmlContent = marked.parse(readmeContent);

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
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>
`;

fs.writeFileSync('index.html', htmlTemplate);

console.log('index.html has been created successfully!');