const fs = require('fs');
const https = require('https');

const url = 'https://registry.npmjs.org/npm/-/npm-10.8.2.tgz';
const file = fs.createWriteStream('npm.tgz');

console.log('Downloading npm tarball...');
https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: ${response.statusCode}`);
    return;
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download complete!');
  });
}).on('error', (err) => {
  fs.unlinkSync('npm.tgz');
  console.error('Error:', err.message);
});
