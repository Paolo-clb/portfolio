/* ==========================================================================
   Music Player — Self-contained IIFE
   Uses Web Audio API (AudioContext + MediaElementSource) so an
   AnalyserNode can be plugged in later for a visualizer.
   ========================================================================== */

(function () {
  'use strict';

  /* ---- State ---- */

  let playlist = [];      // shuffled copy of MUSIC
  let currentIndex = 0;
  let isPlaying = false;
  let audioCtx = null;    // created on first user interaction
  let sourceNode = null;  // MediaElementAudioSourceNode (one-time per <audio>)
  let gainNode = null;

  /* ---- DOM refs ---- */

  let audio, coverImg, titleEl, artistEl;
  let btnPrev, btnPlay, btnNext;
  let volumeSlider, volumeIcon;
  let container;

  /* ---- Shuffle (Fisher–Yates) ---- */

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---- Audio context (lazy, needs user gesture, HTTP only) ---- */

  let useWebAudio = location.protocol !== 'file:';

  function ensureAudioCtx() {
    if (!useWebAudio || audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaElementSource(audio);
      gainNode = audioCtx.createGain();
      sourceNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      // Expose for future visualizer
      window.__musicPlayerAudioCtx = audioCtx;
      window.__musicPlayerSource = sourceNode;
      window.__musicPlayerGain = gainNode;
    } catch (e) {
      useWebAudio = false;
    }
  }

  /* ---- Load track ---- */

  function loadTrack(index) {
    const track = playlist[index];
    if (!track) return;
    audio.src = track.src;
    coverImg.src = track.cover;
    coverImg.alt = track.title;
    titleEl.textContent = track.title;
    artistEl.textContent = track.artist;
  }

  /* ---- Playback ---- */

  function play() {
    ensureAudioCtx();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    audio.play().catch(() => {});
    isPlaying = true;
    updatePlayIcon();
  }

  function pause() {
    audio.pause();
    isPlaying = false;
    updatePlayIcon();
  }

  function togglePlay() {
    if (isPlaying) pause();
    else play();
  }

  function next() {
    currentIndex = (currentIndex + 1) % playlist.length;
    loadTrack(currentIndex);
    if (isPlaying) play();
  }

  function prev() {
    // If more than 3s in, restart current track
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadTrack(currentIndex);
    if (isPlaying) play();
  }

  /* ---- Volume ---- */

  function setVolume(val) {
    audio.volume = val;
    if (gainNode) gainNode.gain.value = val;
    updateVolumeIcon(val);
  }

  function toggleMute() {
    if (audio.volume > 0) {
      volumeSlider.dataset.prevVol = audio.volume;
      volumeSlider.value = 0;
      setVolume(0);
    } else {
      const prev = parseFloat(volumeSlider.dataset.prevVol) || 0.5;
      volumeSlider.value = prev;
      setVolume(prev);
    }
  }

  /* ---- Icons ---- */

  const SVG_PLAY = '<svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>';
  const SVG_PAUSE = '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>';
  const SVG_PREV = '<svg viewBox="0 0 24 24"><polygon points="19,20 9,12 19,4"/><rect x="5" y="4" width="2" height="16"/></svg>';
  const SVG_NEXT = '<svg viewBox="0 0 24 24"><polygon points="5,4 15,12 5,20"/><rect x="17" y="4" width="2" height="16"/></svg>';
  const SVG_VOL_HIGH = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
  const SVG_VOL_LOW = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
  const SVG_VOL_MUTE = '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/></svg>';

  function updatePlayIcon() {
    btnPlay.innerHTML = isPlaying ? SVG_PAUSE : SVG_PLAY;
  }

  function updateVolumeIcon(val) {
    if (val === 0) volumeIcon.innerHTML = SVG_VOL_MUTE;
    else if (val < 0.5) volumeIcon.innerHTML = SVG_VOL_LOW;
    else volumeIcon.innerHTML = SVG_VOL_HIGH;
  }

  /* ---- Build DOM ---- */

  function buildPlayer() {
    container = document.getElementById('music-player');
    if (!container) return;

    // Hidden <audio> element
    audio = document.createElement('audio');
    audio.preload = 'metadata';
    // crossOrigin needed for AudioContext analyser, but only works over HTTP
    if (location.protocol !== 'file:') {
      audio.crossOrigin = 'anonymous';
    }
    container.appendChild(audio);

    // Cover
    coverImg = document.createElement('img');
    coverImg.className = 'music-player__cover';
    container.appendChild(coverImg);

    // Info
    const info = document.createElement('div');
    info.className = 'music-player__info';
    titleEl = document.createElement('div');
    titleEl.className = 'music-player__title';
    artistEl = document.createElement('div');
    artistEl.className = 'music-player__artist';
    info.appendChild(titleEl);
    info.appendChild(artistEl);
    container.appendChild(info);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'music-player__controls';

    btnPrev = document.createElement('button');
    btnPrev.className = 'music-player__btn';
    btnPrev.innerHTML = SVG_PREV;
    btnPrev.setAttribute('aria-label', 'Previous');
    btnPrev.setAttribute('tabindex', '-1');

    btnPlay = document.createElement('button');
    btnPlay.className = 'music-player__btn music-player__btn--play';
    btnPlay.innerHTML = SVG_PLAY;
    btnPlay.setAttribute('aria-label', 'Play / Pause');
    btnPlay.setAttribute('tabindex', '-1');

    btnNext = document.createElement('button');
    btnNext.className = 'music-player__btn';
    btnNext.innerHTML = SVG_NEXT;
    btnNext.setAttribute('aria-label', 'Next');
    btnNext.setAttribute('tabindex', '-1');

    controls.appendChild(btnPrev);
    controls.appendChild(btnPlay);
    controls.appendChild(btnNext);
    container.appendChild(controls);

    // Volume
    const volWrap = document.createElement('div');
    volWrap.className = 'music-player__volume';

    volumeIcon = document.createElement('span');
    volumeIcon.className = 'music-player__volume-icon';
    volumeIcon.innerHTML = SVG_VOL_HIGH;

    volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'music-player__slider';
    volumeSlider.min = '0';
    volumeSlider.max = '1';
    volumeSlider.step = '0.01';
    volumeSlider.value = '0.5';
    volumeSlider.setAttribute('tabindex', '-1');

    volWrap.appendChild(volumeIcon);
    volWrap.appendChild(volumeSlider);
    container.appendChild(volWrap);
  }

  /* ---- Events ---- */

  function bindEvents() {
    btnPlay.addEventListener('click', togglePlay);
    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);

    volumeSlider.addEventListener('input', () => {
      setVolume(parseFloat(volumeSlider.value));
    });

    volumeIcon.addEventListener('click', toggleMute);

    // Auto-next when track ends
    audio.addEventListener('ended', next);
  }

  /* ---- Init ---- */

  function init() {
    if (typeof MUSIC === 'undefined' || !MUSIC.length) return;

    playlist = shuffle(MUSIC);
    currentIndex = 0;

    buildPlayer();
    if (!container) return;

    bindEvents();
    setVolume(0.5);
    loadTrack(0);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
