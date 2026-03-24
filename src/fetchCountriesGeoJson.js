const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const SOURCE_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
const OUTPUT_PATH = path.resolve(__dirname, '..', 'data', 'countries.geojson');

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(download(res.headers.location));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url} (${res.statusCode})`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const data = await download(SOURCE_URL);
  fs.writeFileSync(OUTPUT_PATH, data);
  console.log(`Saved real country boundaries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
