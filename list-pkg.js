const fs = require('fs');
try {
  console.log(fs.readdirSync('C:\\Users\\HP\\AppData\\Local\\ms-playwright-go\\1.57.0\\package'));
} catch (e) {
  console.error(e);
}
