require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use first arg as image path, or fall back to the sticker.png we found
const imagePath = process.argv[2] || '/Users/fatemaalkhalifa/spritehackathon/public/sticker.png';

console.log('Using image:', imagePath);

const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const ext = path.extname(imagePath).toLowerCase();
const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const mimeType = mimeMap[ext] || 'image/png';

const SPRITE_PROMPT = [
  'Convert this exact reference image into a 2D pixel art cyberpunk fighting game character sprite.',
  'Make them a little tiny playable fighter character — bold outlines, vibrant limited color palette, and sharp pixel details.',
  'Keep the backdrop plain and black.',
  'Pose: Keep the same ready fighting stance with fists up.',
  'Add subtle cyberpunk fighting game flair: faint neon glow on the red visor,',
  'very light electric sparks or holographic glitch effects around the fists and coat edges,',
  'and a dark cyberpunk atmosphere.',
  'Maintain the exact same look, colors, and outfit from the reference,',
  'just stylize it as a high-quality pixel art fighting game idle sprite.',
  'Clean lines, retro video game feel, ready for a cyberpunk fighting game roster.',
].join(' ');

(async () => {
  console.log('Calling Gemini gemini-2.5-flash-image…');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const result = await model.generateContent([
    { inlineData: { data: base64Image, mimeType } },
    SPRITE_PROMPT,
  ]);

  const parts = result.response.candidates?.[0]?.content?.parts || [];
  console.log('Response parts:', parts.map(p => Object.keys(p)));

  const imgPart = parts.find(p => p.inlineData);
  if (!imgPart) {
    const textPart = parts.find(p => p.text);
    console.error('No image returned. Text response:', textPart?.text || '(none)');
    process.exit(1);
  }

  const outPath = path.join(__dirname, 'test-output.png');
  fs.writeFileSync(outPath, Buffer.from(imgPart.inlineData.data, 'base64'));
  console.log('Success! Saved to:', outPath);
  console.log('Open it with: open', outPath);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
