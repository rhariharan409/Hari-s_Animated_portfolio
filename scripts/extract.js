import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const publicDir = path.join(process.cwd(), 'public');
const framesDir = path.join(publicDir, 'frames');

const videos = [
  'Camera_moving_through_snowy_forest_20260917173413.mp4',
  'Camera_approaching_wooden_cabin_20260917173434.mp4',
  'Wooden_door_opens_to_interior_20260917173445.mp4',
  'Camera_moving_through_rustic_cabin_20260917173457.mp4',
  'Camera_panning_toward_empty_bull…_20260917220917.mp4',
  'Camera_panning_away_from_board_20260917224433.mp4',
  'Camera_panning_living_room_cabin_20260919142031.mp4',
  'Camera_revealing_vintage_compute…_20260919150412.mp4'
];

if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}

const extractFrames = (videoFile, seqIndex) => {
  return new Promise((resolve, reject) => {
    const inputPath = path.join(publicDir, videoFile);
    const outputDir = path.join(framesDir, `seq${seqIndex}`);
    
    if (fs.existsSync(outputDir)) {
      const existingFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.webp'));
      if (existingFiles.length > 0) {
        console.log(`Skipping seq${seqIndex}, already extracted ${existingFiles.length} frames.`);
        return resolve({ seqIndex, frameCount: existingFiles.length, name: `seq${seqIndex}` });
      }
    } else {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Extracting frames for ${videoFile} to seq${seqIndex}...`);

    ffmpeg(inputPath)
      .outputOptions([
        '-vf fps=24,scale=1280:720',
        '-c:v libwebp',
        '-q:v 80' // WebP quality
      ])
      .output(path.join(outputDir, 'frame_%04d.webp'))
      .on('end', () => {
        // Count generated frames
        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.webp'));
        console.log(`Finished extracting ${files.length} frames for seq${seqIndex}`);
        resolve({ seqIndex, frameCount: files.length, name: `seq${seqIndex}` });
      })
      .on('error', (err) => {
        console.error(`Error extracting ${videoFile}:`, err);
        reject(err);
      })
      .run();
  });
};

async function main() {
  console.log('Starting frame extraction... This may take a few minutes.');
  const metadata = [];
  
  for (let i = 0; i < videos.length; i++) {
    const result = await extractFrames(videos[i], i);
    metadata.push(result);
  }

  const metadataPath = path.join(framesDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify({ sequences: metadata }, null, 2));
  console.log(`Metadata saved to ${metadataPath}`);
  console.log('Extraction complete!');
}

main();
