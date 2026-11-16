import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const files = fs.readdirSync(assetsDir);

const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  throw new Error('Missing built CSS or JS asset in dist/assets');
}

const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

// Escape closing script tags inside JS bundle
const safeJsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');

const standaloneHtml = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CUEFRAME — The Cinematic Review Console for Visual Storytellers (Video.js v10)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <style>${cssContent}</style>
  </head>
  <body style="margin: 0; background-color: #09090b; color: #f4f4f5;">
    <div id="root"></div>
    <script type="module">${safeJsContent}</script>
  </body>
</html>
`;

fs.writeFileSync(path.join(distDir, 'standalone-workbench.html'), standaloneHtml, 'utf8');
console.log('✓ Generated self-contained dist/standalone-workbench.html');
