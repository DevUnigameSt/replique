import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, signInAnonymously, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getDatabase, ref, set, update, onValue, onDisconnect, remove } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const homePanel = document.querySelector('#homePanel');
const lobbyPanel = document.querySelector('#lobbyPanel');
const roundPanel = document.querySelector('#roundPanel');
const reviewPanel = document.querySelector('#reviewPanel');
const votePanel = document.querySelector('#votePanel');
const notice = document.querySelector('#notice');
const createButton = document.querySelector('#createButton');
const joinForm = document.querySelector('#joinForm');
const roomCode = document.querySelector('#roomCode');
const lobbyCode = document.querySelector('#lobbyCode');
const leaveButton = document.querySelector('#leaveButton');
const copyCode = document.querySelector('#copyCode');
const startButton = document.querySelector('#startButton');
const subtitleInput = document.querySelector('#subtitleInput');
const subtitlePreview = document.querySelector('#subtitlePreview');
const subtitleForm = document.querySelector('#subtitleForm');
const characterCount = document.querySelector('#characterCount');
const timer = document.querySelector('#timer');
const roundStatus = document.querySelector('#roundStatus');
const voteList = document.querySelector('#voteList');
const voteResult = document.querySelector('#voteResult');
const nextRoundButton = document.querySelector('#nextRoundButton');
const voteTimer = document.querySelector('#voteTimer');
const scorePanel = document.querySelector('#scorePanel');
const podium = document.querySelector('#podium');
const restartButton = document.querySelector('#restartButton');
const movieClip = document.querySelector('#movieClip');
const roundLabel = document.querySelector('#roundLabel');
const clipLabel = document.querySelector('#clipLabel');
const reviewCounter = document.querySelector('#reviewCounter');
const reviewPlayer = document.querySelector('#reviewPlayer');
const reviewSubtitle = document.querySelector('#reviewSubtitle');
const reviewVideo = document.querySelector('#reviewVideo');
const reviewClipLabel = document.querySelector('#reviewClipLabel');
const nextReview = document.querySelector('#nextReview');
const forceNewSession = new URLSearchParams(window.location.search).has('new');
if (forceNewSession) localStorage.removeItem('replique-last-room');
const playerId = sessionStorage.getItem('replique-player-id') || `player-${Math.random().toString(36).slice(2, 10)}`;
sessionStorage.setItem('replique-player-id', playerId);
let currentPlayer = null;
let database = null;
let activeRoomCode = null;
let timerId = null;
let submittedSubtitle = '';
let reviewAnswers = [];
let reviewSubmissionIds = [];
let reviewIndex = 0;
let sharedSubmissions = {};
let roomPlayers = {};
let roundClipOrder = [0, 1, 2, 3, 4, 5, 6, 7];
let voteTaken = false;
let activeVoteCount = 0;
let activePlayerCount = 0;
let activeRoomState = '';
let isHostPlayer = false;
let activeClip = null;
let clipTimerId = null;
let voteTimerId = null;
let voteSeconds = 20;
let roundNumber = 1;
let scores = { 'Joueur anonyme': 0, 'Joueur 2': 0, 'Joueur 3': 0, 'Joueur 4': 0 };
const clips = [
  { start: 60, label: 'SPEAK EASILY / SCÈNE 01 — DIALOGUE' },
  { start: 210, label: 'SPEAK EASILY / SCÈNE 02 — DISCUSSION' },
  { start: 480, label: 'SPEAK EASILY / SCÈNE 03 — RÉACTION' },
  { start: 780, label: 'SPEAK EASILY / SCÈNE 04 — ORDRE' },
  { start: 1200, label: 'SPEAK EASILY / SCÈNE 05 — FACE À FACE' }
];
let authReadyResolve;
const authReady = new Promise((resolve) => { authReadyResolve = resolve; });
const clipEnds = [80, 230, 500, 800, 1220];
const clipSources = [
  'https://upload.wikimedia.org/wikipedia/commons/3/31/Speak_Easily_%281932%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/7/70/Free_and_Easy_%281930_film%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/4/49/Brats_%281930%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/f/f3/The_Doorway_to_Hell_%281930%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/0/03/What_a_Life_%281930%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/9/98/Strictly_Unconventional_%281930%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/6/6a/Crying_for_the_Carolines_%281930%29.webm',
  'https://upload.wikimedia.org/wikipedia/commons/3/31/Speak_Easily_%281932%29.webm'
];
const clipWindows = [
  { start: 60, end: 80, label: 'SPEAK EASILY / DIALOGUE' },
  { start: 120, end: 140, label: 'FREE AND EASY / BUSTER KEATON' },
  { start: 180, end: 200, label: 'BRATS / LA PAGAILLE' },
  { start: 70, end: 90, label: 'AIN’T NATURE GRAND! / CARTOON' },
  { start: 480, end: 500, label: 'SPEAK EASILY / RÉACTION' }
];
const preciseClipWindows = [
  { start: 60, end: 70, label: 'SPEAK EASILY / DIALOGUE' },
  { start: 120, end: 130, label: 'FREE AND EASY / BUSTER KEATON' },
  { start: 180, end: 190, label: 'BRATS / LA PAGAILLE' },
  { start: 240, end: 250, label: 'THE DOORWAY TO HELL / DISCUSSION' },
  { start: 90, end: 100, label: 'WHAT A LIFE / FACE À FACE' },
  { start: 150, end: 160, label: 'STRICTLY UNCONVENTIONAL / ÉCHANGE' },
  { start: 75, end: 85, label: 'CRYING FOR THE CAROLINES / RÉACTION' },
  { start: 480, end: 490, label: 'SPEAK EASILY / RÉACTION' }
];
function shuffleClipOrder() { return [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5); }

function playClip(video, index) {
  clearTimeout(clipTimerId);
  const clipIndex = roundClipOrder[index] ?? index;
  activeClip = preciseClipWindows[clipIndex];
  if (video === movieClip) clipLabel.textContent = `${activeClip.label} / ${activeClip.end - activeClip.start} SEC`;
  if (video === reviewVideo && reviewClipLabel) reviewClipLabel.textContent = `${activeClip.label} / ${activeClip.end - activeClip.start} SEC`;
  if (video.dataset.clipSource !== clipSources[clipIndex]) { video.src = clipSources[clipIndex]; video.dataset.clipSource = clipSources[clipIndex]; video.load(); }
  video.pause();
  video.currentTime = activeClip.start;
  video.muted = false;
  const startPlayback = () => { video.currentTime = activeClip.start; video.play().catch(() => {}); clipTimerId = setTimeout(() => stopClip(video), (activeClip.end - activeClip.start) * 1000); };
  if (video.readyState >= 1) startPlayback(); else video.addEventListener('loadedmetadata', startPlayback, { once: true });
}

function stopClip(video) { clearTimeout(clipTimerId); video.pause(); video.currentTime = activeClip?.start || 0; }

function stopAtClipEnd(event) {
  if (activeClip && event.target.currentTime >= activeClip.end) {
    event.target.pause();
    event.target.currentTime = activeClip.start;
  }
}

function showNotice(message, isError = false) { notice.textContent = message; notice.classList.toggle('error', isError); }
function hasFirebaseConfig() { return Object.values(firebaseConfig).every((value) => value && !value.includes('A_REMPLACER')); }

async function connectAnonymously() {
  if (!hasFirebaseConfig()) { showNotice('Firebase n’est pas encore configuré.', true); return; }
  try { const app = initializeApp(firebaseConfig); database = getDatabase(app); const auth = getAuth(app); await signOut(auth); await setPersistence(auth, browserSessionPersistence); onAuthStateChanged(auth, (user) => { currentPlayer = user; if (user) authReadyResolve(); }); await signInAnonymously(auth); }
  catch (error) { console.error(error); showNotice('Connexion Firebase impossible.', true); }
}

async function openLobby(code, isHost) {
  localStorage.setItem('replique-last-room', code);
  await Promise.race([authReady, new Promise((resolve) => setTimeout(resolve, 2500))]);
  activeRoomCode = code; homePanel.hidden = true; lobbyPanel.hidden = false; lobbyCode.textContent = code; document.querySelector('.host-badge').hidden = !isHost; window.scrollTo({ top: 0, behavior: 'smooth' });
  if (!database || !currentPlayer) return;
  const playerRef = ref(database, `rooms/${code}/players/${playerId}`);
  try {
    if (isHost) { roundClipOrder = shuffleClipOrder(); await set(ref(database, `rooms/${code}`), { state: 'LOBBY', hostId: playerId, roundClipOrder, players: { [playerId]: { name: 'Joueur anonyme', host: true } } }); }
    else await update(playerRef, { name: 'Joueur anonyme', host: false });
    onDisconnect(playerRef).remove();
    onValue(ref(database, `rooms/${code}`), (snapshot) => {
      const room = snapshot.val(); if (!room) return; activeRoomState = room.state || 'LOBBY';
      const players = Object.keys(room.players || {}); roomPlayers = room.players || {}; isHostPlayer = room.hostId === playerId; startButton.hidden = !isHostPlayer; startButton.style.display = isHostPlayer ? '' : 'none'; roundClipOrder = room.roundClipOrder || roundClipOrder; activePlayerCount = players.length; document.querySelector('#playerCount').textContent = `${players.length} / 8`; sharedSubmissions = room.submissions || {};
      document.querySelector('#playersList').innerHTML = players.map((uid) => `<div class="player-row"><span class="avatar">${uid === playerId ? 'TOI' : 'P'}</span><span class="player-name">${roomPlayers[uid].name || 'Joueur'}</span>${uid === room.hostId ? '<span class="host-badge">HÔTE</span>' : ''}</div>`).join('');
      const computedScores = {};
      Object.values(room.votes || {}).forEach((roundVotes) => Object.values(roundVotes || {}).forEach((targetUid) => { computedScores[targetUid] = (computedScores[targetUid] || 0) + 1; }));
      scores = players.reduce((result, uid) => { result[uid] = computedScores[uid] || 0; return result; }, {});
      if (!scorePanel.hidden) showScores();
      if (!reviewPanel.hidden && Object.keys(sharedSubmissions).length > 0) { reviewSubmissionIds = Object.keys(sharedSubmissions); reviewAnswers = Object.values(sharedSubmissions); reviewIndex = Math.min(reviewIndex, reviewAnswers.length - 1); renderReviewAnswer(); }
      const submittedCount = Object.keys(room.submissions || {}).length;
      if (room.state === 'ROUND') {
        roundStatus.innerHTML = `<span class="pulse"></span> ${submittedCount >= players.length ? 'Préparation des réponses…' : 'Les autres joueurs écrivent leur réplique…'} <strong>${submittedCount} / ${players.length} prêt${submittedCount > 1 ? 's' : ''}</strong>`;
        if (submittedCount >= players.length) update(ref(database, `rooms/${activeRoomCode}`), { state: 'REVIEW' }).catch(() => {});
      }
      if (!votePanel.hidden) {
        activeVoteCount = Object.keys((room.votes || {})[roundNumber] || {}).length;
        if (activeVoteCount >= activePlayerCount && activePlayerCount > 0) {
          voteResult.hidden = false;
          voteResult.textContent = 'Tout le monde a voté !';
          nextRoundButton.hidden = false;
        } else {
          nextRoundButton.hidden = true;
          voteResult.hidden = false;
          voteResult.textContent = `Votes reçus : ${activeVoteCount} / ${activePlayerCount}`;
        }
      }
      const roomRound = room.roundNumber || 1;
      const readyCount = Object.keys((room.nextReady || {})[roomRound] || {}).length;
      if (room.state === 'VOTE' && readyCount >= players.length && room.hostId === playerId) update(ref(database, `rooms/${activeRoomCode}`), { state: 'ROUND', roundNumber: roomRound + 1, submissions: {}, nextReady: {}}).catch(() => {});
      if (room.state === 'ROUND' && roomRound > roundNumber) { roundNumber = roomRound; startRound(); }
      if (!votePanel.hidden && activeVoteCount >= activePlayerCount && activePlayerCount > 0) finishVoting();
      if (room.state === 'ROUND' && roundPanel.hidden && reviewPanel.hidden && votePanel.hidden) startRound();
      if (room.state === 'REVIEW' && reviewPanel.hidden && votePanel.hidden) showReview();
    });
  } catch (error) { console.warn('Realtime Database non activée, mode local utilisé.', error); }
}

function renderReviewAnswer() {
  reviewCounter.textContent = `${reviewIndex + 1} / ${reviewAnswers.length}`;
  reviewPlayer.textContent = `JOUEUR ANONYME ${reviewIndex + 1}`;
  reviewSubtitle.textContent = `« ${reviewAnswers[reviewIndex]} »`;
  nextReview.innerHTML = reviewIndex === reviewAnswers.length - 1 ? 'Passer au vote <span>→</span>' : 'Réponse suivante <span>→</span>';
}

function showReview() {
  clearInterval(timerId); stopClip(movieClip); roundPanel.hidden = true; votePanel.hidden = true; reviewPanel.hidden = false;
  playClip(reviewVideo, roundNumber - 1);
  reviewAnswers = Object.values(sharedSubmissions).length > 0 ? Object.values(sharedSubmissions) : [submittedSubtitle || 'Ce joueur n’a pas envoyé de réponse.', 'Quand tu comprends enfin le tutoriel après 47 essais.', 'Moi devant mon compte bancaire le 28 du mois.', 'Cette réunion aurait pu être un message.'];
  reviewSubmissionIds = Object.keys(sharedSubmissions);
  reviewIndex = 0; renderReviewAnswer();
}

function showVoting() {
  clearInterval(timerId); clearInterval(voteTimerId); stopClip(reviewVideo); stopClip(movieClip); reviewPanel.hidden = true; roundPanel.hidden = true; votePanel.hidden = false; voteResult.hidden = true;
  voteSeconds = 20;
  updateVoteTimer();
  voteTimerId = setInterval(() => { voteSeconds -= 1; updateVoteTimer(); if (voteSeconds <= 0) finishVoting(); }, 1000);
  if (database && activeRoomCode && currentPlayer) update(ref(database, `rooms/${activeRoomCode}`), { state: 'VOTE', roundNumber }).catch(() => {});
  voteTaken = false;
  const ownAnswerIndex = reviewSubmissionIds.indexOf(playerId);
  if (ownAnswerIndex >= 0) { const ownAnswer = voteList.querySelector(`[data-answer="${ownAnswerIndex}"]`); if (ownAnswer) { ownAnswer.disabled = true; ownAnswer.title = 'Tu ne peux pas voter pour ta propre réponse'; } }
  voteList.innerHTML = reviewAnswers.map((answer, index) => `<button class="vote-card" data-answer="${index}"><span class="vote-letter">${String.fromCharCode(65 + index)}</span><span>${answer}</span><span class="vote-check">○</span></button>`).join('');
  nextRoundButton.hidden = true;
  if (ownAnswerIndex >= 0) { const ownAnswer = voteList.querySelector(`[data-answer="${ownAnswerIndex}"]`); if (ownAnswer) { ownAnswer.disabled = true; ownAnswer.classList.add('own-answer'); ownAnswer.style.opacity = '0.45'; ownAnswer.style.cursor = 'not-allowed'; const check = ownAnswer.querySelector('.vote-check'); if (check) check.textContent = 'TOI'; } }
  if (ownAnswerIndex >= 0) { const ownAnswer = voteList.querySelector(`[data-answer="${ownAnswerIndex}"]`); if (ownAnswer) { ownAnswer.disabled = true; ownAnswer.title = 'Tu ne peux pas voter pour ta propre réponse'; } }
  voteList.querySelectorAll('.vote-card').forEach((card) => card.addEventListener('click', () => { voteList.querySelectorAll('.vote-card').forEach((item) => item.classList.remove('selected')); card.classList.add('selected'); scores[reviewAnswers[Number(card.dataset.answer)] === submittedSubtitle ? 'Joueur anonyme' : `Joueur ${Number(card.dataset.answer) + 1}`] += 1; voteResult.hidden = false; voteResult.textContent = 'Vote enregistré !'; nextRoundButton.hidden = false; }));
}

function updateVoteTimer() { if (voteTimer) voteTimer.textContent = `00:${String(Math.max(0, voteSeconds)).padStart(2, '0')}`; }
function finishVoting() { clearInterval(voteTimerId); voteSeconds = 0; updateVoteTimer(); nextRoundButton.hidden = false; voteResult.hidden = false; voteResult.textContent = 'Vote terminé !'; }

voteList.addEventListener('click', (event) => {
  const card = event.target.closest('.vote-card');
  if (!card || voteTaken) { if (card && voteTaken) event.stopImmediatePropagation(); return; }
  voteTaken = true;
  voteList.querySelectorAll('.vote-card').forEach((item) => { item.disabled = true; });
  card.classList.add('selected');
  card.querySelector('.vote-check').textContent = '✓';
  event.stopImmediatePropagation();
  const targetUid = reviewSubmissionIds[Number(card.dataset.answer)] || `local-${Number(card.dataset.answer) + 1}`;
  if (database && activeRoomCode && currentPlayer) update(ref(database, `rooms/${activeRoomCode}/votes/${roundNumber}/${playerId}`), targetUid).catch(() => {});
  else scores[targetUid] = (scores[targetUid] || 0) + 1;
  voteResult.hidden = false;
  voteResult.textContent = 'Vote enregistré !';
  nextRoundButton.hidden = false;
}, true);

function startRound() {
  lobbyPanel.hidden = true; roundPanel.hidden = false; reviewPanel.hidden = true; votePanel.hidden = true; scorePanel.hidden = true; subtitleInput.disabled = false; subtitleInput.value = ''; subtitlePreview.textContent = 'Ton sous-titre apparaîtra ici'; characterCount.textContent = '0 / 80'; roundPanel.classList.remove('submitted'); subtitleForm.querySelector('button').textContent = 'Envoyer'; roundLabel.textContent = `MANCHE ${String(roundNumber).padStart(2, '0')} / 05`; clipLabel.textContent = `${clips[roundNumber - 1].label} / 20 SEC`; playClip(movieClip, roundNumber - 1);
  if (database && activeRoomCode && currentPlayer) update(ref(database, `rooms/${activeRoomCode}`), { state: 'ROUND' }).catch(() => {});
  let seconds = 110; const updateTimer = () => { timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }; updateTimer(); clearInterval(timerId);
  timerId = setInterval(() => { seconds -= 1; updateTimer(); if (seconds <= 0) { clearInterval(timerId); subtitleInput.disabled = true; if (!database || !activeRoomCode || !currentPlayer) showReview(); else roundStatus.innerHTML = '<span class="pulse"></span> Temps écoulé. En attente des autres joueurs…'; } }, 1000); subtitleInput.focus();
}

createButton.addEventListener('click', () => openLobby(Math.random().toString(36).slice(2, 8).toUpperCase(), true));
joinForm.addEventListener('submit', (event) => { event.preventDefault(); const code = roomCode.value.trim().toUpperCase(); if (code.length < 4) { showNotice('Entre un code de partie valide (4 à 6 caractères).', true); roomCode.focus(); return; } openLobby(code, false); });
leaveButton.addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  clearInterval(timerId); clearInterval(voteTimerId); stopClip(movieClip); stopClip(reviewVideo);
  if (database && activeRoomCode && currentPlayer) await remove(ref(database, `rooms/${activeRoomCode}/players/${playerId}`)).catch(() => {});
  localStorage.removeItem('replique-last-room');
  activeRoomCode = null; activeRoomState = ''; homePanel.hidden = false; lobbyPanel.hidden = true; roundPanel.hidden = true; reviewPanel.hidden = true; votePanel.hidden = true; scorePanel.hidden = true; roomCode.value = '';
}, true);
copyCode.addEventListener('click', async () => { await navigator.clipboard?.writeText(lobbyCode.textContent); copyCode.textContent = '✓'; setTimeout(() => { copyCode.textContent = '⧉'; }, 1200); });
roomCode.addEventListener('input', () => { roomCode.value = roomCode.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); });
startButton.addEventListener('click', (event) => { if (!isHostPlayer) { event.preventDefault(); event.stopImmediatePropagation(); showNotice('Seul l’hôte peut lancer la partie.', true); return; } if (activePlayerCount < 2) { event.preventDefault(); event.stopImmediatePropagation(); showNotice('Il faut au moins 2 joueurs pour commencer.', true); } }, true);
startButton.addEventListener('click', startRound);
subtitleInput.addEventListener('input', () => { subtitlePreview.textContent = subtitleInput.value || 'Ton sous-titre apparaîtra ici'; characterCount.textContent = `${subtitleInput.value.length} / 80`; });
subtitleForm.addEventListener('submit', (event) => { event.preventDefault(); if (!subtitleInput.value.trim()) return; submittedSubtitle = subtitleInput.value.trim(); subtitleInput.disabled = true; subtitleForm.querySelector('button').textContent = 'Réplique envoyée ✓'; roundPanel.classList.add('submitted'); if (database && activeRoomCode && currentPlayer) update(ref(database, `rooms/${activeRoomCode}/submissions`), { [playerId]: submittedSubtitle }).catch(() => {}); showReview(); });
subtitleForm.addEventListener('submit', (event) => {
  if (!database || !activeRoomCode || !currentPlayer) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!subtitleInput.value.trim() || subtitleInput.disabled) return;
  submittedSubtitle = subtitleInput.value.trim();
  subtitleInput.disabled = true;
  subtitleForm.querySelector('button').textContent = 'Réplique envoyée ✓';
  roundPanel.classList.add('submitted');
  update(ref(database, `rooms/${activeRoomCode}/submissions`), { [playerId]: submittedSubtitle }).catch(() => {});
  roundStatus.innerHTML = '<span class="pulse"></span> Réponse enregistrée. En attente des autres joueurs…';
}, true);

nextReview.addEventListener('click', () => { if (reviewIndex < reviewAnswers.length - 1) { reviewIndex += 1; renderReviewAnswer(); } else showVoting(); });
movieClip.addEventListener('timeupdate', stopAtClipEnd);
reviewVideo.addEventListener('timeupdate', stopAtClipEnd);
nextRoundButton.addEventListener('click', (event) => {
  if (database && activePlayerCount > 0 && activeVoteCount >= activePlayerCount) {
    event.preventDefault();
    event.stopImmediatePropagation();
    nextRoundButton.hidden = true;
    voteResult.hidden = false;
    voteResult.textContent = 'En attente des autres joueurs…';
  update(ref(database, `rooms/${activeRoomCode}/nextReady/${roundNumber}/${playerId}`), true).catch(() => {});
    return;
  }
  if (database && activePlayerCount > 0 && activeVoteCount < activePlayerCount) {
    event.preventDefault();
    event.stopImmediatePropagation();
    voteResult.hidden = false;
    voteResult.textContent = `Attends les autres votes : ${activeVoteCount} / ${activePlayerCount}`;
  }
}, true);
nextRoundButton.addEventListener('click', () => { if (roundNumber >= 5) showScores(); else { roundNumber += 1; startRound(); } });
restartButton.addEventListener('click', () => { roundNumber = 1; scores = { 'Joueur anonyme': 0, 'Joueur 2': 0, 'Joueur 3': 0, 'Joueur 4': 0 }; homePanel.hidden = false; scorePanel.hidden = true; });
function showScores() { votePanel.hidden = true; scorePanel.hidden = false; const ranking = Object.entries(scores).map(([uid, score]) => [roomPlayers[uid]?.name || uid, score]).sort((a, b) => b[1] - a[1]); const medals = ['🥇', '🥈', '🥉', '']; podium.innerHTML = ranking.map(([name, score], index) => `<div class="podium-row"><span class="medal">${medals[index]}</span><strong>${index + 1}</strong><span>${name}</span><b>${score} pt${score > 1 ? 's' : ''}</b></div>`).join(''); }
leaveButton.addEventListener('click', () => localStorage.removeItem('replique-last-room'), true);
connectAnonymously();
authReady.then(() => { const savedRoom = localStorage.getItem('replique-last-room'); if (!forceNewSession && savedRoom && !activeRoomCode) openLobby(savedRoom, false); });
