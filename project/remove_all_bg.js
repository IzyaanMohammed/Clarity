
import Jimp from 'jimp';
import fs from 'fs';

async function removeWhiteBackground(inputFile, outputFile) {
  try {
    const image = await Jimp.read(inputFile);
    image.rgba(true);
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      if (red > 200 && green > 200 && blue > 200) {
        this.bitmap.data[idx + 3] = 0;
      }
    });
    await image.writeAsync(outputFile);
    console.log('Processed ' + outputFile);
  } catch (error) {
    console.error('Error processing ' + inputFile + ':', error);
  }
}

async function main() {
  const filesToProcess = [
    'public/doodle_sticky.png',
    'public/doodle_pen.png',
    'public/doodle_ripped_paper.png',
    'public/doodle_paper_clip.png',
    'public/doodle_coffee_stain.png'
  ];
  for (const file of filesToProcess) {
    if (fs.existsSync(file)) {
      console.log('Removing background for ' + file);
      await removeWhiteBackground(file, file);
    }
  }
}
main();

