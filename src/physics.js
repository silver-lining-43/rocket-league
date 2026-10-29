import * as CANNON from 'cannon-es';

export const ARENA = Object.freeze({ halfWidth: 34, halfLength: 52, height: 22, goalHalfWidth: 9, goalHeight: 7, goalDepth: 7, cornerRadius: 8 });
export const TUNING = Object.freeze({ gravity: 22, acceleration: 29, reverseAcceleration: 18, boostAcceleration: 45, driveSpeed: 32, boostSpeed: 54, boostConsumption: 27, jumpSpeed: 10, dodgeSpeed: 14, ballRadius: 1.8, ballRestitution: .76 });
const UP = new CANNON.Vec3(0, 1, 0);
const FORWARD = new CANNON.Vec3(0, 0, 1);
const RIGHT = new CANNON.Vec3(1, 0, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const position = b => ({ x: b.position.x, y: b.position.y, z: b.position.z });

/** Force-driven rigid bodies; the application supplies an invariant 120 Hz timestep. */
export class GamePhysics {
  constructor(options = {}) {
    this.options = options;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -TUNING.gravity, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 14;
    this.world.solver.tolerance = .001;
    this.world.allowSleep = false;
    this.arenaMaterial = new CANNON.Material('arena');
    this.carMaterial = new CANNON.Material('car');
    this.ballMaterial = new CANNON.Material('ball');
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.ballMaterial, this.arenaMaterial, { friction: .25, restitution: .76, contactEquationStiffness: 1e7 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.carMaterial, this.arenaMaterial, { friction: .05, restitution: .08 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.carMaterial, this.ballMaterial, { friction: .3, restitution: .72 }));
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.carMaterial, this.carMaterial, { friction: .2, restitution: .25 }));
    this.events = [];
    this.clock = 0;
    this.ballHitCooldown = new Map();
    this._buildArena();
    this.ball = new CANNON.Body({ mass: 1.1, material: this.ballMaterial, shape: new CANNON.Sphere(TUNING.ballRadius), linearDamping: .025, angularDamping: .12, collisionFilterGroup: 4 });
    this.world.addBody(this.ball);
    this.cars = ['blue', 'orange'].map((team, i) => {
      const body = new CANNON.Body({ mass: 8, material: this.carMaterial, shape: new CANNON.Box(new CANNON.Vec3(1.05, .46, 1.85)), linearDamping: .07, angularDamping: .62, collisionFilterGroup: 2 });
      body.allowSleep = false;
      this.world.addBody(body);
      return { body, team, active: true, boost: 33, onGround: false, boosting: false, jumps: 0, jumpTime: 0, dodgeTime: 0, dodgeAxis: new CANNON.Vec3(), lastJump: false, groundNormal: new CANNON.Vec3(0, 1, 0), speed: 0, impactAt: -1, index: i };
    });
    this.pads = [];
    for (const z of [-35, -18, 0, 18, 35]) for (const x of [-17, 0, 17]) {
      if (z === 0 && x === 0) continue;
      this.pads.push({ x, z, large: false, active: true, cooldown: 0 });
    }
    for (const z of [-39, 39]) for (const x of [-26, 26]) this.pads.push({ x, z, large: true, active: true, cooldown: 0 });
    this.ball.addEventListener('collide', e => this._ballImpact(e));
    this.reset();
  }

  _box(x, y, z, sx, sy, sz, angle = 0, axis = UP) {
    const b = new CANNON.Body({ mass: 0, material: this.arenaMaterial, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)), position: new CANNON.Vec3(x, y, z), collisionFilterGroup: 1 });
    if (angle) b.quaternion.setFromAxisAngle(axis, angle);
    this.world.addBody(b);
    return b;
  }

  _buildArena() {
    this._box(0, -1, 0, 72, 2, 124);
    this._box(0, 23, 0, 72, 2, 108);
    this._box(-35, 11, 0, 2, 22, 88);
    this._box(35, 11, 0, 2, 22, 88);
    for (const sign of [-1, 1]) {
      for (const side of [-1, 1]) this._box(side * 18.5, 11, sign * 53, 19, 22, 2);
      this._box(0, 14.5, sign * 53, 18, 15, 2);
      // Rounded plan-view corners: segments tangent to a true radius-eight arc.
      for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
        const angle = (i + .5) / 10 * Math.PI / 2;
        const x = side * (26 + 8.5 * Math.cos(angle));
        const z = sign * (44 + 8.5 * Math.sin(angle));
        this._box(x, 11, z, 1.1, 22, 1.65, -side * sign * angle);
      }
      // Real open goals with independent side, back, and roof colliders.
      this._box(0, 3.5, sign * 60, 20, 7, 2);
      for (const side of [-1, 1]) this._box(side * 10, 3.5, sign * 56, 2, 7, 8);
      this._box(0, 8, sign * 56, 20, 2, 8);
    }
    // A quarter-circle ramp produces an actual continuous driveable wall transition.
    const r = 4, slices = 12;
    for (let i = 0; i < slices; i++) {
      const a = i / slices * Math.PI / 2, b = (i + 1) / slices * Math.PI / 2, mid = (a + b) / 2;
      const width = 2 * r * Math.sin((b - a) / 2) + .07;
      for (const side of [-1, 1]) {
        this._box(side * (30 + r * Math.sin(mid) + .22 * Math.sin(mid)), 4 - r * Math.cos(mid) - .22 * Math.cos(mid), 0, width, .45, 88, side * mid, FORWARD);
      }
      for (const sign of [-1, 1]) for (const side of [-1, 1]) {
        this._box(side * 18.5, 4 - r * Math.cos(mid) - .22 * Math.cos(mid), sign * (48 + r * Math.sin(mid) + .22 * Math.sin(mid)), 19, .45, width, -sign * mid, RIGHT);
      }
    }
  }

  reset() {
    this.clock = 0;
    this.ball.position.set(0, TUNING.ballRadius + .05, 0);
    this.ball.velocity.setZero(); this.ball.angularVelocity.setZero();
    this.ball.quaternion.set(0, 0, 0, 1); this.ball.force.setZero(); this.ball.torque.setZero();
    this.ball.previousPosition.copy(this.ball.position); this.ball.interpolatedPosition.copy(this.ball.position);
    this.ball.aabbNeedsUpdate = true;
    this.cars.forEach((_, i) => this.resetCar(i));
    for (const pad of this.pads) { pad.active = true; pad.cooldown = 0; }
    this.ballHitCooldown.clear();
    this.events.length = 0;
  }

  resetCar(index) {
    const car = this.cars[index]; if (!car) return;
    const b = car.body;
    b.position.set(index ? 0 : 0, .9, index ? 34 : -34);
    b.velocity.setZero(); b.angularVelocity.setZero(); b.force.setZero(); b.torque.setZero();
    b.quaternion.setFromAxisAngle(UP, index ? Math.PI : 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
    b.aabbNeedsUpdate = true;
    Object.assign(car, { boost: 33, onGround: true, boosting: false, jumps: 0, jumpTime: 0, dodgeTime: 0, lastJump: false, speed: 0 });
    car.groundNormal.set(0, 1, 0);
  }

  setCarActive(index, active) {
    const car = this.cars[index]; if (!car) return;
    car.active = !!active;
    car.body.collisionFilterMask = active ? -1 : 0;
    car.body.collisionResponse = !!active;
    car.body.aabbNeedsUpdate = true;
  }

  _ballImpact(event) {
    const relative = Math.abs(event.contact.getImpactVelocityAlongNormal());
    const otherCar = this.cars.find(c => c.body === event.body);
    if (otherCar && this.clock - (this.ballHitCooldown.get(event.body.id) ?? -10) > .12) {
      this.ballHitCooldown.set(event.body.id, this.clock);
      // Additional arcade punch scales with relative contact velocity and real geometry.
      const delta = this.ball.position.vsub(event.body.position);
      if (delta.lengthSquared() > .001) {
        delta.normalize();
        const approach = event.body.velocity.vsub(this.ball.velocity).dot(delta);
        const impulse = clamp(approach * .25 + 1, 0, 10);
        this.ball.applyImpulse(delta.scale(impulse));
      }
      this.events.push({ type: 'impact', position: position(this.ball), strength: clamp(relative / 30, .12, 1), car: otherCar.index });
    } else if (relative > 3 && this.clock - (this.lastWallHit ?? -10) > .08) {
      this.lastWallHit = this.clock;
      this.events.push({ type: 'wall', position: position(this.ball), strength: clamp(relative / 35, .1, 1) });
    }
  }

  _vehicle(car, input = {}, dt) {
    const b = car.body, q = b.quaternion;
    car.steer = input.steer || 0;
    car.powersliding = !!input.powerslide;
    const forward = q.vmult(FORWARD), up = q.vmult(UP), right = q.vmult(RIGHT);
    const rayEnd = b.position.vsub(up.scale(1.5));
    const hit = new CANNON.RaycastResult();
    this.world.raycastClosest(b.position, rayEnd, { collisionFilterMask: 1, skipBackfaces: true }, hit);
    let grounded = hit.hasHit && hit.distance < 1.22 && up.dot(hit.hitNormalWorld) > .35;
    const wasGrounded = car.onGround;
    if (grounded && (car.jumpTime <= 0 || car.jumpTime > .18)) {
      car.onGround = true;
      car.groundNormal.copy(hit.hitNormalWorld);
      const n = car.groundNormal, normalVelocity = b.velocity.dot(n);
      const spring = clamp((.85 - hit.distance) * 140 - normalVelocity * 19 + 22 * n.y + 12 * Math.abs(n.x) + 12 * Math.abs(n.z), -55, 100);
      b.applyForce(n.scale(spring * b.mass));
      // Align chassis with the contacted ramp/wall while retaining yaw freedom.
      const lookOrigin = b.position.vadd(forward.scale((input.throttle || 0) < 0 ? -1.45 : 1.45)).vadd(up.scale(.8));
      const lookHit = new CANNON.RaycastResult();
      this.world.raycastClosest(lookOrigin, lookOrigin.vsub(up.scale(3.3)), { collisionFilterMask: 1, skipBackfaces: true }, lookHit);
      const alignNormal = lookHit.hasHit && lookHit.distance < 2.8 && up.dot(lookHit.hitNormalWorld) > .15 ? lookHit.hitNormalWorld : n;
      const alignment = up.cross(alignNormal);
      b.torque.vadd(alignment.scale(220 * b.mass), b.torque);
      const tiltOmega = b.angularVelocity.vsub(n.scale(b.angularVelocity.dot(n)));
      b.torque.vsub(tiltOmega.scale(14 * b.mass), b.torque);
      if (car.jumpTime > .2 || !wasGrounded) { car.jumps = 0; car.jumpTime = 0; }
      const lateral = b.velocity.dot(right);
      const grip = input.powerslide ? 1.7 : 12;
      b.applyForce(right.scale(-lateral * grip * b.mass));
      const longitudinal = b.velocity.dot(forward), throttle = clamp(input.throttle || 0, -1, 1);
      const desiredMax = throttle < 0 ? 16 : TUNING.driveSpeed;
      if (Math.abs(longitudinal) < desiredMax || Math.sign(throttle) !== Math.sign(longitudinal)) {
        const acceleration = throttle < 0 ? TUNING.reverseAcceleration : TUNING.acceleration;
        const braking = throttle && Math.sign(throttle) !== Math.sign(longitudinal) && Math.abs(longitudinal) > 2 ? 1.7 : 1;
        b.applyForce(forward.scale(throttle * acceleration * braking * b.mass));
      }
      if (!throttle) b.applyForce(forward.scale(-longitudinal * .5 * b.mass));
      const steer = clamp(input.steer || 0, -1, 1);
      const steerSpeed = clamp(Math.abs(longitudinal) / 5, 0, 1);
      const turn = steer * (input.powerslide ? 2.9 : 2.1) * steerSpeed * (longitudinal < -.5 ? -1 : 1) / (1 + Math.abs(longitudinal) / 75);
      const yawSpeed = b.angularVelocity.dot(n);
      b.torque.vadd(n.scale((turn - yawSpeed) * 23 * b.mass), b.torque);
    } else {
      car.onGround = false;
      const pitch = clamp(input.pitch || 0, -1, 1), yaw = clamp(input.yaw ?? input.steer ?? 0, -1, 1), roll = clamp(input.roll || 0, -1, 1);
      if (car.dodgeTime <= 0) {
        b.torque.vadd(right.scale(pitch * 19 * b.mass), b.torque);
        b.torque.vadd(up.scale(yaw * 13 * b.mass), b.torque);
        b.torque.vadd(forward.scale(-roll * 19 * b.mass), b.torque);
      }
    }
    car.jumpTime += car.jumps > 0 ? dt : 0;
    const jumpPressed = !!input.jump && !car.lastJump;
    car.lastJump = !!input.jump;
    // The chassis roof can also jump from a supporting surface for physical self-righting.
    let roofSupport = false;
    if (jumpPressed && !car.onGround && up.y < .2 && car.jumps === 0) {
      const roofHit = new CANNON.RaycastResult();
      this.world.raycastClosest(b.position, b.position.vsub(UP.scale(1.1)), { collisionFilterMask: 1, skipBackfaces: true }, roofHit);
      roofSupport = roofHit.hasHit && roofHit.distance < 1.05;
    }
    if (jumpPressed && (car.onGround || roofSupport || (car.jumps === 1 && car.jumpTime < 1.5))) {
      if (car.onGround || roofSupport) {
        const jumpNormal = roofSupport ? UP : car.groundNormal;
        b.velocity.vadd(jumpNormal.scale(TUNING.jumpSpeed), b.velocity);
        b.position.vadd(jumpNormal.scale(.12), b.position);
        car.jumps = 1; car.jumpTime = .001; car.onGround = false;
      } else {
        const front = clamp(input.pitch || 0, -1, 1), side = clamp(input.steer || input.yaw || input.roll || 0, -1, 1);
        if (Math.abs(front) + Math.abs(side) > .2) {
          const dodge = forward.scale(-front).vadd(right.scale(side)); dodge.normalize();
          b.velocity.vadd(dodge.scale(TUNING.dodgeSpeed), b.velocity);
          b.velocity.y = Math.max(b.velocity.y, 3.5);
          car.dodgeAxis.copy(right.scale(-front).vadd(forward.scale(-side))); car.dodgeAxis.normalize();
          car.dodgeTime = .45;
        } else b.velocity.vadd(up.scale(8), b.velocity);
        car.jumps = 2;
      }
      this.events.push({ type: 'jump', position: position(b), car: car.index, strength: car.jumps === 2 ? .9 : .6 });
    }
    if (car.dodgeTime > 0) {
      car.dodgeTime -= dt;
      b.angularVelocity.copy(car.dodgeAxis.scale(13.6));
      if (car.dodgeTime <= 0) b.angularVelocity.scale(.2, b.angularVelocity);
    }
    car.boosting = !!input.boost && car.boost > 0;
    if (car.boosting) {
      b.applyForce(forward.scale(TUNING.boostAcceleration * b.mass));
      car.boost = this.options.unlimitedBoost ? 100 : Math.max(0, car.boost - TUNING.boostConsumption * dt);
    }
    const limit = car.boosting ? TUNING.boostSpeed : 57;
    if (b.velocity.length() > limit) b.velocity.scale(limit / b.velocity.length(), b.velocity);
    if (b.angularVelocity.length() > 16) b.angularVelocity.scale(16 / b.angularVelocity.length(), b.angularVelocity);
    car.speed = b.velocity.length();
    // Recovery only for invalid/out-of-arena states; inversion is a player skill.
    if (!Number.isFinite(b.position.lengthSquared()) || b.position.y < -8 || Math.abs(b.position.x) > 45 || Math.abs(b.position.z) > 68) this.resetCar(car.index);
  }

  step(dt, controls = []) {
    dt = clamp(dt, .0001, 1 / 30);
    this.clock += dt;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.active === false) { car.body.collisionFilterMask = 0; car.body.collisionResponse = false; car.body.velocity.setZero(); car.body.force.setZero(); car.body.torque.setZero(); continue; }
      car.body.collisionFilterMask = -1; car.body.collisionResponse = true;
      this._vehicle(car, controls[i] || {}, dt);
    }
    const substeps = Math.ceil(dt / (1 / 240));
    // Forces persist across internal substeps; Cannon clears them after each step.
    const forces = this.cars.map(c => ({ force: c.body.force.clone(), torque: c.body.torque.clone() }));
    for (let s = 0; s < substeps; s++) {
      if (s) this.cars.forEach((c, i) => { c.body.force.copy(forces[i].force); c.body.torque.copy(forces[i].torque); });
      this.world.step(dt / substeps);
    }
    const speed = this.ball.velocity.length();
    if (speed > 88) this.ball.velocity.scale(88 / speed, this.ball.velocity);
    if (this.ball.position.y < -5 || !Number.isFinite(this.ball.position.lengthSquared()) || Math.abs(this.ball.position.x) > 43 || Math.abs(this.ball.position.z) > 66) {
      this.ball.position.set(0, 3, 0); this.ball.velocity.setZero(); this.ball.angularVelocity.setZero();
    }
    for (const pad of this.pads) {
      if (!pad.active) { pad.cooldown -= dt; if (pad.cooldown <= 0) { pad.active = true; pad.cooldown = 0; } }
      if (!pad.active) continue;
      for (const car of this.cars) {
        if (car.active === false) continue;
        const p = car.body.position;
        if (car.boost < 99 && p.y < 2.2 && (p.x - pad.x) ** 2 + (p.z - pad.z) ** 2 < (pad.large ? 3 : 2.1) ** 2) {
          car.boost = pad.large ? 100 : Math.min(100, car.boost + 12);
          pad.active = false; pad.cooldown = pad.large ? 10 : 4;
          this.events.push({ type: 'pickup', position: { x: pad.x, y: .3, z: pad.z }, car: car.index, strength: pad.large ? 1 : .45 });
          break;
        }
      }
    }
  }
}
