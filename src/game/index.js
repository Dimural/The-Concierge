// The Concierge — game loop, world objects, HUD & screens (Task 4).
// createGame() contract per the Task 4 brief's "Shared contracts" section.
// This module owns everything under src/game/ and injects its own DOM/CSS;
// it never touches main.js, index.html, or any other task's files.
import * as THREE from 'three';
import { SPAWN } from '../layout.js';
import {
  GENERATOR_IDS, GENERATOR_META, FRONT_DESK_POS, EXIT_ROOM,
  GEN_RADIUS, DESK_RADIUS, EXIT_RADIUS,
  createGeneratorState, allGeneratorsDone, objectiveText,
  stepHold, dist2D, checkDeskSubmission, createDedupe,
} from './logic.js';
import {
  findRoom, doorWorldPos, buildGenerators, buildFrontDesk, buildExitGlow,
} from './worldObjects.js';
import { createHud } from './hud.js';
import { createScreens } from './screens.js';
import { showDeskForm } from './deskForm.js';
import { createJudgePanel } from './judgePanel.js';
import * as sfx from './sfx.js';

const FALLBACK_CLUES = {
  A: 'A RECORD SURFACES: A GRAND RAILWAY HOTEL ONCE STOOD AT THE FOOT OF THIS STREET.',
  B: 'A RECORD SURFACES: GUESTS ONCE LEFT WORD OF ITS HOSPITALITY, ROOM AFTER ROOM.',
  C: 'A RECORD SURFACES: A NIGHTLY RATE, ONCE POSTED, IS NOW BARELY LEGIBLE.',
  D: 'A RECORD SURFACES: THE HOUSE RULES REMAIN, EVEN IF THE HOUSE FORGOT THEM.',
};

const RESTORATION_LINES = [
  'PROPERTY IDENTITY RESTORED',
  'UNREGISTERED OCCUPANT DETECTED',
  'FINAL CHECKOUT AUTHORIZED',
];

const ARRIVAL_LINES = [
  'A NEW RESERVATION HAS ENTERED THE LEDGER',
  'THE CONCIERGE CAN SEE',
];

class Game {
  constructor({ scene, floors, colliders, player, camera }) {
    this.scene = scene;
    this.floors = floors;
    this.colliders = colliders;
    this.player = player;
    this.camera = camera;

    this.session = null;
    this.presage = null;
    this.ghost = null;

    // exposed hooks (set by the integrator — Task 5)
    this.onSound = null;
    this.onBell = null;
    this.onGeneratorSound = null;
    this.onLightsFlicker = null;
    this.onSimulateBooking = null;
    this.onRetry = null;

    this._state = 'arrival';
    this._genState = createGeneratorState();
    this._deskDone = false;
    this._exitUnlocked = false;
    this._forgivenessUsed = false;
    this._arrivalDedupe = createDedupe();
    this._arrivalBusy = false;
    this._eHeld = false;
    this._holdGenId = null;
    this._holdProgress = 0;
    this._effects = []; // { update(dt) => keepGoing:bool }
    this._timers = [];
    this._deskForm = null;
    this._presageOwnIndicator = false;
    this._lastGhostState = null; // for edge-triggering the near-miss stinger
    this._dreadTimer = 0; // heartbeat cadence during finalHunt
    this._camSwayT = 0;

    this._buildWorld();

    this.hud = createHud();
    this.screens = createScreens();
    this.judgePanel = createJudgePanel({
      getSessionInfo: () => (this.session
        ? { live: this.session.live, propertyName: this.session.property?.name }
        : { live: false, propertyName: 'no session attached yet' }),
      getPresageInfo: () => (this.presage
        ? {
          mode: this.presage.mode,
          talking: this.presage.signals?.talking ? 1 : 0,
          talkingConfidence: this.presage.signals?.talkingConfidence,
          breathingIntensity: this.presage.signals?.breathingIntensity,
          breathingConfidence: this.presage.signals?.breathingConfidence,
        }
        : {}),
      getGhostInfo: () => (this.ghost
        ? { state: this.ghost.state, alertness: this.ghost.alertness, eyesOpen: this.ghost.eyesOpen }
        : {}),
      onSimulateBooking: () => this.onSimulateBooking?.(),
      onForceNewArrival: () => this.onNewArrival({ id: `forced-${Date.now()}` }),
      onCompleteAllGenerators: () => this._completeAllGenerators(),
      onSkipToDesk: () => this._skipToDesk(),
      onWin: () => this._win(),
    });

    this._onKeyUp = (e) => { if (e.code === 'KeyE') this._eHeld = false; };
    this._onHotkeys = (e) => {
      if (e.code === 'Backquote') { this.judgePanel.toggle(); }
      else if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) this.hud.toggleJournal(); }
    };
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('keydown', this._onHotkeys);
  }

  // ------------------------------------------------------------------ world

  _buildWorld() {
    const genBuild = buildGenerators(this.floors, GENERATOR_META);
    this.scene.add(genBuild.group);
    this.colliders.push(...genBuild.colliders);
    this.generators = genBuild.generators;

    const desk = buildFrontDesk(FRONT_DESK_POS);
    this.scene.add(desk.group);
    this.colliders.push(...desk.colliders);
    this.deskPos = FRONT_DESK_POS;

    const found = findRoom(this.floors, EXIT_ROOM.floor, EXIT_ROOM.name);
    if (found) {
      this.exitPos = doorWorldPos(found.room, found.floor, 'S');
    } else {
      this.exitPos = { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z };
    }
    const exitGlow = buildExitGlow(this.exitPos);
    this.scene.add(exitGlow.group);
    this._exitGlow = exitGlow;
  }

  // --------------------------------------------------------------- attach*

  attachSession(session) { this.session = session; }

  attachPresage(presage) {
    this.presage = presage;
    const candidate = presage?.indicatorEl || presage?.captureIndicatorEl || presage?.indicator || presage?.dot || null;
    if (candidate instanceof HTMLElement) {
      this.hud.setCapture(candidate);
    } else {
      this._presageOwnIndicator = true;
    }
  }

  attachGhost(ghost) { this.ghost = ghost; }

  // ------------------------------------------------------------------ flow

  get state() { return this._state; }

  start() {
    this._state = 'arrival';
    this.screens.showArrival(() => {
      if (this._state === 'arrival') this._state = 'explore';
    });
  }

  interact() {
    if (this._state === 'won' || this._state === 'lost' || this._state === 'caught' || this._state === 'desk') return;
    this._eHeld = true;
    this._tryDiscreteInteract();
  }

  _tryDiscreteInteract() {
    const nearGen = this._nearestActiveGenerator();
    if (nearGen) return; // generators are hold-driven in update()
    if (this.deskPos && dist2D(this.player.pos, this.deskPos) < DESK_RADIUS) {
      this._interactDesk();
    }
  }

  _nearestActiveGenerator() {
    let best = null;
    let bestDist = Infinity;
    for (const id of GENERATOR_IDS) {
      const gen = this.generators[id];
      if (!gen || gen.done) continue;
      const d = dist2D(this.player.pos, gen);
      if (d < GEN_RADIUS && d < bestDist) { best = gen; bestDist = d; }
    }
    return best;
  }

  _interactDesk() {
    if (!allGeneratorsDone(this._genState)) {
      this.hud.toast('THE LEDGER REFUSES YOU. FOUR RECORDS ARE STILL MISSING.');
      sfx.uiTick();
      return;
    }
    if (!this.session || !Array.isArray(this.session.frontDesk) || this.session.frontDesk.length === 0) {
      this.hud.toast('THE FRONT DESK HAS NOTHING TO OFFER YET.');
      return;
    }
    this._state = 'desk';
    const forgivenessNote = (this.session.policy?.freeCancellation && !this._forgivenessUsed)
      ? 'This property offers free cancellation. Your first incorrect submission will be forgiven — one retry.'
      : null;
    this._deskForm = showDeskForm(this.session.frontDesk, {
      forgivenessNote,
      onSubmit: (selections) => this._onDeskSubmit(selections),
      onClose: () => { if (this._state === 'desk') this._state = 'explore'; },
    });
  }

  _onDeskSubmit(selections) {
    const { correct } = checkDeskSubmission(this.session.frontDesk, selections);
    if (correct) {
      this._deskForm?.close();
      this._deskForm = null;
      this._deskDone = true;
      this._state = 'finalHunt';
      this.hud.showBanner(RESTORATION_LINES, 3800);
      this.ghost?.startFinalHunt?.();
      this._exitUnlocked = true;
      this._exitGlow?.setUnlocked(true);
      return;
    }
    const forgivable = this.session.policy?.freeCancellation && !this._forgivenessUsed;
    if (forgivable) {
      this._forgivenessUsed = true;
      this.hud.toast('FREE CANCELLATION APPLIES. THIS SUBMISSION IS FORGIVEN — TRY AGAIN.', 3400);
      return; // form stays open for the free retry
    }
    sfx.deskBell();
    this.onBell?.();
    this.ghost?.triggerShortHunt?.(8);
    this._deskForm?.close();
    this._deskForm = null;
    this._state = 'explore';
    this.hud.toast('THE BELL RINGS WRONG. THE RECORD REJECTS YOU.');
  }

  // -------------------------------------------------------------- update()

  update(dt) {
    // bridge Presage signals into the entity every frame, if both attached
    if (this.presage && this.ghost?.applySignals) {
      const s = this.presage.signals || {};
      this.ghost.applySignals({
        talking: !!s.talking,
        talkingConfidence: s.talkingConfidence ?? 0,
        breathingIntensity: s.breathingIntensity ?? 0,
        breathingConfidence: s.breathingConfidence ?? 0,
      });
    }

    if (this._presageOwnIndicator && this.presage) {
      const active = this.presage.mode === 'presage' || this.presage.mode === 'fallback';
      const label = this.presage.mode === 'presage' ? 'PRESAGE ACTIVE'
        : this.presage.mode === 'fallback' ? 'CAPTURE ACTIVE (LOCAL)' : 'REDUCED MODE';
      this.hud.setCapture(null, active, label);
    }

    if (this.ghost) this.hud.setEyesHint(!!this.ghost.eyesOpen);

    this._updateScareEffects(dt);

    // tick one-off visual effects (generator flicker / restored-signage
    // sprites / the catch jumpscare's camera shake) — runs regardless of
    // state so the jumpscare still plays out after a catch has already
    // moved _state off 'explore'/'finalHunt'
    this._effects = this._effects.filter((fx) => fx.update(dt));

    if (this._state !== 'explore' && this._state !== 'finalHunt') return;

    this.hud.setObjective(objectiveText(this._genState, this._deskDone));
    this._updateInteractionPrompt(dt);

    if (this._state === 'finalHunt' && this._exitUnlocked && this.exitPos) {
      if (dist2D(this.player.pos, this.exitPos) < EXIT_RADIUS) this._win();
    }
  }

  // -------------------------------------------------------- scares/dread

  // Near-miss stinger (hunt/pursuit kicking off close to the player) and
  // the finalHunt sustained-dread heartbeat/vignette/camera-sway. Skipped
  // entirely while a catch jumpscare is already owning the camera/sfx, or
  // once the run has ended, so effects never fight each other.
  _updateScareEffects(dt) {
    if (!this.ghost || !this.ghost.object) return;
    const blocked = this._state === 'caught' || this._state === 'lost' || this._state === 'won';
    const st = this.ghost.state;
    const d = dist2D(this.player.pos, this.ghost.object.position);

    if (st !== this._lastGhostState) {
      if (!blocked && (st === 'hunt' || st === 'pursuit') && d <= 25) {
        sfx.nearMissSting();
        this.hud.pulse();
      }
      this._lastGhostState = st;
    }

    if (!blocked && st === 'finalHunt') {
      const proximity = Math.max(0, Math.min(1, 1 - d / 70)); // 0 far, 1 right on top of the player
      this._dreadTimer -= dt;
      if (this._dreadTimer <= 0) {
        const bpm = 46 + proximity * 78; // heartbeat speeds up as it closes the distance
        this._dreadTimer = 60 / bpm;
        sfx.heartbeatPulse(0.35 + proximity * 0.9);
      }
      this.hud.setDread(0.12 + proximity * 0.88);
      this._camSwayT += dt * (1.3 + proximity * 2.6);
      this.camera.rotation.z += Math.sin(this._camSwayT) * (0.01 + proximity * 0.03);
      this.camera.rotation.x += Math.sin(this._camSwayT * 0.7) * (0.004 + proximity * 0.012);
    } else {
      this.hud.setDread(0);
      this._dreadTimer = 0;
      this._camSwayT = 0;
    }
  }

  // The catch jumpscare: a violent, scripted beat between "you got caught"
  // and the lose screen. Orchestrates across the pieces each module already
  // owns — ghost.js plays the lunge (entity animation), sfx.js supplies the
  // sting, hud.js owns the flash overlay (DOM/CSS, like every other screen
  // effect) — and drives the camera directly, since createGame() is already
  // handed the camera reference (no need to tangle main.js in for this).
  _playCatchJumpscare(onDone) {
    sfx.catchSting();
    this.hud.flashJumpscare(1300);
    this.ghost?.playCatchLunge?.(this.player.pos);

    let t = 0;
    const DUR = 1.3;
    this._effects.push({
      update: (dt) => {
        t += dt;
        // keep the camera snapped onto the entity's head as it lunges in
        const gp = this.ghost?.object?.position;
        if (gp) {
          const look = gp.clone();
          look.y += 4.4;
          this.camera.lookAt(look);
        }
        // violent, jerky shake — quantized like the entity's own stop-motion
        // gait, but rougher and faster, easing out over the back half so it
        // settles just before the lose screen fades in
        const decay = Math.max(0, 1 - Math.max(0, t - DUR * 0.35) / (DUR * 0.65));
        const qt = Math.floor(t * 22) / 22;
        this.camera.rotation.x += (Math.sin(qt * 71.3) + Math.sin(qt * 27.1)) * 0.05 * decay;
        this.camera.rotation.y += (Math.sin(qt * 61.7) + Math.sin(qt * 18.9)) * 0.05 * decay;
        this.camera.rotation.z += Math.sin(qt * 83.4) * 0.03 * decay;
        this.camera.position.x += (Math.random() - 0.5) * 0.5 * decay;
        this.camera.position.y += (Math.random() - 0.5) * 0.35 * decay;
        this.camera.position.z += (Math.random() - 0.5) * 0.5 * decay;

        if (t >= DUR) { onDone?.(); return false; }
        return true;
      },
    });
  }

  _updateInteractionPrompt(dt) {
    const nearGen = this._nearestActiveGenerator();
    if (this._eHeld && nearGen) {
      if (this._holdGenId !== nearGen.id) { this._holdGenId = nearGen.id; this._holdProgress = 0; }
      this._holdProgress = stepHold(this._holdProgress, dt);
      const pct = Math.round(this._holdProgress * 100);
      this.hud.setPrompt(`HOLD [E] — RESTORING ${nearGen.label.toUpperCase()} ${pct}%`);
      if (this._holdProgress >= 1) this._completeGenerator(nearGen);
      return;
    }
    this._holdProgress = 0;
    this._holdGenId = null;
    if (nearGen) {
      this.hud.setPrompt(`HOLD [E] TO INTERACT — ${nearGen.label.toUpperCase()}`);
      return;
    }
    if (this.deskPos && dist2D(this.player.pos, this.deskPos) < DESK_RADIUS) {
      this.hud.setPrompt(allGeneratorsDone(this._genState)
        ? '[E] SPEAK TO THE FRONT DESK'
        : '[E] THE DESK IS SILENT — RECORDS INCOMPLETE');
      return;
    }
    this.hud.setPrompt(null);
  }

  _completeGenerator(gen) {
    if (gen.done) return;
    gen.done = true;
    this._genState[gen.id] = true;
    this._holdProgress = 0;
    this._holdGenId = null;

    sfx.generatorClunk();
    this.onGeneratorSound?.();
    this.onSound?.({ x: gen.x, z: gen.z, loudness: 1.2, kind: 'generator' });

    gen.screenMat.emissive.setHex(0x6dffc0);
    gen.screenMat.emissiveIntensity = 1.3;
    this._runRestorationBeat(gen);

    const text = this.session?.clues?.[gen.id]?.[0] || FALLBACK_CLUES[gen.id];
    this.hud.addClue(gen.id, gen.label, text);
    this.hud.setPrompt(null);
  }

  _runRestorationBeat(gen) {
    // flicker the point light for ~1s, then settle to a steady glow
    let t = 0;
    this._effects.push({
      update(dt) {
        t += dt;
        if (t < 1.0) {
          gen.glow.intensity = (Math.sin(t * 40) > 0 ? 2.4 : 0.2) * Math.min(1, t * 3);
          return true;
        }
        gen.glow.intensity = 1.1;
        return false;
      },
    });

    // floating restored-signage sprite
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx2d = canvas.getContext('2d');
    ctx2d.font = '46px "Special Elite", monospace';
    ctx2d.fillStyle = '#f2e6b8';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText('RECORD RESTORED', 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6, 1.5, 1);
    sprite.position.set(gen.x, gen.y + 6.4, gen.z);
    this.scene.add(sprite);

    let st = 0;
    const dur = 3.2;
    this._effects.push({
      update(dt) {
        st += dt;
        sprite.position.y += dt * 0.5;
        mat.opacity = st < 0.4 ? st / 0.4 : Math.max(0, 1 - (st - 0.4) / (dur - 0.4));
        if (st >= dur) {
          sprite.parent?.remove(sprite);
          mat.dispose();
          tex.dispose();
          return false;
        }
        return true;
      },
    });
  }

  // -------------------------------------------------------------- new arrival

  onNewArrival(txn) {
    if (!txn || txn.id == null) return;
    if (this._state === 'won' || this._state === 'lost' || this._arrivalBusy) return;
    if (!this._arrivalDedupe.tryAdd(txn.id)) return;

    this._arrivalBusy = true;
    const t1 = setTimeout(() => {
      sfx.deskBell();
      this.onBell?.();
      this.hud.showBanner(ARRIVAL_LINES, 3400);
      this.onLightsFlicker?.();
      this.ghost?.triggerNewArrival?.(15);
      const t2 = setTimeout(() => {
        this.hud.toast('he covers his eyes again.');
        this._arrivalBusy = false;
      }, 15000 + 500);
      this._timers.push(t2);
    }, 800);
    this._timers.push(t1);
  }

  // -------------------------------------------------------------- lose/retry

  handleCatch() {
    if (this._state === 'won' || this._state === 'lost' || this._state === 'caught') return;
    // 'caught' is a short transitional state (not part of the documented
    // state union) that only exists to own the jumpscare beat between the
    // catch and the lose screen; see _playCatchJumpscare.
    this._state = 'caught';
    this._deskForm?.close();
    this._deskForm = null;
    this.hud.setPrompt(null);
    this._playCatchJumpscare(() => {
      // something else (a judge-panel action) already moved the game on
      // while the jumpscare was mid-flight — don't stomp it with 'lost'
      if (this._state !== 'caught') return;
      this._state = 'lost';
      this.screens.showLose(() => {
        this.player.pos.set(SPAWN.x, SPAWN.y, SPAWN.z);
        this.player.vel.set(0, 0, 0);
        this._state = this._deskDone ? 'finalHunt' : 'explore';
        this.onRetry?.();
      });
    });
  }

  // -------------------------------------------------------------- win

  _win() {
    if (this._state === 'won') return;
    this._state = 'won';
    this._deskForm?.close();
    this._deskForm = null;
    this.hud.setPrompt(null);
    this.screens.showWin({ property: this.session?.property, bookingLink: this.session?.bookingLink });
  }

  // -------------------------------------------------------------- judge-panel actions

  _completeAllGenerators() {
    for (const id of GENERATOR_IDS) {
      const gen = this.generators[id];
      if (!gen || gen.done) continue;
      gen.done = true;
      this._genState[id] = true;
      gen.screenMat.emissive.setHex(0x6dffc0);
      gen.screenMat.emissiveIntensity = 1.3;
      gen.glow.intensity = 1.1;
      const text = this.session?.clues?.[id]?.[0] || FALLBACK_CLUES[id];
      this.hud.addClue(id, gen.label, text);
    }
  }

  _skipToDesk() {
    this._completeAllGenerators();
    if (this._state !== 'won' && this._state !== 'lost' && this._state !== 'caught') this._interactDesk();
  }
}

export function createGame(args) {
  return new Game(args);
}
