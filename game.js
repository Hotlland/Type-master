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

function connectWS() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
        wsReady = true;
        while (msgQueue.length > 0) {
            ws.send(JSON.stringify(msgQueue.shift()));
        }
    };
    ws.onclose = () => {
        wsReady = false;
        // Reconnect after 2s if we're still in a room
        if (roomCode) {
            setTimeout(connectWS, 2000);
        }
    };
    ws.onerror = () => {
        wsReady = false;
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
        if (!ws || ws.readyState === WebSocket.CLOSED) connectWS();
    }
}

// ─── DICTIONARIES ───
const wordsDictionary = [
    "algorithm","processor","monitor","server","coding","internet","router","keyboard",
    "database","firewall","compiler","function","variable","network","python",
    "javascript","framework","library","terminal","debugger","interface","protocol"
];

const itemsDictionary = [
    {name:"Key",emoji:"🔑"},{name:"Cat",emoji:"🐱"},{name:"Laptop",emoji:"💻"},
    {name:"Coffee",emoji:"☕"},{name:"Pizza",emoji:"🍕"},{name:"Guitar",emoji:"🎸"},
    {name:"Book",emoji:"📚"},{name:"Clock",emoji:"⏰"},{name:"Diamond",emoji:"💎"},
    {name:"Torch",emoji:"🔦"},{name:"Headphones",emoji:"🎧"},{name:"Gamepad",emoji:"🎮"},
    {name:"Apple",emoji:"🍎"},{name:"Cactus",emoji:"🌵"},{name:"Glasses",emoji:"🕶️"},
    {name:"Coin",emoji:"🪙"},{name:"Watermelon",emoji:"🍉"},{name:"Ball",emoji:"⚽"},
    {name:"Parrot",emoji:"🦜"},{name:"Umbrella",emoji:"☂️"},{name:"Crown",emoji:"👑"},
    {name:"Phone",emoji:"📱"},{name:"Magnet",emoji:"🧲"},{name:"Fire",emoji:"🔥"},
    {name:"Hammer",emoji:"🔨"},{name:"Lemon",emoji:"🍋"},{name:"Mushroom",emoji:"🍄"},
    {name:"Star",emoji:"⭐"},{name:"Rocket",emoji:"🚀"},{name:"Ghost",emoji:"👻"}
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
        btn.textContent = '🎵 Music ON';
        btn.classList.remove('muted');
        const activeScreen = ['menuScreen','joinScreen','lobbyScreen','playScreen','resultScreen']
            .find(s => document.getElementById(s).style.display !== 'none');
        if (activeScreen === 'lobbyScreen') playTrack('lobby');
        else if (activeScreen === 'playScreen') playTrack('game');
    } else {
        btn.textContent = '🔇 Music OFF';
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
    myName = input || "Player_" + Math.floor(Math.random() * 900);
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

    // Connect and register as host
    connectWS();
    netSend({
        type: 'CLIENT_REQUEST_JOIN', code: roomCode,
        player: { id: myId, name: myName, isHost: true, round: 1, score: 0, done: false }
    });
};

window.onJoinLobbySubmit = function() {
    initAudio(); setupProfile();
    const inputCode = document.getElementById('roomCodeInput').value.trim();
    if (inputCode.length !== 4) { showToast("❌ Code must be exactly 4 digits!"); return; }
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
        gameMode === 'typing' ? "⌨️ Mode: Type Words" : "🔍 Mode: Find Emojis";
    const container = document.getElementById('playersListContainer');
    container.innerHTML = "";
    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'kahoot-player-card' + (p.id === myId ? ' me' : '');
        el.innerHTML = `👾 ${p.name}${p.id === myId ? ' <b style="font-size:0.8em">(you)</b>' : ''}`;
        container.appendChild(el);
    });
}

window.leaveLobby = function() {
    if (roomCode) {
        netSend({ type: 'LEAVE_ROOM', code: roomCode, id: myId });
    }
    if (ws) { ws.close(); ws = null; wsReady = false; }
    resetToMenu();
};

window.resetToMenu = function() {
    if (localTimerInterval) clearInterval(localTimerInterval);
    stopAllTracks();
    isMusicPlaying = false;
    document.getElementById('bgmBtn').textContent = '🔇 Music OFF';
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
                numEl.textContent = 'GO!';
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
        document.getElementById('wordTarget').innerText = `Find: ${roundData.targetEmoji}`;
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
        ? `<div class="streak-badge">⚡ STREAK x${localStreak} 🔥</div>` : "";

    localRound++;
    const isDone = localRound > 5;

    if (isDone) {
        clearInterval(localTimerInterval);
        document.getElementById('wordTarget').innerText = "⏳ Waiting for others...";
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
    showScreen('resultScreen');
    let podium = [...players].sort((a, b) => b.score - a.score);
    const podiumContainer = document.getElementById('kahootPodium');
    podiumContainer.innerHTML = "";

    let p1 = podium[0], p2 = podium[1], p3 = podium[2];
    const mkStep = (p, cls, medal, scoreColor) => p
        ? `<div class="podium-step ${cls}"><div class="podium-name" style="color:${scoreColor || '#fff'}">${medal} ${p.name}</div><div class="podium-meta">${p.score} pts</div><div class="podium-number">${cls === 'first' ? '1' : cls === 'second' ? '2' : '3'}</div></div>`
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
        tbody.innerHTML += `<tr><td>#${idx+4}</td><td>${p.name}</td><td>${p.score} pts</td></tr>`;
    });

    playSfx('finish');
}

// ─── NETWORK MESSAGE HANDLER ───
function handleNetworkMessage(msg) {
    if (msg.code !== roomCode) return;

    if (isHost) {
        if (msg.type === 'CLIENT_REQUEST_JOIN') {
            if (!players.find(p => p.id === msg.player.id) && msg.player.id !== myId) {
                players.push(msg.player);
                playSfx('join');
                showToast(`👾 ${msg.player.name} joined!`);
            }
            hostBroadcastState();
            updateLobbyUI();
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

    // ROOM_STATE_SYNC is the server's reply to a join — update lobby for everyone
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
            stopAllTracks();
            setTimeout(renderFinalLeaderboard, 500);
        }
    }
}

// Initialize WS connection on page load
connectWS();
