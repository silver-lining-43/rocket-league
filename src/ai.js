const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** A predictive, goal-oriented opponent sharing every player physics constraint. */
export class BotAI {
  constructor(index = 1, difficulty = 'intermediate') {
    this.index = index;
    this.difficulty = difficulty;
    this.state = 'kickoff';
    this.stuck = 0; this.reverseTime = 0; this.jumpCooldown = 0; this.lastJump = false;
    this.target = { x: 0, z: 0 };
  }
  update(physics, dt, phase = 'playing') {
    const car = physics.cars[this.index], b = car.body, ball = physics.ball;
    const sign = this.index === 1 ? -1 : 1;
    const expert = this.difficulty === 'expert', rookie = this.difficulty === 'rookie';
    const forward = b.quaternion.vmult({ x: 0, y: 0, z: 1 });
    const up = b.quaternion.vmult({ x: 0, y: 1, z: 0 });
    const heading = Math.atan2(forward.x, forward.z);
    const distance = Math.hypot(ball.position.x - b.position.x, ball.position.z - b.position.z);
    const prediction = clamp(distance / (expert ? 39 : 31), .08, expert ? 1.15 : rookie ? .35 : .75);
    let px = clamp(ball.position.x + ball.velocity.x * prediction, -29, 29);
    let pz = clamp(ball.position.z + ball.velocity.z * prediction, -48, 48);
    const ownGoalZ = -sign * 50;
    const dangerous = ball.position.z * sign < -24 && (ball.velocity.z * sign < -1 || pz * sign < -34);
    this.state = dangerous ? 'defend' : 'intercept';
    let tx = px, tz = pz;
    if (dangerous) {
      const goalTime = ball.velocity.z * sign < -1 ? clamp((ownGoalZ - ball.position.z) / ball.velocity.z, 0, 2) : .4;
      tx = clamp(ball.position.x + ball.velocity.x * goalTime, -8, 8);
      tz = ownGoalZ + sign * 7;
      if (distance < 17 || b.position.z * sign < ball.position.z * sign - 2) { tx = px; tz = pz - sign * 3; }
    } else {
      // Approach from behind the ball on the line to the opponent's opening.
      const gx = -px, gz = sign * 52 - pz, len = Math.hypot(gx, gz) || 1;
      const behind = distance > 11 ? (rookie ? 4 : 6) : 1.2;
      tx = px - gx / len * behind;
      tz = pz - gz / len * behind;
      if ((ball.position.z - b.position.z) * sign < -2 && distance < 18) {
        this.state = 'reposition';
        tx = px + (b.position.x > px ? 1 : -1) * 9;
        tz = pz - sign * 8;
      } else if (distance < 10) this.state = 'shoot';
    }
    if (car.boost < 12 && distance > 23 && !dangerous) {
      const active = physics.pads.filter(p => p.active && Math.abs(p.z - b.position.z) < 27);
      active.sort((a, c) => Math.hypot(a.x - b.position.x, a.z - b.position.z) - Math.hypot(c.x - b.position.x, c.z - b.position.z));
      if (active[0]) { tx = active[0].x; tz = active[0].z; this.state = 'boost'; }
    }
    tx = clamp(tx, -29, 29); tz = clamp(tz, -48, 48);
    this.target = { x: tx, z: tz };
    const dx = tx - b.position.x, dz = tz - b.position.z;
    const error = wrap(Math.atan2(dx, dz) - heading);
    const speed = Math.hypot(b.velocity.x, b.velocity.z), fSpeed = b.velocity.dot(forward);
    this.stuck = speed < 2 && car.onGround ? this.stuck + dt : 0;
    this.jumpCooldown -= dt;
    if (this.stuck > 1.3) { this.reverseTime = .8; this.stuck = 0; }
    if (this.reverseTime > 0) {
      this.reverseTime -= dt; this.state = 'recover';
      return { throttle: -1, steer: -Math.sign(error || 1), powerslide: true };
    }
    const targetDistance = Math.hypot(dx, dz);
    let throttle = 1;
    if (Math.abs(error) > 1.3 && speed > 15) throttle = -.4;
    if (Math.abs(error) > 2.5 && targetDistance < 10) throttle = -.8;
    if (rookie && speed > 23) throttle = .25;
    const control = {
      throttle,
      steer: clamp(error * (rookie ? 1.65 : 2.5), -1, 1),
      powerslide: Math.abs(error) > 1.05 && speed > 8,
      boost: !rookie && Math.abs(error) < .23 && distance > 10 && fSpeed > 8 && car.boost > (dangerous ? 0 : 8),
      jump: false, pitch: 0, yaw: clamp(error * 1.5, -1, 1), roll: 0,
    };
    if (car.onGround && distance < (expert ? 9 : 6) && ball.position.y > 2.9 && ball.position.y < (expert ? 9 : 5.5) && Math.abs(error) < .45 && this.jumpCooldown <= 0) {
      control.jump = true; this.jumpCooldown = expert ? .75 : 1.5;
    } else if (!car.onGround) {
      // Level out after jumps, use an actual dodge to strike nearby balls.
      control.pitch = clamp(forward.y * 2, -.7, .7);
      control.roll = clamp(-up.x * 2, -1, 1);
      if (expert && car.jumps === 1 && car.jumpTime > .2 && distance < 7 && Math.abs(error) < .35 && ball.position.y < 7 && !this.lastJump) {
        control.jump = true; control.pitch = -1;
      }
      if (expert && distance < 15 && ball.position.y > b.position.y + 2 && Math.abs(error) < .3) { control.pitch = -.4; control.boost = car.boost > 0; }
      if (up.y < -.4) { control.roll = 1; this.state = 'recover'; }
    }
    if (up.y < -.65 && speed < 4 && this.jumpCooldown <= 0) {
      control.jump = true; control.roll = 1; this.jumpCooldown = 1;
    }
    this.lastJump = control.jump;
    return control;
  }
}
