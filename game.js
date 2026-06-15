// ─── PARTICLES ───
const pContainer = document.getElementById('bgParticles');
for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `left:${Math.random()*100}%; --dur:${4+Math.random()*8}s; --delay:${Math.random()*8}s;`;
    if (Math.random() > 0.5) { p.style.background = '#a855f7'; p.style.width = '3px'; p.style.height = '3px'; }
    pContainer.appendChild(p);
}

// ─── WEBSOCKET NETWORK ───
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${location.host}/api/ws`;
let ws = null;
let wsReady = false;
const msgQueue = [];
let reconnectTimer = null;
let reconnectAttempts = 0;

function setConnectionStatus(status) {
    const dot = document.getElementById('wsDot');
    const label = document.getElementById('wsLabel');
    if (!dot || !label) return;
    dot.className = 'ws-dot ws-' + status;
    if (status === 'connected')   { label.textContent = 'З\'єднано'; }
    if (status === 'connecting')  { label.textContent = 'З\'єднання...'; }
    if (status === 'disconnected'){ label.textContent = 'Відключено'; }
}

function connectWS() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    setConnectionStatus('connecting');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        wsReady = true;
        reconnectAttempts = 0;
        setConnectionStatus('connected');
        while (msgQueue.length > 0) {
            ws.send(JSON.stringify(msgQueue.shift()));
        }
    };

    ws.onclose = () => {
        wsReady = false;
        setConnectionStatus('disconnected');
        if (roomCode) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            reconnectAttempts++;
            reconnectTimer = setTimeout(() => { ws = null; connectWS(); }, delay);
        }
    };

    ws.onerror = () => {
        wsReady = false;
        setConnectionStatus('disconnected');
    };

    ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch(e) { return; }
        handleNetworkMessage(msg);
    };
}

function netSend(msg) {
    if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    } else {
        msgQueue.push(msg);
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            ws = null;
            connectWS();
        }
    }
}

// ─── DICTIONARIES ───
const wordsDictionary = [
    "алгоритм","процесор","монітор","сервер","кодування","інтернет","роутер","клавіатура",
    "база даних","файрвол","компілятор","функція","змінна","мережа","пітон",
    "джаваскрипт","фреймворк","бібліотека","термінал","дебагер","інтерфейс","протокол"
];

const itemsDictionary = [
    {name:"Ключ",emoji:"🔑"},{name:"Кіт",emoji:"🐱"},{name:"Ноутбук",emoji:"💻"},
    {name:"Кава",emoji:"☕"},{name:"Піца",emoji:"🍕"},{name:"Гітара",emoji:"🎸"},
    {name:"Книга",emoji:"📚"},{name:"Годинник",emoji:"⏰"},{name:"Діамант",emoji:"💎"},
    {name:"Ліхтар",emoji:"🔦"},{name:"Навушники",emoji:"🎧"},{name:"Геймпад",emoji:"🎮"},
    {name:"Яблуко",emoji:"🍎"},{name:"Кактус",emoji:"🌵"},{name:"Окуляри",emoji:"🕶️"},
    {name:"Монета",emoji:"🪙"},{name:"Кавун",emoji:"🍉"},{name:"М'яч",emoji:"⚽"},
    {name:"Папуга",emoji:"🦜"},{name:"Парасоля",emoji:"☂️"},{name:"Корона",emoji:"👑"},
    {name:"Телефон",emoji:"📱"},{name:"Магніт",emoji:"🧲"},{name:"Вогонь",emoji:"🔥"},
    {name:"Молоток",emoji:"🔨"},{name:"Лимон",emoji:"🍋"},{name:"Гриб",emoji:"🍄"},
    {name:"Зірка",emoji:"⭐"},{name:"Ракета",emoji:"🚀"},{name:"Привид",emoji:"👻"}
];

// ─── STATE ───
let myId = 'p_' + Math.random().toString(36).substr(2, 9);
let myName = "";
let roomCode = "";
let isHost = false;
let gameMode = "typing";

let players = [];
let gameWords = [];
let gameState = "lobby";

let localRound = 1;
let localTotalScore = 0;
let localStreak = 0;
let wordStartTime = 0;
let localTimerInterval = null;

// ─── GLOBAL GAME TIMER (2 хвилини) ───
const GAME_TIME_LIMIT = 120; // секунди
let globalTimerInterval = null;
let gameEndTime = 0;
let gameTimedOut = false;

function startGlobalTimer() {
    gameEndTime = Date.now() + GAME_TIME_LIMIT * 1000;
    gameTimedOut = false;

    if (globalTimerInterval) clearInterval(globalTimerInterval);
    globalTimerInterval = setInterval(() => {
        const remaining = Math.max(0, gameEndTime - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const display = `${mins}:${secs.toString().padStart(2, '0')}`;
        const el = document.getElementById('globalTimer');
        if (el) {
            el.innerText = display;
            if (remaining <= 30000) {
                el.style.color = 'var(--red)';
                el.style.textShadow = remaining <= 10000 ? '0 0 10px rgba(255,74,74,0.8)' : '';
            } else {
                el.style.color = 'var(--orange)';
                el.style.textShadow = '';
            }
        }
        if (remaining <= 0) {
            clearInterval(globalTimerInterval);
            globalTimerInterval = null;
            onTimeUp();
        }
    }, 250);
}

function stopGlobalTimer() {
    if (globalTimerInterval) clearInterval(globalTimerInterval);
    globalTimerInterval = null;
}

function onTimeUp() {
    if (gameTimedOut) return;
    gameTimedOut = true;

    clearInterval(localTimerInterval);
    localTimerInterval = null;

    const el = document.getElementById('globalTimer');
    if (el) { el.innerText = '0:00'; el.style.color = 'var(--red)'; }

    const container = document.getElementById('gameBox');
    container.classList.add('time-up-blink');
    setTimeout(() => container.classList.remove('time-up-blink'), 1200);

    showToast('⏰ Час вийшов!');

    document.getElementById('wordTarget').innerText = "⏰ Час вийшов!";
    document.getElementById('typingEngineZone').style.display = 'none';
    document.getElementById('searchEngineZone').style.display = 'none';
    document.getElementById('roundProgressFill').style.width = '100%';

    let me = players.find(p => p.id === myId);
    if (me) { me.score = localTotalScore; me.done = true; me.round = localRound; }

    if (isHost) {
        players.forEach(p => { if (!p.done) { p.done = true; } });
        gameState = "finished";
        playSfx('finish');
        stopAllTracks();
        hostBroadcastState();
        updateLiveLeaderboardUI();
        setTimeout(renderFinalLeaderboard, 1000);
    } else {
        netSend({
            type: 'CLIENT_LIVE_UPDATE', code: roomCode, id: myId,
            round: localRound,
            score: localTotalScore, done: true
        });
        updateLiveLeaderboardUI();
    }
}

// ─── AUDIO ───
let audioCtx = null;
let isMusicPlaying = false;
let currentBgmTrack = null;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTrack(trackId) {
    const lobby = document.getElementById('lobbyBgm');
    const game = document.getElementById('gameBgm');
    if (!lobby || !game) return;
    lobby.pause(); game.pause();
    if (!isMusicPlaying) return;
    if (trackId === 'lobby') {
        lobby.currentTime = 0;
        lobby.play().catch(()=>{});
        currentBgmTrack = 'lobby';
    } else if (trackId === 'game') {
        game.currentTime = 0;
        game.play().catch(()=>{});
        currentBgmTrack = 'game';
    }
}

function stopAllTracks() {
    const lobby = document.getElementById('lobbyBgm');
    const game = document.getElementById('gameBgm');
    if (lobby) { lobby.pause(); lobby.currentTime = 0; }
    if (game) { game.pause(); game.currentTime = 0; }
}

window.toggleBGM = function() {
    initAudio();
    const btn = document.getElementById('bgmBtn');
    isMusicPlaying = !isMusicPlaying;
    if (isMusicPlaying) {
        btn.textContent = '🎵 Музика УВІМК';
        btn.classList.remove('muted');
        const activeScreen = ['menuScreen','joinScreen','lobbyScreen','playScreen','resultScreen']
            .find(s => document.getElementById(s).style.display !== 'none');
        if (activeScreen === 'lobbyScreen') playTrack('lobby');
        else if (activeScreen === 'playScreen') playTrack('game');
    } else {
        btn.textContent = '🔇 Музика ВИМК';
        btn.classList.add('muted');
        stopAllTracks();
    }
};

// ─── SFX ───
function playSfx(type) {
    try {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        } else if (type === 'start') {
            [440, 554, 659, 880].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = freq;
                const t = now + i * 0.1;
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.07, t + 0.05);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(t); o.stop(t + 0.3);
            });
            return;
        } else if (type === 'countdown') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        } else if (type === 'go') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        } else if (type === 'join') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        } else if (type === 'finish') {
            [523, 659, 784, 1047].forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'triangle'; o.frequency.value = freq;
                const t = now + i * 0.12;
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.07, t + 0.06);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(t); o.stop(t + 0.4);
            });
            return;
        }

        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.3);
    } catch(e) {}
}

// ─── TOAST ───
function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ─── SCREENS ───
window.showScreen = function(id) {
    ['menuScreen','joinScreen','lobbyScreen','playScreen','resultScreen'].forEach(s => {
        document.getElementById(s).style.display = (s === id) ? 'block' : 'none';
    });
};

// ─── GAME SETUP ───
window.setGameMode = function(mode) {
    gameMode = mode;
    document.getElementById('modeType').classList.toggle('active', mode === 'typing');
    document.getElementById('modeSearch').classList.toggle('active', mode === 'search');
};

function setupProfile() {
    const input = document.getElementById('nicknameInput').value.trim();
    myName = input || "Гравець_" + Math.floor(Math.random() * 900);
}

// ─── LOBBY ───
window.onCreateLobby = function() {
    initAudio(); setupProfile();
    isHost = true;
    roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    gameState = "lobby";
    players = [{ id: myId, name: myName, isHost: true, round: 1, score: 0, done: false }];

    document.getElementById('hostStartBtn').style.display = 'block';
    document.getElementById('clientWaitText').style.display = 'none';
    document.getElementById('lobbyCodeDisplay').innerText = roomCode;

    showScreen('lobbyScreen');
    updateLobbyUI();
    if (isMusicPlaying) playTrack('lobby');

    connectWS();
    netSend({
        type: 'CLIENT_REQUEST_JOIN', code: roomCode,
        player: { id: myId, name: myName, isHost: true, round: 1, score: 0, done: false }
    });
};

window.onJoinLobbySubmit = function() {
    initAudio(); setupProfile();
    const inputCode = document.getElementById('roomCodeInput').value.trim();
    if (inputCode.length !== 4) { showToast("❌ Код має бути рівно 4 цифри!"); return; }
    roomCode = inputCode; isHost = false;

    document.getElementById('hostStartBtn').style.display = 'none';
    document.getElementById('clientWaitText').style.display = 'block';
    document.getElementById('lobbyCodeDisplay').innerText = roomCode;

    showScreen('lobbyScreen');
    if (isMusicPlaying) playTrack('lobby');

    connectWS();
    netSend({
        type: 'CLIENT_REQUEST_JOIN', code: roomCode,
        player: { id: myId, name: myName, isHost: false, round: 1, score: 0, done: false }
    });
};

function updateLobbyUI() {
    document.getElementById('lobbyModeDisplay').innerText =
        gameMode === 'typing' ? "⌨️ Режим: Набір слів" : "🔍 Режим: Знайти емодзі";
    const container = document.getElementById('playersListContainer');
    container.innerHTML = "";
    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'kahoot-player-card' + (p.id === myId ? ' me' : '');
        el.innerHTML = `👾 ${p.name}${p.id === myId ? ' <b style="font-size:0.8em">(ти)</b>' : ''}`;
        container.appendChild(el);
    });
}

window.leaveLobby = function() {
    if (roomCode) {
        netSend({ type: 'LEAVE_ROOM', code: roomCode, id: myId, name: myName });
    }
    if (ws) { ws.close(); ws = null; wsReady = false; }
    resetToMenu();
};

window.resetToMenu = function() {
    if (localTimerInterval) clearInterval(localTimerInterval);
    stopGlobalTimer();
    stopAllTracks();
    isMusicPlaying = false;
    document.getElementById('bgmBtn').textContent = '🔇 Музика ВИМК';
    document.getElementById('bgmBtn').classList.add('muted');
    players = []; isHost = false; roomCode = "";
    showScreen('menuScreen');
};

// ─── HOST BROADCAST ───
function hostBroadcastState() {
    netSend({
        type: 'HOST_ROOM_STATE', code: roomCode, players: players,
        gameState: gameState, words: gameWords, gameMode: gameMode
    });
}

window.hostBroadcastStart = function() {
    gameWords = [];
    if (gameMode === "typing") {
        let pool = [...wordsDictionary];
        for (let i = 0; i < 5; i++) {
            let idx = Math.floor(Math.random() * pool.length);
            gameWords.push(pool[idx]);
            pool.splice(idx, 1);
        }
    } else {
        for (let r = 0; r < 5; r++) {
            let targetItem = itemsDictionary[Math.floor(Math.random() * itemsDictionary.length)];
            let gridItems = [targetItem];
            while (gridItems.length < 24) {
                let decoy = itemsDictionary[Math.floor(Math.random() * itemsDictionary.length)];
                if (decoy.name !== targetItem.name) gridItems.push(decoy);
            }
            gridItems.sort(() => Math.random() - 0.5);
            gameWords.push({ targetName: targetItem.name, targetEmoji: targetItem.emoji, grid: gridItems });
        }
    }
    gameState = "playing";
    hostBroadcastState();
    startCountdown(() => startGameSession());
};

// ─── COUNTDOWN ───
function startCountdown(cb) {
    const overlay = document.getElementById('countdownOverlay');
    const numEl = document.getElementById('countdownNumber');
    overlay.style.display = 'flex';
    let count = 3;

    const tick = () => {
        numEl.textContent = count;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = 'count-pop 1s ease-in-out';
        playSfx('countdown');
        count--;
        if (count > 0) {
            setTimeout(tick, 1000);
        } else {
            setTimeout(() => {
                numEl.textContent = 'ВПЕРЕД!';
                numEl.style.animation = 'none';
                void numEl.offsetWidth;
                numEl.style.animation = 'count-pop 0.6s ease-in-out';
                playSfx('go');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    cb();
                }, 700);
            }, 1000);
        }
    };
    tick();
}

// ─── GAME SESSION ───
function startGameSession() {
    showScreen('playScreen');
    localRound = 1; localTotalScore = 0; localStreak = 0;
    document.getElementById('localScoreDisplay').innerText = "0";
    document.getElementById('currentRound').innerText = localRound;

    document.getElementById('typingEngineZone').style.display = (gameMode === 'typing') ? 'block' : 'none';
    document.getElementById('searchEngineZone').style.display = (gameMode === 'search') ? 'block' : 'none';

    stopAllTracks();
    if (isMusicPlaying) playTrack('game');
    playSfx('start');

    // Запускаємо глобальний таймер на 2 хвилини
    startGlobalTimer();

    startNewRound();
}

function startNewRound() {
    wordStartTime = Date.now();
    document.getElementById('roundProgressFill').style.width = ((localRound / 5) * 100) + '%';

    if (gameMode === "typing") {
        document.getElementById('userInput').value = "";
        document.getElementById('wordTarget').innerText = gameWords[localRound - 1];
        setTimeout(() => document.getElementById('userInput').focus(), 50);
    } else {
        let roundData = gameWords[localRound - 1];
        document.getElementById('wordTarget').innerText = `Знайди: ${roundData.targetEmoji}`;
        const gridContainer = document.getElementById('roomObjectsGrid');
        gridContainer.innerHTML = "";
        roundData.grid.forEach(item => {
            const el = document.createElement('div');
            el.className = "object-item";
            el.innerText = item.emoji;
            el.onclick = (e) => onObjectClicked(item.name, e);
            gridContainer.appendChild(el);
        });
    }

    if (localTimerInterval) clearInterval(localTimerInterval);
    localTimerInterval = setInterval(() => {
        document.getElementById('timer').innerText = ((Date.now() - wordStartTime) / 1000).toFixed(1);
    }, 100);
}

function onObjectClicked(clickedName, e) {
    let roundData = gameWords[localRound - 1];
    let elapsed = (Date.now() - wordStartTime) / 1000;
    processAnswer(clickedName === roundData.targetName, elapsed, e);
}

document.getElementById('userInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const target = gameWords[localRound - 1];
        const typed = this.value.trim().toLowerCase();
        let elapsed = (Date.now() - wordStartTime) / 1000;
        processAnswer(typed === target.toLowerCase(), elapsed, null);
    }
});

function spawnScorePop(points, x, y) {
    const pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.textContent = '+' + points;
    pop.style.left = (x || window.innerWidth / 2) + 'px';
    pop.style.top = (y || window.innerHeight / 2 - 40) + 'px';
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
}

function processAnswer(isCorrect, elapsed, evnt) {
    if (gameTimedOut) return;
    const container = document.getElementById('gameBox');

    if (isCorrect) {
        let wordPoints = Math.max(500, Math.round(1000 - (elapsed * 90)));
        localStreak++;
        if (localStreak >= 2) wordPoints += Math.min(500, localStreak * 100);
        localTotalScore += wordPoints;
        document.getElementById('localScoreDisplay').innerText = localTotalScore;

        container.className = "game-container correct-blink";
        setTimeout(() => container.className = "game-container", 300);

        const cx = evnt ? evnt.clientX : window.innerWidth / 2;
        const cy = evnt ? evnt.clientY : window.innerHeight / 2;
        spawnScorePop(wordPoints, cx, cy);
        playSfx('correct');
    } else {
        localStreak = 0;
        container.className = "game-container wrong-blink";
        const wt = document.getElementById('wordTarget');
        wt.classList.add('shake');
        setTimeout(() => { container.className = "game-container"; wt.classList.remove('shake'); }, 350);
        playSfx('wrong');
    }

    const streakZone = document.getElementById('streakZone');
    streakZone.innerHTML = localStreak >= 2
        ? `<div class="streak-badge">⚡ СЕРІЯ x${localStreak} 🔥</div>` : "";

    localRound++;
    const isDone = localRound > 5;

    if (isDone) {
        clearInterval(localTimerInterval);
        stopGlobalTimer();
        document.getElementById('wordTarget').innerText = "⏳ Очікуємо інших...";
        document.getElementById('typingEngineZone').style.display = 'none';
        document.getElementById('searchEngineZone').style.display = 'none';
        document.getElementById('roundProgressFill').style.width = '100%';
    } else {
        document.getElementById('currentRound').innerText = localRound;
        startNewRound();
    }

    let me = players.find(p => p.id === myId);
    if (me) { me.round = isDone ? 5 : localRound; me.score = localTotalScore; me.done = isDone; }

    if (isHost) {
        if (players.every(p => p.done)) {
            gameState = "finished";
            playSfx('finish');
            stopAllTracks();
        }
        hostBroadcastState();
        updateLiveLeaderboardUI();
        if (gameState === "finished") setTimeout(renderFinalLeaderboard, 1000);
    } else {
        netSend({
            type: 'CLIENT_LIVE_UPDATE', code: roomCode, id: myId,
            round: me ? me.round : localRound,
            score: localTotalScore, done: isDone
        });
        updateLiveLeaderboardUI();
    }
}

function updateLiveLeaderboardUI() {
    const container = document.getElementById('liveLeaderboardContainer');
    container.innerHTML = "";
    let sorted = [...players].sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'lb-entry' + (p.id === myId ? ' me' : '');
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
        div.innerHTML = `<span>${medal} ${p.name.substring(0,10)}</span><span class="lb-score">${p.score}</span>`;
        container.appendChild(div);
    });
}

function renderFinalLeaderboard() {
    stopGlobalTimer();
    showScreen('resultScreen');
    let podium = [...players].sort((a, b) => b.score - a.score);
    const podiumContainer = document.getElementById('kahootPodium');
    podiumContainer.innerHTML = "";

    let p1 = podium[0], p2 = podium[1], p3 = podium[2];
    const mkStep = (p, cls, medal, scoreColor) => p
        ? `<div class="podium-step ${cls}"><div class="podium-name" style="color:${scoreColor || '#fff'}">${medal} ${p.name}</div><div class="podium-meta">${p.score} очок</div><div class="podium-number">${cls === 'first' ? '1' : cls === 'second' ? '2' : '3'}</div></div>`
        : `<div class="podium-step ${cls}" style="opacity:0.1"></div>`;

    podiumContainer.innerHTML =
        mkStep(p2, 'second', '🥈', '#aaa') +
        mkStep(p1, 'first', '👑', 'var(--cyan)') +
        mkStep(p3, 'third', '🥉', '#cd7f32');

    const tbody = document.getElementById('finalLeaderboardBody');
    tbody.innerHTML = "";
    const others = podium.slice(3);
    document.getElementById('otherPlayersSection').style.display = others.length ? 'block' : 'none';
    others.forEach((p, idx) => {
        tbody.innerHTML += `<tr><td>#${idx+4}</td><td>${p.name}</td><td>${p.score} очок</td></tr>`;
    });

    playSfx('finish');
}

// ─── NETWORK MESSAGE HANDLER ───
function handleNetworkMessage(msg) {
    if (msg.code !== roomCode) return;

    if (isHost) {
        if (msg.type === 'CLIENT_REQUEST_JOIN') {
            if (players.length >= 15) {
                return;
            }
            if (!players.find(p => p.id === msg.player.id) && msg.player.id !== myId) {
                players.push(msg.player);
                playSfx('join');
                showToast(`👾 ${msg.player.name} приєднався!`);
            }
            hostBroadcastState();
            updateLobbyUI();
        }
        if (msg.type === 'LEAVE_ROOM') {
            const before = players.length;
            players = players.filter(p => p.id !== msg.id);
            if (players.length < before) {
                showToast(`👋 ${msg.name || 'Гравець'} покинув кімнату`);
                hostBroadcastState();
                updateLobbyUI();
            }
        }
        if (msg.type === 'CLIENT_LIVE_UPDATE') {
            let target = players.find(p => p.id === msg.id);
            if (target) { target.round = msg.round; target.score = msg.score; target.done = msg.done; }
            if (players.every(p => p.done)) {
                gameState = "finished";
                playSfx('finish');
                stopAllTracks();
            }
            hostBroadcastState();
            updateLiveLeaderboardUI();
            if (gameState === "finished") setTimeout(renderFinalLeaderboard, 1000);
        }
    }

    if (msg.type === 'ROOM_STATE_SYNC') {
        if (!isHost) {
            players = msg.players || players;
            gameState = msg.gameState || gameState;
            gameWords = msg.words || [];
            gameMode = msg.gameMode || 'typing';
        }
        updateLobbyUI();
        return;
    }

    if (!isHost && msg.type === 'HOST_ROOM_STATE') {
        players = msg.players;
        gameState = msg.gameState;
        gameWords = msg.words || [];
        gameMode = msg.gameMode || 'typing';

        if (gameState === "lobby") {
            updateLobbyUI();
        } else if (gameState === "playing") {
            if (document.getElementById('playScreen').style.display === 'none') {
                startCountdown(() => startGameSession());
            }
            updateLiveLeaderboardUI();
        } else if (gameState === "finished") {
            if (localTimerInterval) clearInterval(localTimerInterval);
            stopGlobalTimer();
            stopAllTracks();
            setTimeout(renderFinalLeaderboard, 500);
        }
    }
}

