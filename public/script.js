// === DOM refs ===
const imageInput    = document.getElementById('imageInput');
const uploadZone    = document.querySelector('.upload-zone');
const uploadPreview = document.getElementById('uploadPreview');
const previewImg    = document.getElementById('previewImg');
const clearBtn      = document.getElementById('clearBtn');
const generateBtn   = document.getElementById('generateBtn');
const statusWrap    = document.getElementById('statusWrap');
const statusEl      = document.getElementById('status');
const resultPreview = document.getElementById('resultPreview');
const imageActions  = document.getElementById('imageActions');
const downloadLink  = document.getElementById('downloadLink');
const copyText      = document.getElementById('copyText');
const copyBtn       = document.getElementById('copyBtn');

let uploadedFile = null;

// === Upload handling ===
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) setFile(file);
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '#B307EB';
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (file && allowed.includes(file.type)) setFile(file);
});

function setFile(file) {
  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    uploadPreview.hidden = false;
    uploadZone.style.display = 'none';
  };
  reader.readAsDataURL(file);
  generateBtn.disabled = false;
  resultPreview.hidden = true;
  imageActions.hidden = true;
  hideStatus();
}

clearBtn.addEventListener('click', () => {
  uploadedFile = null;
  imageInput.value = '';
  previewImg.src = '';
  uploadPreview.hidden = true;
  uploadZone.style.display = '';
  generateBtn.disabled = true;
  resultPreview.hidden = true;
  imageActions.hidden = true;
  hideStatus();
});

// === Generate ===
generateBtn.addEventListener('click', async () => {
  if (!uploadedFile) return;

  generateBtn.disabled = true;
  resultPreview.hidden = true;
  imageActions.hidden = true;
  showStatus('Generating your sprite… (~30s)');

  try {
    const formData = new FormData();
    formData.append('image', uploadedFile);

    const res  = await fetch('/api/generate', { method: 'POST', body: formData });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Generation failed.');

    let finalUrl = data.imageUrl;
    try {
      finalUrl = await compositeBadge(data.imageUrl);
    } catch (e) {
      console.warn('Badge skipped:', e.message);
    }

    resultPreview.src    = finalUrl;
    resultPreview.hidden = false;
    downloadLink.href    = finalUrl;
    imageActions.hidden  = false;
    hideStatus();

  } catch (err) {
    showStatus('Error: ' + err.message);
    console.error(err);
  } finally {
    generateBtn.disabled = false;
  }
});

function showStatus(msg) {
  statusEl.textContent = msg;
  statusWrap.hidden = false;
}
function hideStatus() {
  statusEl.textContent = '';
  statusWrap.hidden = true;
}

// === Brand colors ===
const BRAND = {
  purple: '#B307EB', blue: '#3198F1', green: '#4EF9BD', red: '#EE1701',
  black: '#000000',  white: '#FFFFFF', darkBg: '#14120B',
};

// === Composite pixel badge onto generated sprite (top-left) ===
async function compositeBadge(imageUrl) {
  const sprite  = await loadImage(imageUrl);

  const canvas  = document.createElement('canvas');
  canvas.width  = sprite.naturalWidth;
  canvas.height = sprite.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(sprite, 0, 0);
  drawGridOverlay(ctx, canvas.width, canvas.height);
  drawPixelBadge(ctx, canvas.width);
  drawHashtag(ctx, canvas.width);

  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/png')
  );
}

function drawHashtag(ctx, W) {
  const SCALE  = 3;
  const text   = '#TotheAmericas';
  const margin = Math.round(W * 0.03);

  // Measure at target font size on offscreen canvas
  const fontSize = 7;
  const off = document.createElement('canvas');
  off.width  = 300; off.height = 20;
  const oc = off.getContext('2d');
  oc.imageSmoothingEnabled = false;
  oc.font = `${fontSize}px "Press Start 2P", monospace`;
  const textW = Math.ceil(oc.measureText(text).width);
  const padX = 5, padY = 4;
  const bW = textW + padX * 2;
  const bH = fontSize + padY * 2;

  off.width = bW; off.height = bH;
  oc.imageSmoothingEnabled = false;

  // No background or border — text only
  oc.font = `${fontSize}px "Press Start 2P", monospace`;
  oc.fillStyle = BRAND.white;
  oc.textBaseline = 'top';
  oc.fillText(text, padX, padY);

  // Blit top-right
  const destW = bW * SCALE;
  const destH = bH * SCALE;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, W - destW - margin, margin, destW, destH);
}

function drawGridOverlay(ctx, W, H) {
  const gridSize = Math.round(W / 48); // ~21px grid on 1024 canvas
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();
}

function drawPixelBadge(ctx, canvasW) {
  // Badge drawn on a small offscreen canvas then scaled up — true pixel art look
  const SCALE = 3;
  const bW = 100, bH = 28;
  const margin = Math.round(canvasW * 0.03);

  const off = document.createElement('canvas');
  off.width  = bW;
  off.height = bH;
  const oc = off.getContext('2d');
  oc.imageSmoothingEnabled = false;

  // Background
  oc.fillStyle = BRAND.darkBg;
  oc.fillRect(0, 0, bW, bH);

  // Grid overlay — subtle pixel grid lines
  oc.strokeStyle = 'rgba(255,255,255,0.07)';
  oc.lineWidth = 1;
  for (let x = 0; x <= bW; x += 4) {
    oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, bH); oc.stroke();
  }
  for (let y = 0; y <= bH; y += 4) {
    oc.beginPath(); oc.moveTo(0, y); oc.lineTo(bW, y); oc.stroke();
  }

  // White border
  oc.strokeStyle = BRAND.white;
  oc.lineWidth = 1;
  oc.strokeRect(0.5, 0.5, bW - 1, bH - 1);

  // Horn bar — 4 solid colour blocks in order (purple → blue → green → red)
  const colors = [BRAND.purple, BRAND.blue, BRAND.green, BRAND.red];
  const blockW = Math.floor(bW / 4);
  colors.forEach((c, i) => {
    oc.fillStyle = c;
    oc.fillRect(blockW * i, 0, i === 3 ? bW - blockW * 3 : blockW, 2);
  });

  // "UNICORN MAFIA" — white
  oc.font = '6px "Press Start 2P", monospace';
  oc.fillStyle = BRAND.white;
  oc.textBaseline = 'top';
  oc.fillText('UNICORN MAFIA', 4, 6);

  // "INVITED HACKER" — green
  oc.font = '5px "Press Start 2P", monospace';
  oc.fillStyle = BRAND.green;
  oc.fillText('INVITED HACKER', 4, 17);

  // Blit onto main canvas at SCALE× — top-left corner
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, margin, margin, bW * SCALE, bH * SCALE);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}


// === Copy post text ===
copyBtn.addEventListener('click', async () => {
  if (!copyText.value) return;
  try {
    await navigator.clipboard.writeText(copyText.value);
    const orig = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = orig; }, 2000);
  } catch {
    copyText.select();
    copyText.setSelectionRange(0, 99999);
  }
});
