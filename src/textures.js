// Procedural canvas textures — worn hotel finishes without any asset files.
import * as THREE from 'three';

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noise(ctx, size, alpha, dark = true) {
  for (let i = 0; i < size * 18; i++) {
    const s = 1 + Math.random() * 2.5;
    ctx.fillStyle = `rgba(${dark ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
}

function stains(ctx, size, count, color = '10,8,6') {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 8 + Math.random() * 42;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${0.12 + Math.random() * 0.22})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export function carpetTexture() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#3d1216';
    ctx.fillRect(0, 0, s, s);
    // ornate diamond lattice
    ctx.strokeStyle = 'rgba(150,110,60,0.35)';
    ctx.lineWidth = 3;
    const step = 64;
    for (let x = -s; x < s * 2; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, s); ctx.lineTo(x + s, 0); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,80,40,0.5)';
    for (let x = step / 2; x < s; x += step) {
      for (let y = step / 2; y < s; y += step) {
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      }
    }
    noise(ctx, s, 0.28);
    stains(ctx, s, 14);
  });
}

export function corridorCarpetTexture() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#26212c';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(140,100,55,0.22)';
    ctx.lineWidth = 2;
    for (let y = 0; y < s; y += 42) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    for (let x = 0; x < s; x += 42) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    noise(ctx, s, 0.3);
    stains(ctx, s, 18);
  });
}

export function wallpaperTexture() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#57503e';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 26) {
      ctx.fillStyle = x % 52 ? 'rgba(70,64,48,0.9)' : 'rgba(96,88,66,0.9)';
      ctx.fillRect(x, 0, 14, s);
    }
    // grime creeping from the bottom edge
    const g = ctx.createLinearGradient(0, s * 0.55, 0, s);
    g.addColorStop(0, 'rgba(12,10,8,0)');
    g.addColorStop(1, 'rgba(12,10,8,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 0.22);
    stains(ctx, s, 10);
  });
}

export function plasterTexture() {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = '#8a857c';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 0.18);
    stains(ctx, s, 8, '30,26,20');
  });
}

export function ceilingTileTexture() {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = '#7e796f';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(30,28,24,0.7)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= s; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
    noise(ctx, s, 0.2);
    stains(ctx, s, 9, '40,32,18');
  });
}

export function woodTexture() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#4a3220';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      ctx.fillStyle = `rgba(${30 + Math.random() * 40},${18 + Math.random() * 26},${8 + Math.random() * 14},0.65)`;
      ctx.fillRect(0, y, s, 30);
      ctx.strokeStyle = 'rgba(15,9,4,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    noise(ctx, s, 0.18);
    stains(ctx, s, 8);
  });
}

export function marbleTexture() {
  return canvas(512, (ctx, s) => {
    ctx.fillStyle = '#9b968c';
    ctx.fillRect(0, 0, s, s);
    // veins
    ctx.strokeStyle = 'rgba(60,56,50,0.35)';
    for (let i = 0; i < 26; i++) {
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      let x = Math.random() * s, y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.5) * 120;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(35,32,28,0.8)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= s; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
    noise(ctx, s, 0.14);
    stains(ctx, s, 12, '20,18,14');
  });
}

export function tileTexture() {
  return canvas(256, (ctx, s) => {
    const t = 32;
    for (let x = 0; x < s; x += t) {
      for (let y = 0; y < s; y += t) {
        const light = (x / t + y / t) % 2 === 0;
        ctx.fillStyle = light ? '#7d7a72' : '#4c4a44';
        ctx.fillRect(x, y, t, t);
      }
    }
    noise(ctx, s, 0.25);
    stains(ctx, s, 14, '25,20,12');
  });
}

export function metalTexture() {
  return canvas(256, (ctx, s) => {
    ctx.fillStyle = '#5a5c5e';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
      ctx.fillRect(0, y, s, 2);
    }
    noise(ctx, s, 0.22);
    stains(ctx, s, 10, '30,22,10');
  });
}

export function plaqueTexture(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#211c14';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#8a744a';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 84);
  ctx.fillStyle = '#c9b585';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 30;
  ctx.font = `${size}px Georgia, serif`;
  while (ctx.measureText(name.toUpperCase()).width > 224 && size > 12) {
    size -= 2;
    ctx.font = `${size}px Georgia, serif`;
  }
  ctx.fillText(name.toUpperCase(), 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeMaterials() {
  const rep = (tex, x, y) => { const t = tex.clone(); t.repeat.set(x, y); t.needsUpdate = true; return t; };
  const carpet = carpetTexture();
  const corridor = corridorCarpetTexture();
  const wallpaper = wallpaperTexture();
  const plaster = plasterTexture();
  const ceilTile = ceilingTileTexture();
  const wood = woodTexture();
  const marble = marbleTexture();
  const tile = tileTexture();
  const metal = metalTexture();

  return {
    wall: new THREE.MeshStandardMaterial({ map: rep(wallpaper, 0.14, 0.1), roughness: 0.92 }),
    shellWall: new THREE.MeshStandardMaterial({ map: rep(plaster, 0.08, 0.08), color: 0x9a9285, roughness: 0.95 }),
    // floor-slab materials are DoubleSide: the slab ShapeGeometry is rotated
    // from the XY plane and its faces wind downward, so single-sided slabs
    // would be invisible from above (three.js flips backface normals, so
    // lighting stays correct).
    corridorFloor: new THREE.MeshStandardMaterial({ map: rep(corridor, 0.09, 0.09), roughness: 0.97, side: THREE.DoubleSide }),
    roomCarpet: new THREE.MeshStandardMaterial({ map: rep(carpet, 0.08, 0.08), roughness: 0.97 }),
    wood: new THREE.MeshStandardMaterial({ map: rep(wood, 0.1, 0.1), roughness: 0.6 }),
    marble: new THREE.MeshStandardMaterial({ map: rep(marble, 0.11, 0.11), roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }),
    tile: new THREE.MeshStandardMaterial({ map: rep(tile, 0.2, 0.2), roughness: 0.5 }),
    ceiling: new THREE.MeshStandardMaterial({ map: rep(ceilTile, 0.25, 0.25), roughness: 0.95, side: THREE.DoubleSide }),
    plasterCeiling: new THREE.MeshStandardMaterial({ map: rep(plaster, 0.1, 0.1), color: 0x7a746a, roughness: 0.95, side: THREE.DoubleSide }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2e2318, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ map: rep(metal, 0.3, 0.3), color: 0x4e5154, roughness: 0.55, metalness: 0.7 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5, metalness: 0.6 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x6e6656, roughness: 1 }),
    chair: new THREE.MeshStandardMaterial({ color: 0x3a2a30, roughness: 0.85 }),
  };
}
