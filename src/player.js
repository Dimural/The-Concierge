// First-person controller with AABB collision, gravity, step-up, jump, prone.
import * as THREE from 'three';

const GRAVITY = -38; // ft/s^2, slightly gamey
const WALK = 6.8;
const RUN = 13.0;
const PRONE_SPEED = 2.2;
const JUMP_V = 12.5;
const STEP_UP = 1.25; // max ledge height climbable while grounded (escalator steps)
const RADIUS = 1.05;
const STAND_H = 5.9;
const PRONE_H = 2.0;
const STAND_EYE = 5.4;
const PRONE_EYE = 1.55;

export class Player {
  constructor(camera, colliders, spawn) {
    this.camera = camera;
    this.colliders = colliders;
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.prone = false;
    this.height = STAND_H;
    this.eye = STAND_EYE;
    this.grounded = false;
    this.bobPhase = 0;
    this.keys = new Set();
  }

  onMouseMove(dx, dy) {
    this.yaw -= dx * 0.0021;
    this.pitch -= dy * 0.0021;
    this.pitch = Math.max(-1.51, Math.min(1.51, this.pitch));
  }

  toggleProne() {
    if (this.prone) {
      if (this.headroom(STAND_H)) this.prone = false;
    } else {
      this.prone = true;
    }
  }

  headroom(h) {
    return !this.collides(this.pos.x, this.pos.y, this.pos.z, h);
  }

  collides(x, y, z, h = this.height) {
    const x0 = x - RADIUS, x1 = x + RADIUS;
    const y0 = y + 0.001, y1 = y + h;
    const z0 = z - RADIUS, z1 = z + RADIUS;
    for (const c of this.colliders) {
      if (x0 < c.x1 && x1 > c.x0 && y0 < c.y1 && y1 > c.y0 && z0 < c.z1 && z1 > c.z0) return c;
    }
    return null;
  }

  // highest collider top within [y-probe, y] under the feet footprint
  groundAt(x, y, z) {
    const x0 = x - RADIUS, x1 = x + RADIUS;
    const z0 = z - RADIUS, z1 = z + RADIUS;
    let best = -Infinity;
    for (const c of this.colliders) {
      if (x0 < c.x1 && x1 > c.x0 && z0 < c.z1 && z1 > c.z0) {
        if (c.y1 <= y + 0.05 && c.y1 > best) best = c.y1;
      }
    }
    return best;
  }

  update(dt, input) {
    const keys = input.keys;
    this.height = this.prone ? PRONE_H : STAND_H;
    const targetEye = this.prone ? PRONE_EYE : STAND_EYE;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 10);

    // wish direction in world space from yaw
    let fw = 0, st = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fw += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fw -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) st += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) st -= 1;
    const running = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !this.prone;
    const speed = this.prone ? PRONE_SPEED : running ? RUN : WALK;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let wx = (-sin * fw + cos * st);
    let wz = (-cos * fw - sin * st);
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx = (wx / wl) * speed; wz = (wz / wl) * speed; }

    // horizontal velocity eases toward the wish velocity
    const accel = this.grounded ? 12 : 3;
    this.vel.x += (wx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wz - this.vel.z) * Math.min(1, accel * dt);

    // jump
    if (input.jumpQueued && this.grounded && !this.prone) {
      this.vel.y = JUMP_V;
      this.grounded = false;
    }
    input.jumpQueued = false;

    // vertical
    this.vel.y += GRAVITY * dt;
    let ny = this.pos.y + this.vel.y * dt;
    const hitY = this.collides(this.pos.x, ny, this.pos.z);
    if (hitY) {
      if (this.vel.y <= 0 && hitY.y1 <= this.pos.y + STEP_UP) {
        ny = hitY.y1; // land
        this.vel.y = 0;
        this.grounded = true;
      } else {
        ny = this.pos.y; // head bump or wedged
        this.vel.y = Math.min(this.vel.y, 0);
      }
    } else if (this.vel.y < -0.1) {
      this.grounded = false;
    }
    this.pos.y = ny;

    // horizontal, one axis at a time, with step-up
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);

    // ground snap while walking down steps
    if (this.grounded && this.vel.y <= 0) {
      const g = this.groundAt(this.pos.x, this.pos.y + 0.1, this.pos.z);
      if (g > -Infinity && this.pos.y - g < STEP_UP && this.pos.y > g) {
        this.pos.y = g;
        this.vel.y = 0;
      } else if (g === -Infinity || this.pos.y - g > STEP_UP) {
        this.grounded = false;
      }
    }

    // head bob + camera
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && hSpeed > 0.5) {
      this.bobPhase += dt * (running ? 11 : 7.5);
    } else {
      this.bobPhase *= 1 - Math.min(1, dt * 4);
    }
    const bob = Math.sin(this.bobPhase) * (running ? 0.14 : 0.07) * Math.min(1, hSpeed / WALK);
    const breathe = Math.sin(performance.now() * 0.0012) * 0.02;

    this.camera.position.set(this.pos.x, this.pos.y + this.eye + bob + breathe, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = Math.sin(this.bobPhase * 0.5) * 0.004;

    // safety: fell out of the world -> respawn at current floor height
    if (this.pos.y < -80) { this.pos.set(118, 0, 121.4); this.vel.set(0, 0, 0); }
  }

  moveAxis(axis, delta) {
    if (Math.abs(delta) < 1e-6) return;
    const next = this.pos[axis] + delta;
    const x = axis === 'x' ? next : this.pos.x;
    const z = axis === 'z' ? next : this.pos.z;
    const hit = this.collides(x, this.pos.y, z);
    if (!hit) { this.pos[axis] = next; return; }
    // try stepping up onto low ledges (stairs, escalator steps)
    if (this.grounded && hit.y1 - this.pos.y <= STEP_UP && hit.y1 > this.pos.y) {
      if (!this.collides(x, hit.y1, z)) {
        this.pos[axis] = next;
        this.pos.y = hit.y1;
        return;
      }
    }
    // slide: clamp against the collider face
    if (axis === 'x') {
      this.pos.x = delta > 0 ? hit.x0 - RADIUS - 0.001 : hit.x1 + RADIUS + 0.001;
      this.vel.x = 0;
    } else {
      this.pos.z = delta > 0 ? hit.z0 - RADIUS - 0.001 : hit.z1 + RADIUS + 0.001;
      this.vel.z = 0;
    }
  }
}
