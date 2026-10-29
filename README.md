# NEON STRIKE

An original, playable 3D rocket car soccer game built with Three.js and cannon-es. Drive, jump, dodge, fly with boost, climb the walls, and play a complete match against a predictive AI opponent.

Repository: [silver-lining-43/rocket-league](https://github.com/silver-lining-43/rocket-league).

## Play immediately — no installation or internet required

Download **index.html** and double-click it. The file contains the entire game, Three.js, physics, CSS, procedural graphics, and synthesized audio. It works directly from `file://`; no web server, account, CDN, API key, or runtime download is required. Use a current desktop Chrome, Edge, Firefox, or Safari with WebGL 2 and hardware acceleration enabled. Click **ENTER THE ARENA** to start and enable audio.

The same standalone build is supplied in three locations:

- `index.html` — ready to double-click or share.
- `docs/index.html` — ready for GitHub Pages.
- `dist/index.html` — distribution copy.

## What is implemented

- 1v1 versus Rookie, Intermediate, or Expert AI; 1-, 3-, and 5-minute matches, default five minutes.
- Free Play with a physically inactive opponent and no running match timer.
- Real rigid-body cars and ball, 120 Hz fixed physics with 240 Hz collision substeps, stable high-speed rebounds, car impacts, rounded corners, an upper arena boundary, and actual open goal chambers.
- Acceleration, reverse, braking, traction, powerslides, speed-sensitive steering, suspension contact, and driveable curved ramps onto walls.
- Jump, second jump, directional impulse dodges/flips, aerial pitch/yaw/roll, airborne directional boost, and recovery.
- Predictive AI that intercepts, approaches from behind the ball, defends, collects boost, reverses out of trouble, and recovers using the same controller as the player.
- Limited boost with small and large pickups, cooldowns, animated availability, rocket exhaust, and a boost meter.
- Smooth car and ball cameras, adjustable FOV, boost FOV expansion, and impact shake.
- Detailed procedural cars, rotating/steering wheels, stadium stands and lights, field markings, team goals, ball shadow, exhaust, tire particles, collision sparks, and goal explosions.
- Countdown, scoring, goal celebrations, kickoff resets, overtime golden goal, results, restart, pause/resume, and main menu.
- Synthesized engine, boost, jump, impacts, pickups, countdown, goals, menu, and results sounds. Volume, mute, FOV, and graphics settings save locally when storage is available.
- Standard gamepad support and automatic pause on focus loss. Menus are keyboard accessible.

Local split-screen, online multiplayer, touch driving controls, remappable bindings, 2v2, and scripted training shots are not included. This is an original arcade interpretation, not a recreation of proprietary game assets or physics.

## Keyboard controls

| Key | Action |
| --- | --- |
| W / S | Accelerate / brake / reverse; airborne pitch |
| A / D | Steer; airborne yaw |
| Space | Jump, then double jump; add direction for a dodge/flip |
| Left Shift | Boost, including in the air |
| Left Ctrl | Powerslide; airborne steering becomes roll |
| Q / E | Air roll left / right |
| C | Toggle ball / car camera |
| R | Recover and reset your car to its kickoff position |
| Esc | Pause / resume; close an open dialog first |

To recover upside down, jump off the roof and roll, or press R. Both cameras maintain a stable horizon. Follow the ball toward the orange goal; blue defends the opposite end.

**Standard gamepad:** left stick steers and controls airborne pitch/yaw; RT accelerates, LT brakes/reverses; A jumps, B boosts, X powerslides, Y switches cameras, bumpers roll, right stick X looks around, and Start pauses. Button labels follow the standard Xbox mapping; other controller layouts may differ. Connect and press a controller button so the browser recognizes it. Driving remains keyboard-capable if a controller disconnects.

## GitHub Pages deployment

1. Push this project to `silver-lining-43/rocket-league` on the `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/docs**, then **Save**.
4. When GitHub finishes deploying, open `https://silver-lining-43.github.io/rocket-league/`.

Everything is relative or inline, so project subpaths work. `docs/.nojekyll` disables unnecessary processing. GitHub Pages must be enabled in the repository settings; the presence of the HTML files alone does not activate hosting.

## Develop and build

Node.js 22 or newer is recommended for development only.

```sh
npm ci
npm run build
npm test
npm run dev
```

The preview is at `http://127.0.0.1:4173`. Re-run `npm run build` after editing source and reload the preview; this is deliberately a simple static preview rather than a hot-reloading framework. The build bundles the modular source into one classic inline script, embeds CSS and license notices, and writes identical HTML to all three output locations. There is no input HTML template to overwrite. Playing the finished files requires none of these tools.

## Source layout and tuning

- `src/physics.js` — rigid bodies, curved arena colliders, suspension, driving, aerial controls, boost, contacts, and pickups. `ARENA` and `TUNING` expose the main tuning values.
- `src/ai.js` — predictive tactical AI using the player controller.
- `src/match.js` — deterministic match state, scoring, time, overtime, and reset events.
- `src/visuals.js` — original procedural stadium, cars, ball, and pooled effects.
- `src/camera.js`, `src/input.js`, `src/audio.js`, `src/ui.js`, `src/style.css` — camera, keyboard/gamepad, audio, and interface.
- `src/main.js` — fixed-step loop and integration.
- `scripts/build.mjs`, `scripts/serve.mjs` — standalone packaging and static preview.
- `tests/` — physics, AI, complete match flow, timestep consistency, pause, scoring, and offline artifact checks.

Simulation tests include a real AI goal through a complete match and a two-minute continuous stability run. Artifact checks verify identical files and no runtime network loading in game sources; browser checks are also needed to assess rendering and controls. The Performance graphics preset reduces rendering resolution and disables dynamic shadows on slower hardware.

## Attribution

All game models, stadium artwork, textures, effects, branding, and sounds are original and generated locally. Three.js and cannon-es are MIT-licensed; notices are included in `THIRD_PARTY_NOTICES.txt` and every HTML build. This project is independent and is not affiliated with Rocket League, Psyonix, or Epic Games.
