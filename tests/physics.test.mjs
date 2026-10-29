import test from 'node:test';
import assert from 'node:assert/strict';
import { GamePhysics, TUNING } from '../src/physics.js';
import { BotAI } from '../src/ai.js';
import { Match } from '../src/match.js';
const tick = (p, seconds, controls = [{}, {}]) => { for (let i = 0; i < Math.round(seconds * 120); i++) p.step(1 / 120, typeof controls === 'function' ? controls(i) : controls); };

test('a resting ball and suspended cars remain stable for ten seconds', () => {
  const p = new GamePhysics(); tick(p, 10);
  assert.ok(Math.abs(p.ball.position.y - TUNING.ballRadius) < .08);
  assert.ok(p.cars.every(c => c.body.position.y > .65 && c.body.position.y < 1.1 && c.onGround));
});

test('gravity creates a genuine floor bounce', () => {
  const p = new GamePhysics(); p.ball.position.set(0, 9, 0);
  let bounced = false;
  for (let i = 0; i < 240; i++) { p.step(1 / 120); if (p.ball.velocity.y > 5) bounced = true; }
  assert.ok(bounced);
  assert.ok(p.ball.position.y >= 1.7);
});

test('high speed ball collides with side wall and stays enclosed', () => {
  const p = new GamePhysics(); p.ball.position.set(25, 10, 0); p.ball.velocity.set(88, 0, 0);
  tick(p, .2);
  assert.ok(p.ball.velocity.x < -30);
  assert.ok(p.ball.position.x < 34);
});

test('goal is a physical opening, while the adjacent back wall blocks a ball', () => {
  const p = new GamePhysics(); p.ball.position.set(0, 2.5, 47); p.ball.velocity.set(0, 0, 35);
  tick(p, .25); assert.ok(p.ball.position.z > 53.8);
  p.ball.position.set(15, 5, 47); p.ball.velocity.set(0, 0, 35);
  tick(p, .3); assert.ok(p.ball.velocity.z < 0); assert.ok(p.ball.position.z < 52);
});

test('throttle, steering, boost, braking, and momentum affect the rigid body', () => {
  const p = new GamePhysics(), b = p.cars[0].body;
  b.position.x = 5;
  tick(p, .6, [{ throttle: 1 }, {}]);
  assert.ok(b.position.z > -31); assert.ok(b.velocity.z > 10);
  const before = b.velocity.length(); tick(p, .3, [{ throttle: 1, boost: true }, {}]);
  assert.ok(b.velocity.length() > before + 6); assert.ok(p.cars[0].boost < 33);
  tick(p, .35, [{ throttle: 1, steer: 1 }, {}]);
  assert.ok(b.quaternion.y > .05); assert.ok(b.velocity.x > .2);
  const momentum = b.velocity.length(); tick(p, .1);
  assert.ok(b.velocity.length() > momentum * .7);
  tick(p, .5, [{ throttle: -1 }, {}]); assert.ok(b.velocity.length() < momentum);
});

test('jump, air control, and a directional second jump produce real impulses', () => {
  const p = new GamePhysics(), car = p.cars[0], b = car.body;
  tick(p, .1); p.step(1 / 120, [{ jump: true }, {}]);
  assert.ok(b.velocity.y > 8); assert.equal(car.jumps, 1);
  tick(p, .15, [{ pitch: -.7 }, {}]);
  assert.ok(Math.abs(b.quaternion.x) > .01);
  p.step(1 / 120, [{ jump: true, pitch: -1 }, {}]);
  assert.equal(car.jumps, 2); assert.ok(b.velocity.z > 10); assert.ok(b.angularVelocity.length() > 10);
});

test('airborne boosting accelerates along the actual car orientation and consumes fuel', () => {
  const a = new GamePhysics(), b = new GamePhysics();
  for (const p of [a, b]) {
    p.cars[0].body.position.set(5, 10, -20);
    p.cars[0].body.quaternion.setFromEuler(-Math.PI / 6, 0, 0);
  }
  tick(a, .35, [{ boost: true }, {}]); tick(b, .35);
  assert.ok(a.cars[0].body.velocity.z > b.cars[0].body.velocity.z + 10);
  assert.ok(a.cars[0].body.velocity.y > b.cars[0].body.velocity.y + 5);
  assert.ok(a.cars[0].boost < b.cars[0].boost);
});

test('rounded ramp carries a driving car onto an upright wall', () => {
  const p = new GamePhysics(), car = p.cars[0];
  car.body.position.set(24, .85, 8);
  car.body.quaternion.setFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2);
  car.body.velocity.set(16, 0, 0);
  tick(p, 1.6, [{ throttle: 1, boost: true }, {}]);
  assert.ok(car.body.position.y > 10, `car climbed only to ${car.body.position.y}`);
  assert.ok(car.body.position.x < 34);
  assert.ok(car.onGround);
  assert.ok(car.groundNormal.x < -.9);
});

test('a boosted moving car changes the ball velocity with a physical contact', () => {
  const p = new GamePhysics(), b = p.cars[0].body;
  b.position.set(0, .85, -8); p.ball.position.set(0, 1.85, 0);
  tick(p, .9, [{ throttle: 1, boost: true }, {}]);
  assert.ok(p.ball.velocity.z > 8); assert.ok(p.events.some(e => e.type === 'impact'));
});

test('boost pad collection and cooldown have deterministic state transitions', () => {
  const p = new GamePhysics(), pad = p.pads[0], car = p.cars[0];
  car.body.position.set(pad.x, .85, pad.z); car.boost = 1;
  p.step(1 / 120); assert.equal(pad.active, false); assert.equal(car.boost, 13);
  car.body.position.set(0, .85, -45); tick(p, 4.1);
  assert.equal(pad.active, true); assert.equal(pad.cooldown, 0);
});

test('kickoff reset restores all bodies and boost pads', () => {
  const p = new GamePhysics(); tick(p, 1, [{ throttle: 1, boost: true, jump: true }, {}]);
  p.reset();
  assert.equal(p.cars[0].body.position.z, -34); assert.equal(p.cars[1].body.position.z, 34);
  assert.equal(p.cars[0].boost, 33); assert.equal(p.ball.position.z, 0);
  assert.equal(p.ball.velocity.length(), 0); assert.ok(p.pads.every(p => p.active));
});

test('predictive bot participates, reaches the kickoff ball, and generates a hit', () => {
  const p = new GamePhysics(), ai = new BotAI(1, 'expert');
  tick(p, 8, () => [{}, ai.update(p, 1 / 120)]);
  assert.ok(p.cars[1].body.position.z < 20);
  assert.ok(p.events.some(e => e.type === 'impact' && e.car === 1));
  assert.ok(Number.isFinite(p.ball.position.lengthSquared()));
});

test('equivalent fixed physics steps produce identical results regardless of render batching', () => {
  const a = new GamePhysics(), b = new GamePhysics();
  for (let frame = 0; frame < 60; frame++) for (let s = 0; s < 2; s++) a.step(1 / 120, [{ throttle: 1, steer: .2 }, {}]);
  for (let frame = 0; frame < 30; frame++) for (let s = 0; s < 4; s++) b.step(1 / 120, [{ throttle: 1, steer: .2 }, {}]);
  assert.ok(a.cars[0].body.position.distanceTo(b.cars[0].body.position) < 1e-8);
});

test('an inverted bot self-rights using the same jump and air controls as a human', () => {
  const p = new GamePhysics(), ai = new BotAI(1, 'expert'), car = p.cars[1];
  car.body.position.set(6, .5, 30);
  car.body.quaternion.setFromEuler(0, Math.PI, Math.PI);
  let recovered = false;
  for (let i = 0; i < 120 * 6; i++) {
    p.step(1 / 120, [{}, ai.update(p, 1 / 120)]);
    if (car.onGround && car.body.quaternion.vmult({ x: 0, y: 1, z: 0 }).y > .95) recovered = true;
  }
  assert.ok(recovered);
});

test('inactive free-play opponent cannot collect boosts or collide with the ball', () => {
  const p = new GamePhysics(), car = p.cars[1], pad = p.pads[0];
  p.setCarActive(1, false); car.body.position.set(pad.x, .85, pad.z); car.boost = 0;
  p.step(1 / 120);
  assert.equal(car.boost, 0); assert.equal(pad.active, true);
  assert.equal(car.body.collisionFilterMask, 0); assert.equal(car.body.collisionResponse, false);
  p.setCarActive(1, true); p.resetCar(1);
  assert.equal(car.body.collisionFilterMask, -1); assert.equal(car.body.collisionResponse, true);
});

test('a real AI goal completes celebration, kickoff reset, and a full sixty-second match', () => {
  const p = new GamePhysics(), ai = new BotAI(1, 'intermediate'), match = new Match();
  match.start({ duration: 60 });
  let goals = 0, resets = 0, kickoffs = 0, contacts = 0;
  for (let i = 0; i < 120 * 360 && match.phase !== 'results'; i++) {
    match.tick(1 / 120);
    for (const event of match.events.splice(0)) {
      if (event.type === 'reset') { p.reset(); resets++; }
      if (event.type === 'go') kickoffs++;
    }
    if (match.phase === 'playing') {
      p.step(1 / 120, [{}, ai.update(p, 1 / 120)]);
      for (const event of p.events.splice(0)) if (event.type === 'impact' && event.car === 1) contacts++;
      if (match.checkGoal(p.ball)) goals++;
    }
  }
  assert.equal(match.phase, 'results');
  assert.ok(match.scores[1] > 0 && contacts > 0);
  assert.equal(goals, match.scores[0] + match.scores[1]);
  assert.ok(resets > 1 && kickoffs > 1);
  assert.equal(match.time, 0);
});

test('two minutes of continuous bot physics remain finite and inside the arena', () => {
  const p = new GamePhysics(), blue = new BotAI(0, 'expert'), orange = new BotAI(1, 'expert');
  for (let i = 0; i < 120 * 120; i++) {
    p.step(1 / 120, [blue.update(p, 1 / 120), orange.update(p, 1 / 120)]);
    p.events.length = 0;
    if (Math.abs(p.ball.position.z) > 53.8 && Math.abs(p.ball.position.x) < 7.2 && p.ball.position.y < 5.2) p.reset();
    for (const b of [p.ball, ...p.cars.map(c => c.body)]) {
      assert.ok(Number.isFinite(b.position.lengthSquared()) && Number.isFinite(b.velocity.lengthSquared()));
      assert.ok(Math.abs(b.position.x) < 43 && Math.abs(b.position.z) < 66 && b.position.y > -2 && b.position.y < 24);
    }
  }
});
