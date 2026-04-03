const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawBin(ctx, cx, cy, scale, lidColor) {
  // Bin body - dark grey with slight gradient
  const bodyWidth = 150 * scale;
  const bodyHeight = 180 * scale;
  const bodyX = cx - bodyWidth / 2;
  const bodyY = cy - bodyHeight / 2 + 20 * scale;
  const bodyRadius = 12 * scale;

  // Body gradient
  const bodyGrad = ctx.createLinearGradient(bodyX, bodyY, bodyX + bodyWidth, bodyY);
  bodyGrad.addColorStop(0, '#555555');
  bodyGrad.addColorStop(0.4, '#666666');
  bodyGrad.addColorStop(1, '#444444');

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(bodyX + bodyRadius, bodyY);
  ctx.lineTo(bodyX + bodyWidth - bodyRadius, bodyY);
  ctx.arcTo(bodyX + bodyWidth, bodyY, bodyX + bodyWidth, bodyY + bodyRadius, bodyRadius);
  ctx.lineTo(bodyX + bodyWidth, bodyY + bodyHeight - bodyRadius);
  ctx.arcTo(bodyX + bodyWidth, bodyY + bodyHeight, bodyX + bodyWidth - bodyRadius, bodyY + bodyHeight, bodyRadius);
  ctx.lineTo(bodyX + bodyRadius, bodyY + bodyHeight);
  ctx.arcTo(bodyX, bodyY + bodyHeight, bodyX, bodyY + bodyHeight - bodyRadius, bodyRadius);
  ctx.lineTo(bodyX, bodyY + bodyRadius);
  ctx.arcTo(bodyX, bodyY, bodyX + bodyRadius, bodyY, bodyRadius);
  ctx.fill();

  // Horizontal ridges on the bin body
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2 * scale;
  for (let i = 1; i <= 3; i++) {
    const y = bodyY + (bodyHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(bodyX + 8 * scale, y);
    ctx.lineTo(bodyX + bodyWidth - 8 * scale, y);
    ctx.stroke();
  }

  // Lid
  const lidWidth = 170 * scale;
  const lidHeight = 35 * scale;
  const lidX = cx - lidWidth / 2;
  const lidY = bodyY - lidHeight + 4 * scale;
  const lidRadius = 10 * scale;

  const lidGrad = ctx.createLinearGradient(lidX, lidY, lidX, lidY + lidHeight);
  lidGrad.addColorStop(0, lightenColor(lidColor, 20));
  lidGrad.addColorStop(1, lidColor);

  ctx.fillStyle = lidGrad;
  ctx.beginPath();
  ctx.moveTo(lidX + lidRadius, lidY);
  ctx.lineTo(lidX + lidWidth - lidRadius, lidY);
  ctx.arcTo(lidX + lidWidth, lidY, lidX + lidWidth, lidY + lidRadius, lidRadius);
  ctx.lineTo(lidX + lidWidth, lidY + lidHeight);
  ctx.lineTo(lidX, lidY + lidHeight);
  ctx.lineTo(lidX, lidY + lidRadius);
  ctx.arcTo(lidX, lidY, lidX + lidRadius, lidY, lidRadius);
  ctx.fill();

  // Handle on top of lid
  const handleWidth = 50 * scale;
  const handleHeight = 18 * scale;
  const handleX = cx - handleWidth / 2;
  const handleY = lidY - handleHeight + 4 * scale;
  const handleRadius = 6 * scale;

  ctx.fillStyle = lidColor;
  ctx.beginPath();
  ctx.moveTo(handleX + handleRadius, handleY);
  ctx.lineTo(handleX + handleWidth - handleRadius, handleY);
  ctx.arcTo(handleX + handleWidth, handleY, handleX + handleWidth, handleY + handleRadius, handleRadius);
  ctx.lineTo(handleX + handleWidth, handleY + handleHeight);
  ctx.lineTo(handleX, handleY + handleHeight);
  ctx.lineTo(handleX, handleY + handleRadius);
  ctx.arcTo(handleX, handleY, handleX + handleRadius, handleY, handleRadius);
  ctx.fill();
}

function lightenColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

// === APP ICON (1024x1024) ===
const iconSize = 1024;
const iconCanvas = createCanvas(iconSize, iconSize);
const iconCtx = iconCanvas.getContext('2d');

// Background - deep forest green
const bgGrad = iconCtx.createRadialGradient(512, 512, 100, 512, 512, 600);
bgGrad.addColorStop(0, '#245840');
bgGrad.addColorStop(1, '#1B3D2F');
iconCtx.fillStyle = bgGrad;
iconCtx.fillRect(0, 0, iconSize, iconSize);

// Draw a green-lidded bin in the center
drawBin(iconCtx, 512, 480, 2.2, '#8BC34A');

// "Bin Night" text at the bottom
iconCtx.fillStyle = '#F2C94C';
iconCtx.font = 'bold 80px sans-serif';
iconCtx.textAlign = 'center';
iconCtx.textBaseline = 'middle';
iconCtx.fillText('Bin Night', 512, 900);

// Save icon
const iconOut = path.join(__dirname, '..', 'app', 'assets', 'images', 'icon.png');
fs.writeFileSync(iconOut, iconCanvas.toBuffer('image/png'));
console.log(`App icon saved: ${iconOut}`);

// === ADAPTIVE ICON (1024x1024, same but more padding for Android) ===
const adaptiveCanvas = createCanvas(iconSize, iconSize);
const adaptiveCtx = adaptiveCanvas.getContext('2d');

const abgGrad = adaptiveCtx.createRadialGradient(512, 512, 100, 512, 512, 600);
abgGrad.addColorStop(0, '#245840');
abgGrad.addColorStop(1, '#1B3D2F');
adaptiveCtx.fillStyle = abgGrad;
adaptiveCtx.fillRect(0, 0, iconSize, iconSize);

drawBin(adaptiveCtx, 512, 460, 1.8, '#8BC34A');

adaptiveCtx.fillStyle = '#F2C94C';
adaptiveCtx.font = 'bold 70px sans-serif';
adaptiveCtx.textAlign = 'center';
adaptiveCtx.textBaseline = 'middle';
adaptiveCtx.fillText('Bin Night', 512, 860);

const adaptiveOut = path.join(__dirname, '..', 'app', 'assets', 'images', 'adaptive-icon.png');
fs.writeFileSync(adaptiveOut, adaptiveCanvas.toBuffer('image/png'));
console.log(`Adaptive icon saved: ${adaptiveOut}`);

// === SPLASH ICON (200x200 centered icon for splash screen) ===
const splashSize = 512;
const splashCanvas = createCanvas(splashSize, splashSize);
const splashCtx = splashCanvas.getContext('2d');

// Transparent background - the splash screen bg color is set in app.json
splashCtx.clearRect(0, 0, splashSize, splashSize);

drawBin(splashCtx, 256, 220, 1.2, '#8BC34A');

splashCtx.fillStyle = '#F2C94C';
splashCtx.font = 'bold 60px sans-serif';
splashCtx.textAlign = 'center';
splashCtx.textBaseline = 'middle';
splashCtx.fillText('Bin Night', 256, 440);

const splashOut = path.join(__dirname, '..', 'app', 'assets', 'images', 'splash-icon.png');
fs.writeFileSync(splashOut, splashCanvas.toBuffer('image/png'));
console.log(`Splash icon saved: ${splashOut}`);

// === FAVICON (48x48) ===
const favSize = 48;
const favCanvas = createCanvas(favSize, favSize);
const favCtx = favCanvas.getContext('2d');

const favGrad = favCtx.createRadialGradient(24, 24, 5, 24, 24, 28);
favGrad.addColorStop(0, '#245840');
favGrad.addColorStop(1, '#1B3D2F');
favCtx.fillStyle = favGrad;
favCtx.fillRect(0, 0, favSize, favSize);

drawBin(favCtx, 24, 22, 0.1, '#8BC34A');

const favOut = path.join(__dirname, '..', 'app', 'assets', 'images', 'favicon.png');
fs.writeFileSync(favOut, favCanvas.toBuffer('image/png'));
console.log(`Favicon saved: ${favOut}`);

console.log('\nAll icons generated!');
