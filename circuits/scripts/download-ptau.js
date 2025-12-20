/**
 * Download Powers of Tau file for Groth16 setup
 * 
 * Using pot16 (2^16 = 65,536 constraints) which is sufficient for our circuit
 * Our circuit has ~29,357 constraints so we need at least pot15 (32,768)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PTAU_URL = 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau';
const OUTPUT_FILE = path.join(__dirname, '..', 'pot16_final.ptau');

// Check if file already exists
if (fs.existsSync(OUTPUT_FILE)) {
  console.log('Powers of Tau file already exists:', OUTPUT_FILE);
  process.exit(0);
}

console.log('Downloading Powers of Tau file...');
console.log('URL:', PTAU_URL);
console.log('Output:', OUTPUT_FILE);

const file = fs.createWriteStream(OUTPUT_FILE);

https.get(PTAU_URL, (response) => {
  if (response.statusCode === 301 || response.statusCode === 302) {
    // Handle redirect
    https.get(response.headers.location, (res) => {
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rDownloading: ${percent}%`);
      });

      res.pipe(file);
      file.on('finish', () => {
        console.log('\nDownload complete!');
        file.close();
      });
    });
  } else {
    const totalSize = parseInt(response.headers['content-length'], 10);
    let downloaded = 0;

    response.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalSize) {
        const percent = ((downloaded / totalSize) * 100).toFixed(1);
        process.stdout.write(`\rDownloading: ${percent}%`);
      }
    });

    response.pipe(file);
    file.on('finish', () => {
      console.log('\nDownload complete!');
      file.close();
    });
  }
}).on('error', (err) => {
  fs.unlink(OUTPUT_FILE, () => {});
  console.error('Download failed:', err.message);
  process.exit(1);
});

