const textureCache = new Map();

function randomFrom(seed) {
  let state = (seed >>> 0) || 1;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

function pixelTexture(THREE, key, draw) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

export function caribbeanBuildingPixelTexture(THREE, kind = 'plaster', variant = 0) {
  return pixelTexture(THREE, `building:${kind}:${variant}`, ctx => {
    const random = randomFrom((variant + 1) * 0x45d9f3b ^ kind.length * 0x9e3779b1);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 16, 16);
    if (kind === 'wood') {
      // Quiet board joins and short grain marks, at the same pixel scale as the game's sprites.
      for (const x of [4, 9, 14]) {
        ctx.fillStyle = '#d8c9ad'; ctx.fillRect(x, 0, 1, 16);
        for (let y = 1 + Math.floor(random() * 3); y < 16; y += 5 + Math.floor(random() * 4)) {
          ctx.fillStyle = '#e7dac2'; ctx.fillRect(x + 1, y, 1 + Math.floor(random() * 2), 1);
        }
      }
      return;
    }
    const shades = ['#f1eadb', '#e5e1d3', '#dfe2d8', '#ebdfd2', '#e3dfd2'];
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = shades[Math.floor(random() * shades.length)];
      const x = Math.floor(random() * 16), y = Math.floor(random() * 16);
      const width = random() < .88 ? 1 : 2, height = 1;
      ctx.fillRect(x, y, width, height);
      if (random() < .1) ctx.fillRect(x + width, y, 1, 1);
    }
  });
}

// Keep the game's 16×16 asset drawing and add only a few climate-worn pixels.
export function weatherPixelTexture(THREE, source, materialKind, variant = 0) {
  if (!source?.image || source.userData?.hasSource === false) return source;
  const key = `weather:${source.uuid}:${materialKind}:${variant}`;
  if (textureCache.has(key)) return textureCache.get(key);
  let repaint = null;
  const texture = pixelTexture(THREE, key, ctx => {
    repaint = () => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(source.image, 0, 0, 16, 16);
    const image = ctx.getImageData(0, 0, 16, 16), data = image.data;
    const random = randomFrom((variant + 1) * 0x45d9f3b ^ materialKind.length * 0x9e3779b1);
    const palette = materialKind === 'roof'
      ? [[95, 54, 41], [205, 141, 99], [120, 67, 48]]
      : materialKind === 'stone'
        ? [[127, 118, 102], [194, 174, 139], [96, 99, 91]]
        : materialKind === 'wood'
          ? [[94, 62, 39], [164, 119, 72], [119, 82, 50]]
          : [[133, 120, 97], [205, 190, 159], [155, 143, 118]];
    const paint = (x, y, color, amount) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
      const offset = (y * 16 + x) * 4;
      if (data[offset + 3] < 128) return;
      const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (brightness < 48) return;
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = Math.round(data[offset + channel] * (1 - amount) + color[channel] * amount);
      }
    };
    const flecks = materialKind === 'plaster' ? 9 : 7;
    for (let i = 0; i < flecks; i++) {
      const x = Math.floor(random() * 16), y = Math.floor(random() * 16);
      const shade = palette[Math.floor(random() * palette.length)];
      const amount = .14 + random() * .16;
      paint(x, y, shade, amount);
      if (random() < .34) paint(x + (random() < .5 ? 1 : -1), y, shade, amount * .75);
    }
    ctx.putImageData(image, 0, 0);
    };
    repaint();
  });
  source.addEventListener?.('update', () => { repaint?.(); texture.needsUpdate = true; });
  return texture;
}

export function caribbeanGroundTexture(THREE, kind = 'farm', variant = 0) {
  return pixelTexture(THREE, `ground:${kind}:${variant}`, ctx => {
    const random = randomFrom((variant + 1) * 0x27d4eb2d ^ kind.length * 0x165667b1);
    const farm = kind === 'farm';
    const colors = farm
      ? ['#796044', '#8b6d4d', '#9d7a52', '#a8875d', '#6f563e']
      : ['#766d5b', '#817660', '#8c8067', '#97896e', '#6f6859', '#a09275'];
    ctx.fillStyle = colors[1]; ctx.fillRect(0, 0, 16, 16);
    if (farm) {
      for (let i = 0; i < 46; i++) {
        ctx.fillStyle = colors[Math.floor(random() * colors.length)];
        ctx.fillRect(Math.floor(random() * 16), Math.floor(random() * 16), random() < .8 ? 1 : 2, 1);
      }
      for (let row = 2; row < 16; row += 5) {
        let x = 0, y = row;
        while (x < 16) {
          const width = 2 + Math.floor(random() * 4);
          ctx.fillStyle = colors[4]; ctx.fillRect(x, y, width, 1);
          ctx.fillStyle = colors[2]; ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), 1);
          x += width;
          y += random() < .25 ? 1 : 0;
        }
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#737d4d' : '#8a8b58';
        const x = Math.floor(random() * 16), y = Math.floor(random() * 16);
        ctx.fillRect(x, y, 1, 2);
      }
    } else {
      // Quiet packed earth: irregular low-contrast clumps, no parallel wheel lines.
      for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
        const chance = random();
        if (chance < .42) continue;
        ctx.fillStyle = colors[chance > .93 ? 5 : chance > .72 ? 0 : chance > .57 ? 2 : 1];
        const x = gx * 2 + Math.floor(random() * 2), y = gy * 2 + Math.floor(random() * 2);
        ctx.fillRect(x, y, chance > .9 ? 2 : 1, 1);
        if (chance > .87) ctx.fillRect(x, (y + 1) % 16, 1, 1);
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#77715f' : '#a09275';
        ctx.fillRect(Math.floor(random() * 16), Math.floor(random() * 16), 1, 1);
      }
    }
  });
}
