# Validation

Production build succeeds and generates three byte-identical standalone HTML files (about 687 KiB each). `npm test` passes 26 checks covering artifacts, match flow, ball and car physics, wall driving, aerial boost/dodge, real AI scoring through a full match, and two minutes of continuous bot simulation.

Interactive Chromium browser checks performed against the static final build:

- Visible 3D stadium, main menu, controls dialog, settings dialog, and HUD render.
- Starting a match displays the kickoff countdown and enters gameplay.
- Holding W moves the vehicle; adding Shift visibly increases speed and consumes boost.
- Space creates visible vertical motion; HUD-backed height rose above the ground.
- C switches the camera label and view between ball and car camera.
- The opponent moves, physically hits the ball, scores, increments the scoreboard, and causes a new kickoff.
- Escape opens pause; the clock stayed at exactly the same value across subsequent checks.
- Free Play starts successfully with no active opponent and a frozen session clock.
- Settings and controls open and close; Escape closes dialogs; mute setting persists.
- No browser console warnings or errors were observed during these checks.

The browser automation environment disallows `file://` navigation, so a direct double-click launch was not verified in-browser. The build uses one classic inline script with bundled runtimes and inline styles/assets; artifact tests verify that the three files match, game source performs no network resource loading, and there are no external scripts, module imports, stylesheets, or image dependencies. This is the basis for offline compatibility; a direct disk launch should still be checked on the player's browser.

No physical gamepad was available, so controller input is implemented but not physically tested. Local split-screen, online play, touch driving, and remappable bindings are outside this build.

GitHub Pages requires selecting `main` and `/docs` in the repository's Pages settings. Local validation does not imply that Pages hosting has been enabled or deployed.
