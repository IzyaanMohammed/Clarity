const Jimp = require('jimp');

async function removeWhiteBackground(inputFile, outputFile) {
  try {
    const image = await Jimp.read(inputFile);
    
    // A more advanced white-removal that preserves some alpha for shadows
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      const avg = (r + g + b) / 3;
      
      // If it's pure white, fully transparent
      // If it's darker, keep more opacity
      if (avg > 230) {
        this.bitmap.data[idx + 3] = 0;
      } else if (avg > 200) {
        // smooth fade
        this.bitmap.data[idx + 3] = Math.floor((230 - avg) * 255 / 30);
      }
    });

    await image.writeAsync(outputFile);
    console.log(`Processed ${outputFile}`);
  } catch (error) {
    console.error(`Error processing ${inputFile}:`, error);
  }
}

removeWhiteBackground(
  "C:\\Users\\Lenovo-T470-0027\\.gemini\\antigravity\\brain\\774d0333-4472-47e3-a25e-7c9c5fedd25a\\stationary_border_1782305140617.png", 
  "d:\\Desktop\\clarity\\project\\public\\stationary_bg.png"
);
