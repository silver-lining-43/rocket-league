const DEFAULTS = { mode: 'duel', difficulty: 'intermediate', duration: 300, fov: 75, volume: 0.55, quality: 'high', muted: false };
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function loadSettings() {
  try {
    const value = JSON.parse(localStorage.getItem('neonstrike.settings') || '{}');
    return {
      mode: ['duel', 'freeplay'].includes(value.mode) ? value.mode : DEFAULTS.mode,
      difficulty: ['rookie', 'intermediate', 'expert'].includes(value.difficulty) ? value.difficulty : DEFAULTS.difficulty,
      duration: [60, 180, 300].includes(value.duration) ? value.duration : DEFAULTS.duration,
      fov: clamp(Number(value.fov) || 75, 60, 100),
      volume: clamp(Number.isFinite(value.volume) ? value.volume : 0.55, 0, 1),
      quality: ['low', 'high'].includes(value.quality) ? value.quality : 'high',
      muted: value.muted === true,
    };
  } catch { return { ...DEFAULTS }; }
}

const controls = [
  ['W / S', 'Accelerate / brake / reverse'],
  ['A / D', 'Steer left / right'],
  ['SPACE', 'Jump · press again to double jump'],
  ['WASD + SPACE', 'Directional dodge on second jump'],
  ['LEFT SHIFT', 'Boost · also works in the air'],
  ['LEFT CTRL', 'Powerslide / air roll modifier'],
  ['W / S · A / D', 'Air pitch · air yaw'],
  ['Q / E', 'Air roll left / right'],
  ['C', 'Toggle ball / car camera'],
  ['R', 'Recover and reset your car'],
  ['ESC', 'Pause / resume'],
];

export class GameUI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.settings = loadSettings();
    this.screen = 'menu';
    this.overlay = null;
    this.announcementUntil = 0;
    this.root = document.createElement('div');
    this.root.className = 'game-ui';
    this.root.innerHTML = `
      <div class="vignette" aria-hidden="true"></div>
      <header class="masthead menu-element">
        <a class="wordmark" href="#" data-action="home" aria-label="Neon Strike home"><span class="brand-icon" aria-hidden="true">N<span>↗</span></span>NEON<span>STRIKE</span></a>
        <div class="edition"><span class="live-dot"></span> ORIGINAL ARCADE CAR SOCCER <span class="edition-line"></span> V 1.0</div>
        <nav aria-label="Game navigation"><button class="text-button" data-action="controls">CONTROLS <span>↗</span></button><button class="icon-button" data-action="settings" aria-label="Open settings">⚙</button></nav>
      </header>
      <main class="main-menu menu-element" aria-label="Main menu">
        <div class="eyebrow"><span></span> THE ARENA IS YOURS</div>
        <h1>FULL THROTTLE.<br><em>NO LIMITS.</em></h1>
        <p class="menu-description">Rocket-powered cars. One electric arena.<br>Take the shot. Make your mark.</p>
        <div class="mode-picker" role="group" aria-label="Game mode">
          <button class="mode-card" data-mode="duel"><span class="mode-symbol">01<span>↗</span></span><strong>DUEL</strong><small>YOU VS. AI</small><span class="mode-check">✓</span></button>
          <button class="mode-card" data-mode="freeplay"><span class="mode-symbol">∞<span>↗</span></span><strong>FREE PLAY</strong><small>YOUR PERSONAL PROVING GROUND</small><span class="mode-check">✓</span></button>
        </div>
        <div class="match-config"><label>DIFFICULTY<select id="menu-difficulty" aria-label="AI difficulty"><option value="rookie">Rookie</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option></select></label><label>MATCH LENGTH<select id="menu-duration" aria-label="Match length"><option value="60">1 minute</option><option value="180">3 minutes</option><option value="300">5 minutes</option></select></label></div>
        <button class="play-button" data-action="start"><span>ENTER THE ARENA</span><span class="play-arrow">↗</span></button>
        <div class="quick-controls"><span><kbd>WASD</kbd> DRIVE</span><span><kbd>SHIFT</kbd> BOOST</span><span><kbd>SPACE</kbd> JUMP</span></div>
      </main>
      <aside class="arena-caption menu-element" aria-hidden="true"><span class="caption-line"></span><div><small>WELCOME TO</small><strong>THE NEON DOME</strong><span>34 × 52 · ALL SYSTEMS READY</span></div><span class="caption-index">01 / 01</span></aside>
      <footer class="menu-footer menu-element"><span>BUILT FOR THE LOVE OF THE GAME.</span><span><span class="live-dot"></span> OFFLINE READY <b>·</b> NO SIGN-IN REQUIRED</span></footer>

      <div class="hud" hidden>
        <div class="match-label"><span class="live-dot"></span><span id="hud-mode">1V1 DUEL</span><span id="hud-overtime" hidden>OVERTIME · GOLDEN GOAL</span></div>
        <div class="scoreboard" aria-label="Scoreboard"><div class="team-score blue-score"><span>BLUE</span><strong id="score-blue">0</strong></div><div class="clock-block"><span id="hud-period">MATCH TIME</span><strong id="hud-clock">5:00</strong></div><div class="team-score orange-score"><strong id="score-orange">0</strong><span>ORANGE</span></div></div>
        <button class="hud-pause icon-button" data-action="pause" aria-label="Pause match">Ⅱ</button>
        <div class="camera-block"><button class="camera-switch" data-action="camera"><span class="camera-square"></span><strong id="hud-camera">BALL CAM</strong><kbd>C</kbd></button><span class="camera-hint">WASD DRIVE <i>·</i> SPACE JUMP <i>·</i> SHIFT BOOST</span></div>
        <div class="boost-block"><div class="boost-dial" id="boost-dial"><div class="boost-inner"><strong id="hud-boost">33</strong><span>BOOST</span></div></div><div class="speed-label"><strong id="hud-speed">0</strong><span>KM/H</span></div></div>
        <div class="kickoff-display" id="kickoff-display" hidden><span>GET READY</span><strong id="kickoff-number">3</strong><small>TAKE THE FIRST TOUCH</small></div>
        <div class="freeplay-label" id="freeplay-label" hidden>FREE PLAY <span>EXPLORE. PRACTICE. REPEAT.</span></div>
      </div>
      <section class="screen-shade" id="pause-screen" hidden><div class="center-panel"><span class="eyebrow">TIME OUT</span><h2>TAKE A BREATHER.</h2><p>The arena will be right here.</p><button class="play-button" data-action="resume">BACK TO THE GAME <span>↗</span></button><div class="panel-actions"><button data-action="settings">SETTINGS</button><button data-action="controls">CONTROLS</button></div><button class="outline-button" data-action="restart">RESTART MATCH</button><button class="subtle-button" data-action="menu">RETURN TO MAIN MENU</button><small class="panel-hint">PRESS ESC TO RESUME</small></div></section>
      <section class="screen-shade" id="results-screen" hidden><div class="center-panel results-panel"><span class="eyebrow" id="result-eyebrow">FULL TIME</span><h2 id="result-title">BLUE WINS.</h2><p id="result-description">One arena. A match to remember.</p><div class="result-score"><span class="result-blue" id="result-blue">0</span><i>—</i><span class="result-orange" id="result-orange">0</span></div><button class="play-button" data-action="restart">PLAY AGAIN <span>↗</span></button><button class="outline-button" data-action="menu">MAIN MENU</button></div></section>
      <div class="announcement" role="status" aria-live="polite" hidden><strong id="announcement-title"></strong><span id="announcement-subtitle"></span></div>
      <section class="modal-shade" id="modal" hidden><div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><span class="eyebrow">MAKE IT YOURS</span><button class="icon-button" data-action="close-modal" aria-label="Close dialog">✕</button></div><h2 id="modal-title">SETTINGS</h2><div id="modal-content"></div><button class="play-button modal-done" data-action="close-modal">ALL SET <span>↗</span></button></div></section>
    `;
    document.body.appendChild(this.root);
    this.elements = Object.fromEntries([...this.root.querySelectorAll('[id]')].map(el => [el.id, el]));
    this.hud = this.root.querySelector('.hud');
    this.announcement = this.root.querySelector('.announcement');
    this.root.addEventListener('click', e => {
      const mode = e.target.closest('[data-mode]');
      if (mode) { this.settings.mode = mode.dataset.mode; this.save(); this.syncMenu(); }
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      e.preventDefault();
      if (action === 'settings' || action === 'controls') this.showModal(action);
      else if (action === 'close-modal') this.closeModal();
      else if (action === 'home') { if (this.screen === 'menu') this.closeModal(); }
      else if (action === 'start') { this.closeModal(); document.activeElement?.blur(); callbacks.onStart?.({ ...this.settings }); }
      else if (action === 'resume') { this.closeModal(); document.activeElement?.blur(); callbacks.onResume?.(); }
      else if (action === 'pause') callbacks.onPause?.();
      else if (action === 'restart') { this.closeModal(); document.activeElement?.blur(); callbacks.onRestart?.(); }
      else if (action === 'menu') { this.closeModal(); callbacks.onMenu?.(); }
      else if (action === 'camera') { document.activeElement?.blur(); callbacks.onCamera?.(); }
    });
    this.root.addEventListener('change', e => {
      if (e.target.id === 'menu-difficulty') this.settings.difficulty = e.target.value;
      else if (e.target.id === 'menu-duration') this.settings.duration = Number(e.target.value);
      else return;
      this.save();
      callbacks.onSettings?.({ ...this.settings });
      e.target.blur();
    });
    this.root.querySelector('#modal').addEventListener('click', e => { if (e.target.id === 'modal') this.closeModal(); });
    this.root.addEventListener('keydown', e => {
      if (!this.overlay) return;
      if (e.code === 'Escape') { this.closeModal(); e.stopPropagation(); e.preventDefault(); }
      if (e.key === 'Tab') {
        const items = [...this.elements.modal.querySelectorAll('button, input, select')].filter(el => !el.disabled);
        if (e.shiftKey && document.activeElement === items[0]) { items.at(-1).focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === items.at(-1)) { items[0].focus(); e.preventDefault(); }
      }
    });
    // Capture before the game's global keyboard listener, including when a click
    // on the backdrop moves focus outside the dialog's interactive controls.
    this.modalKeyGuard = e => {
      if (!this.overlay) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.closeModal();
        return;
      }
      if (!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && /^(Key[WASDQECR]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.code)) {
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', this.modalKeyGuard, true);
    this.syncMenu();
    this.setScreen('menu');
  }

  save() { try { localStorage.setItem('neonstrike.settings', JSON.stringify(this.settings)); } catch {} }

  syncMenu() {
    this.root.querySelectorAll('[data-mode]').forEach(el => {
      const active = el.dataset.mode === this.settings.mode;
      el.classList.toggle('selected', active);
      el.setAttribute('aria-pressed', String(active));
    });
    this.elements['menu-difficulty'].value = this.settings.difficulty;
    this.elements['menu-duration'].value = String(this.settings.duration);
    this.root.querySelector('.match-config').classList.toggle('disabled-config', this.settings.mode === 'freeplay');
    this.elements['menu-difficulty'].disabled = this.settings.mode === 'freeplay';
    this.elements['menu-duration'].disabled = this.settings.mode === 'freeplay';
  }

  setScreen(name, data = {}) {
    if (this.overlay) this.closeModal();
    this.screen = name;
    this.root.dataset.screen = name;
    this.root.querySelectorAll('.menu-element').forEach(el => { el.hidden = name !== 'menu'; });
    this.hud.hidden = !['playing', 'pause'].includes(name);
    this.elements['pause-screen'].hidden = name !== 'pause';
    this.elements['results-screen'].hidden = name !== 'results';
    if (name !== 'playing') this.announcement.hidden = true;
    if (name === 'results') {
      const scores = data.scores || [0, 0];
      this.elements['result-blue'].textContent = scores[0];
      this.elements['result-orange'].textContent = scores[1];
      const blue = data.winner === 'blue';
      this.elements['result-title'].textContent = blue ? 'VICTORY IS YOURS.' : 'ORANGE TAKES IT.';
      this.elements['result-title'].style.color = blue ? 'var(--cyan)' : 'var(--orange)';
      this.elements['result-eyebrow'].textContent = data.overtime ? 'OVERTIME · GOLDEN GOAL' : 'FULL TIME';
      this.elements['result-description'].textContent = blue ? 'A little horsepower. A lot of heart.' : 'Every great comeback starts with another kickoff.';
    }
    if (name === 'menu') this.syncMenu();
  }

  showModal(kind) {
    this.overlay = kind;
    this.elements.modal.hidden = false;
    this.elements['modal-title'].textContent = kind === 'controls' ? 'KNOW YOUR MACHINE.' : 'YOUR GAME. YOUR RULES.';
    const content = this.elements['modal-content'];
    if (kind === 'controls') {
      content.innerHTML = `<p class="modal-intro">Master the ground. Then take to the sky.</p><dl class="controls-list">${controls.map(([key, description]) => `<div><dt><kbd>${key}</kbd></dt><dd>${description}</dd></div>`).join('')}</dl><div class="controller-note"><strong>GAMEPAD READY</strong><p>Left stick steer · triggers accelerate / brake · A jump · B boost · X powerslide · Y camera · Start pause. Use the stick for air control and bumpers to roll.</p></div>`;
    } else {
      content.innerHTML = `<p class="modal-intro">Settings save automatically on this device.</p><div class="settings-list"><label><span>FIELD OF VIEW<small>Wider view, more of the action.</small></span><div class="slider-control"><input id="setting-fov" type="range" min="60" max="100" step="1" value="${this.settings.fov}"><output id="fov-value">${this.settings.fov}°</output></div></label><label><span>MASTER VOLUME<small>Original synthesized arena audio.</small></span><div class="slider-control"><input id="setting-volume" type="range" min="0" max="100" step="1" value="${Math.round(this.settings.volume * 100)}"><output id="volume-value">${Math.round(this.settings.volume * 100)}%</output></div></label><label><span>MUTE AUDIO</span><input id="setting-muted" class="toggle-input" type="checkbox" ${this.settings.muted ? 'checked' : ''} aria-label="Mute all audio"></label><label><span>VISUAL QUALITY<small>Lower quality reduces GPU work.</small></span><select id="setting-quality"><option value="high" ${this.settings.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${this.settings.quality === 'low' ? 'selected' : ''}>Performance</option></select></label></div>`;
      content.oninput = e => {
        if (e.target.id === 'setting-fov') { this.settings.fov = Number(e.target.value); content.querySelector('#fov-value').textContent = `${this.settings.fov}°`; }
        else if (e.target.id === 'setting-volume') { this.settings.volume = Number(e.target.value) / 100; content.querySelector('#volume-value').textContent = `${e.target.value}%`; }
        else if (e.target.id === 'setting-muted') this.settings.muted = e.target.checked;
        else if (e.target.id === 'setting-quality') this.settings.quality = e.target.value;
        else return;
        this.save();
        this.callbacks.onSettings?.({ ...this.settings });
      };
    }
    if (kind === 'controls') content.oninput = null;
    this.elements.modal.querySelector('[data-action="close-modal"]').focus({ preventScroll: true });
  }

  closeModal() {
    this.overlay = null;
    this.elements.modal.hidden = true;
    document.activeElement?.blur();
  }

  updateHUD(data) {
    const { scores = [0, 0], time = 300, boost = 33, speed = 0, camera = 'BALL', phase = 'playing', countdown = 0, overtime = false, mode = 'duel' } = data;
    this.elements['score-blue'].textContent = scores[0];
    this.elements['score-orange'].textContent = scores[1];
    const seconds = Math.max(0, Math.ceil(time));
    this.elements['hud-clock'].textContent = mode === 'freeplay' ? '∞' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    this.elements['hud-period'].textContent = overtime ? 'OVERTIME' : mode === 'freeplay' ? 'FREE PLAY' : 'MATCH TIME';
    this.elements['hud-overtime'].hidden = !overtime;
    this.elements['hud-mode'].textContent = mode === 'freeplay' ? 'TRAINING SESSION' : '1V1 DUEL';
    const amount = Math.round(clamp(boost, 0, 100));
    this.elements['hud-boost'].textContent = amount;
    this.elements['boost-dial'].style.setProperty('--boost', `${amount * 3.6}deg`);
    this.elements['boost-dial'].classList.toggle('empty', amount <= 10);
    this.elements['hud-speed'].textContent = Math.round(Math.abs(speed) * 3.6);
    this.elements['hud-camera'].textContent = `${camera.toUpperCase().replace(' CAM', '')} CAM`;
    this.elements['kickoff-display'].hidden = phase !== 'kickoff';
    this.elements['kickoff-number'].textContent = Math.max(1, Math.ceil(countdown));
    this.elements['freeplay-label'].hidden = mode !== 'freeplay';
    if (performance.now() >= this.announcementUntil) this.announcement.hidden = true;
  }

  announce(text, subtitle = '', duration = 2000) {
    this.elements['announcement-title'].textContent = text;
    this.elements['announcement-subtitle'].textContent = subtitle;
    this.announcementUntil = performance.now() + duration;
    this.announcement.hidden = false;
    this.announcement.classList.remove('animate-announcement');
    void this.announcement.offsetWidth;
    this.announcement.classList.add('animate-announcement');
  }
}
