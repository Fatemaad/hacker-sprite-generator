require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');

if (!process.env.GEMINI_API_KEY) {
  console.error('[!] GEMINI_API_KEY is not set. Add it to your .env file.');
  process.exit(1);
}

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Temp folder for generated sprites — served as static files
const TEMP_DIR = path.join(__dirname, 'public', 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// POST /api/generate
// ---------------------------------------------------------------------------
app.post('/api/generate', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded.' });
  }

  const mimeType = req.file.mimetype;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return res.status(400).json({ success: false, error: 'Unsupported file type. Please upload a PNG, JPEG, or WEBP.' });
  }

  try {
    // Resize + normalise to JPEG before sending — avoids Gemini's "unable to process" errors
    const processedBuffer = await sharp(req.file.buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const base64Image = processedBuffer.toString('base64');
    const mimeType = 'image/jpeg'; // always JPEG after processing

    const SPRITE_PROMPT = `Convert this reference image into a 2D pixel art cyberpunk fighting game character sprite. The character must be a small, tiny full-body sprite — like a classic arcade fighter — occupying no more than 30% of the total image height, centered in the frame, with a large plain black backdrop surrounding them on all sides.
Bold outlines, vibrant limited color palette, sharp pixel details. Keep the backdrop completely black.
Pose: Keep the same ready fighting stance with fists up. Add subtle cyberpunk fighting game flair: faint neon glow on the red visor, very light electric sparks or holographic glitch effects around the fists and coat edges, and a dark cyberpunk atmosphere.
Maintain the outfit from the reference, and stylize it as a high-quality pixel art fighting game idle sprite. Clean lines, retro video game feel, ready for a cyberpunk fighting game roster.`;

    console.log('[→] Sending to Gemini…');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      SPRITE_PROMPT,
    ]);

    const parts = result.response?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find(p => p.inlineData) ?? null;

    if (!imgPart) {
      const reason = result.response?.candidates?.[0]?.finishReason ?? 'unknown';
      throw new Error(`Gemini returned no image (reason: ${reason}). Try a different photo.`);
    }

    const rawBuffer = Buffer.from(imgPart.inlineData.data, 'base64');

    // Post-process: shrink the sprite to ~35% height and place it centered
    // on a 1024x1024 black canvas — reliable way to get a "tiny sprite" look
    const CANVAS = 1024;
    const spriteHeight = Math.round(CANVAS * 0.38); // ~390px tall on 1024 canvas

    const resizedSprite = await sharp(rawBuffer)
      .resize({ height: spriteHeight, withoutEnlargement: false })
      .toBuffer();

    const spriteMeta  = await sharp(resizedSprite).metadata();
    const spriteW     = spriteMeta.width;
    const spriteH     = spriteMeta.height;
    const left        = Math.round((CANVAS - spriteW) / 2);
    const top         = Math.round((CANVAS - spriteH) / 2);

    const finalBuffer = await sharp({
      create: { width: CANVAS, height: CANVAS, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
      .composite([{ input: resizedSprite, left, top }])
      .png()
      .toBuffer();

    const filename = `sprite-${crypto.randomBytes(8).toString('hex')}.png`;
    fs.writeFileSync(path.join(TEMP_DIR, filename), finalBuffer);

    console.log('[✓] Sprite saved:', filename);
    return res.json({ success: true, imageUrl: `/temp/${filename}`, postText: buildPostText() });

  } catch (err) {
    console.error('[!]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

function buildPostText() {
  return `I've got an early invite to the 'To The Americas' Hackathon by the Unicorn Mafia.
excited to team up with some of Europe's top builders.
lets get cooking!!

sponsors:
Pydantic - https://lnkd.in/eV58E4PH  Render - https://lnkd.in/eJBbc7sw
cognition.ai
mubit.ai The Residency
Expedite`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Unicorn Mafia Hacker Sprite Generator`);
  console.log(`  → http://localhost:${PORT}\n`);
});
