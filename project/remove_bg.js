const Jimp = require('jimp');

async function removeWhiteBackground(inputFile, outputFile) {
  try {
    const image = await Jimp.read(inputFile);
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      // If the pixel is close to white, make it transparent
      if (red > 200 && green > 200 && blue > 200) {
        this.bitmap.data[idx + 3] = 0; // Set alpha to 0
      }
    });

    await image.writeAsync(outputFile);
    console.log(`Processed ${outputFile}`);
  } catch (error) {
    console.error(`Error processing ${inputFile}:`, error);
  }
}

async function main() {
  const brainDir = "C:\\Users\\Lenovo-T470-0027\\.gemini\\antigravity\\brain\\ec113e0e-8999-4faa-b1c6-355782ec6f35\\";
  
  // You need to replace these filenames with the exact generated ones, 
  // but I can pass them via arguments or just read the directory.
  const fs = require('fs');
  const files = fs.readdirSync(brainDir);
  
  const pencilFile = files.find(f => f.startsWith('simple_pencil_') && f.endsWith('.png'));
  const stickyFile = files.find(f => f.startsWith('simple_sticky_') && f.endsWith('.png'));

  if (pencilFile) await removeWhiteBackground(brainDir + pencilFile, 'public/doodle_pen.png');
  if (stickyFile) await removeWhiteBackground(brainDir + stickyFile, 'public/doodle_sticky.png');
}

main();
