const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Request CSS with modern browser user-agent to get woff2 links
const cssUrl = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=Cormorant+Garamond:ital@1&display=swap';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log("Fetching Google Fonts CSS...");
  const css = await fetchText(cssUrl);

  // Parse @font-face blocks
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  let fontIndex = 0;
  let localCss = '';

  const downloads = [];

  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    const familyMatch = block.match(/font-family:\s*['"]?([^'";]+)['"]?/);
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);
    const urlMatch = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    const unicodeMatch = block.match(/unicode-range:\s*([^;]+);/);

    if (familyMatch && urlMatch) {
      fontIndex++;
      const familyName = familyMatch[1].trim().replace(/\s+/g, '-').toLowerCase();
      const weight = weightMatch ? weightMatch[1].trim() : '400';
      const style = styleMatch ? styleMatch[1].trim() : 'normal';
      const remoteUrl = urlMatch[1];
      const filename = `${familyName}-${weight}-${style}-${fontIndex}.woff2`;
      const localFilePath = path.join(fontsDir, filename);

      downloads.push(downloadBinary(remoteUrl, localFilePath).then(() => {
        console.log(`Downloaded: ${filename}`);
      }));

      localCss += `@font-face {\n  font-family: '${familyMatch[1].trim()}';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url('/fonts/${filename}') format('woff2');\n${unicodeMatch ? `  unicode-range: ${unicodeMatch[1].trim()};\n` : ''}}\n\n`;
    }
  }

  await Promise.all(downloads);

  // Write fonts.css in public/
  const cssPath = path.join(__dirname, '..', 'public', 'fonts', 'fonts.css');
  fs.writeFileSync(cssPath, localCss, 'utf8');
  console.log(`Wrote local fonts stylesheet to ${cssPath}`);
}

run().catch(err => {
  console.error("Font download failed:", err);
  process.exit(1);
});
