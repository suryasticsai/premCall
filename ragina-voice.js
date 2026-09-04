/**
 * RAGina Voice – Full Application with VAD + Barge‑In
 * Version 2.4.0 – Continuous VAD, abortable TTS/LLM, zero‑beep listening
 * 
 * Self‑contained. Requires VAD library loaded via CDN or local file:
 *   <script src="vad-web.js"></script>
 *   <script src="ragina-voice.js"></script>
 */
(function() {
    'use strict';

    // ─── HARDCODED DEFAULTS (can be overridden via window.RAGINA_CONFIG) ──
    const DEFAULT_BASE_URL = 'https://sensycilva.suryasticsai.workers.dev';
    const DEFAULT_INDEX_URL = 'https://cdn.jsdelivr.net/gh/suryasticsai/RAGina@main/demo-index.json';
    const DEFAULT_VOICE_ID = 'rachel';
    const DEFAULT_VOICE_SPEED = 1.0;
    const FALLBACK_AI_ENDPOINT = 'https://ragina-crawler-ragina.vercel.app/api/ask';

    // ─── READ CONFIG ──────────────────────────────────────────────────────
    const CONFIG = window.RAGINA_CONFIG || {};
    const BASE_URL = CONFIG.apiBaseUrl || DEFAULT_BASE_URL;
    const INDEX_URL = CONFIG.indexUrl || DEFAULT_INDEX_URL;
    const VOICE_ID = CONFIG.voiceId || DEFAULT_VOICE_ID;
    const VOICE_SPEED = CONFIG.voiceSpeed || DEFAULT_VOICE_SPEED;

    const AI_ENDPOINT = BASE_URL + '/api/ask';
    const YT_SEARCH_URL = BASE_URL + '/api/youtube/search?q=';
    const VOICE_URL = BASE_URL + '/api/tts';

    // ─── VAD CONFIG ──────────────────────────────────────────────────────
    const VAD_CONFIG = {
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        redemptionFrames: 8,
        preSpeechPadFrames: 10,
        minSpeechFrames: 20,
        onSpeechStart: () => handleBargeIn(),
        onSpeechEnd: (audioBuffer) => handleSpeechEnd(audioBuffer),
    };

    // ─── STYLES ──────────────────────────────────────────────────────────
    const styles = `
        /* ─── Reset & Base ─── */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: radial-gradient(circle at 30% 20%, #1a1a2e, #0f0f1a 70%);
            min-height: 100vh;
            color: #f0f0f0;
            padding: 20px;
        }

        /* ─── Test content (optional) ─── */
        .ragina-test-content {
            max-width: 800px;
            margin: 20px auto;
            padding: 30px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 16px;
            border: 1px solid rgba(108, 99, 255, 0.15);
            color: #c0c0e0;
            line-height: 1.8;
            font-size: 16px;
            user-select: text;
        }
        .ragina-test-content h1 {
            color: #6C63FF;
            font-weight: 300;
            font-size: 28px;
            margin-bottom: 12px;
        }
        .ragina-test-content h1 span {
            background: linear-gradient(90deg, #6C63FF, #FF6584);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .ragina-test-content .highlight {
            background: rgba(108, 99, 255, 0.15);
            padding: 2px 6px;
            border-radius: 4px;
            border-left: 3px solid #6C63FF;
        }
        .ragina-test-content .instruction {
            background: rgba(255, 101, 132, 0.1);
            border-left: 3px solid #FF6584;
            padding: 12px 16px;
            border-radius: 6px;
            margin: 16px 0;
        }
        .ragina-test-content p {
            margin-bottom: 14px;
        }

        /* ─── RAGina App ─── */
        .ragina-app {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 380px;
            max-width: 95vw;
            z-index: 99999;
            transition: none;
        }
        .ragina-app.minimized {
            width: 70px;
            height: 70px;
        }
        .ragina-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(20, 20, 38, 0.96);
            border: 1px solid rgba(108, 99, 255, 0.35);
            border-radius: 20px 20px 0 0;
            padding: 10px 16px;
            cursor: move;
            flex-shrink: 0;
            backdrop-filter: blur(12px);
            user-select: none;
        }
        .ragina-app.minimized .ragina-header {
            border-radius: 50%;
            padding: 0;
            width: 70px;
            height: 70px;
            justify-content: center;
            border-bottom: 1px solid rgba(108, 99, 255, 0.35);
        }
        .ragina-header .logo {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: url('https://ragina-crawler-ragina.vercel.app/ragina-logo.png') center/cover;
            border: 2px solid #6C63FF;
            flex-shrink: 0;
            cursor: pointer;
        }
        .ragina-app.minimized .ragina-header .logo {
            width: 56px;
            height: 56px;
            margin: 0;
        }
        .ragina-header .title-area {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            margin: 0 10px;
            overflow: hidden;
        }
        .ragina-app.minimized .title-area {
            display: none;
        }
        .ragina-header .title {
            font-weight: 700;
            font-size: 16px;
            background: linear-gradient(90deg, #6C63FF, #FF6584);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            white-space: nowrap;
        }
        .ragina-header .live-transcript {
            font-size: 13px;
            color: #d0d0f0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
        }
        .ragina-header .live-transcript.interim {
            color: #b0b0e0;
            font-style: italic;
        }
        .ragina-header .actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .ragina-app.minimized .actions {
            display: none;
        }
        .ragina-header .btn-icon {
            background: none;
            border: none;
            color: #ccc;
            cursor: pointer;
            padding: 4px;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
        }
        .ragina-header .btn-icon:hover {
            color: #fff;
        }
        .ragina-header .btn-icon.voice-off {
            color: #FF6584;
        }
        .ragina-header .btn-icon svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        .ragina-body {
            background: rgba(15, 15, 30, 0.97);
            border: 1px solid rgba(108, 99, 255, 0.3);
            border-top: none;
            border-radius: 0 0 20px 20px;
            display: flex;
            flex-direction: column;
            height: 440px;
            overflow: hidden;
        }
        .ragina-app.minimized .ragina-body {
            display: none;
        }
        .chat-toolbar {
            display: flex;
            gap: 8px;
            padding: 6px 14px;
            background: rgba(0, 0, 0, 0.25);
            border-bottom: 1px solid rgba(108, 99, 255, 0.15);
            flex-wrap: wrap;
            align-items: center;
        }
        .chat-toolbar button {
            background: rgba(108, 99, 255, 0.2);
            border: none;
            color: #ccc;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: 0.2s;
            font-family: inherit;
        }
        .chat-toolbar button:hover {
            background: rgba(108, 99, 255, 0.4);
            color: #fff;
        }
        .chat-toolbar .status {
            flex: 1;
            text-align: right;
            font-size: 11px;
            color: #666;
        }
        .ragina-messages {
            flex: 1;
            overflow-y: auto;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .msg {
            max-width: 85%;
            padding: 9px 13px;
            border-radius: 14px;
            font-size: 14px;
            line-height: 1.5;
            word-break: break-word;
        }
        .msg.user {
            align-self: flex-end;
            background: #6C63FF;
            color: #fff;
            border-bottom-right-radius: 4px;
        }
        .msg.bot {
            align-self: flex-start;
            background: rgba(108, 99, 255, 0.18);
            color: #f0f0ff;
            border-bottom-left-radius: 4px;
            border: 1px solid rgba(108, 99, 255, 0.25);
        }
        .msg.system {
            align-self: center;
            background: transparent;
            color: #9e9ec0;
            font-size: 12px;
            font-style: italic;
        }
        .typing-dots {
            align-self: flex-start;
            display: flex;
            gap: 4px;
            padding: 10px 13px;
            background: rgba(108, 99, 255, 0.12);
            border-radius: 14px;
            border-bottom-left-radius: 4px;
        }
        .typing-dots span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #8b83ff;
            animation: blink 1.2s infinite;
        }
        .typing-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }
        .typing-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }
        @keyframes blink {
            0%,
            80%,
            100% {
                opacity: 0.25;
            }
            40% {
                opacity: 1;
            }
        }
        .music-controller {
            display: flex;
            flex-direction: column;
            gap: 4px;
            background: rgba(108, 99, 255, 0.15);
            border: 1px solid rgba(108, 99, 255, 0.35);
            border-radius: 12px;
            padding: 8px 10px;
            margin: 0 14px 8px;
        }
        .music-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .music-controller .song-label {
            flex: 1;
            font-size: 11px;
            color: #ccc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .music-controller button {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #fff;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .music-controller button:hover {
            background: rgba(255, 255, 255, 0.25);
        }
        .music-controller button svg {
            width: 14px;
            height: 14px;
            fill: currentColor;
        }
        .progress-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .progress-bar {
            flex: 1;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
            cursor: pointer;
        }
        .progress-fill {
            height: 100%;
            width: 0%;
            background: #6C63FF;
            border-radius: 2px;
            transition: width 0.1s linear;
        }
        .time-label {
            font-size: 10px;
            color: #888;
            min-width: 32px;
            text-align: center;
        }
        .ragina-input-row {
            display: flex;
            gap: 8px;
            padding: 10px;
            border-top: 1px solid rgba(108, 99, 255, 0.25);
            align-items: center;
        }
        .ragina-input-row input {
            flex: 1;
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(108, 99, 255, 0.3);
            border-radius: 10px;
            padding: 9px 12px;
            color: #f0f0f0;
            font-size: 13.5px;
            outline: none;
        }
        .ragina-input-row input:focus {
            border-color: #6C63FF;
        }
        .mic-orb {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: transparent;
            border: 2px solid rgba(108, 99, 255, 0.45);
            color: #b0a0ff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
            transition: all 0.2s;
        }
        .mic-orb svg {
            width: 20px;
            height: 20px;
            fill: currentColor;
        }
        .mic-orb.listening {
            background: #00d68f;
            border-color: #00d68f;
            color: #fff;
            animation: pulse-mic 1s infinite;
        }
        @keyframes pulse-mic {
            0%,
            100% {
                box-shadow: 0 0 0 0 rgba(0, 214, 143, 0.4);
            }
            50% {
                box-shadow: 0 0 0 14px rgba(0, 214, 143, 0);
            }
        }
        .send-btn {
            background: #6C63FF;
            border: none;
            border-radius: 10px;
            color: #fff;
            padding: 0 16px;
            cursor: pointer;
            font-weight: 600;
            height: 38px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13.5px;
        }
        .send-btn:hover {
            background: #5a52d5;
        }
        .send-btn svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        #youtubePlayerContainer {
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 1px;
            height: 1px;
            opacity: 0;
            pointer-events: none;
        }
        #fileInput {
            display: none;
        }
        @media (max-width: 480px) {
            .ragina-app {
                right: 8px;
                left: 8px;
                bottom: 16px;
                width: auto;
            }
            .ragina-app.minimized {
                left: auto;
                width: 70px;
            }
            .ragina-body {
                height: 360px;
            }
            .ragina-test-content {
                padding: 16px;
                margin: 10px;
            }
            .chat-toolbar {
                padding: 4px 10px;
                gap: 4px;
            }
            .chat-toolbar button {
                font-size: 10px;
                padding: 2px 6px;
            }
        }
        .ragina-bubble,
        .ragina-panel {
            display: none !important;
        }
    `;

    // ─── HTML STRUCTURE ──────────────────────────────────────────────────
    const appHTML = `
        <div class="ragina-app minimized" id="raginaApp">
            <div class="ragina-header" id="raginaHeader">
                <div class="logo" id="raginaLogo"></div>
                <div class="title-area">
                    <span class="title">RAGina</span>
                    <span class="live-transcript" id="liveTranscript"></span>
                </div>
                <div class="actions">
                    <button class="btn-icon" id="voiceToggleBtn" title="Toggle voice">
                        <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    </button>
                    <button class="btn-icon" id="minimizeBtn" title="Minimize">
                        <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
                    </button>
                    <button class="btn-icon" id="closeBtn" title="Close (minimize)">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
            </div>
            <div class="ragina-body" id="raginaBody">
                <div class="chat-toolbar">
                    <button id="saveChatBtn">💾 Save Chat</button>
                    <button id="loadChatBtn">📂 Load Chat</button>
                    <button id="clearChatBtn">🗑️ Clear Chat</button>
                    <span class="status" id="chatStatus">Auto‑saved</span>
                </div>
                <input type="file" id="fileInput" accept=".json" />
                <div class="ragina-messages" id="raginaMessages"></div>
                <div class="music-controller" id="musicController" style="display:none;">
                    <div class="music-row">
                        <span class="song-label" id="songLabel">🎵</span>
                        <button id="btnPrev" title="Previous">
                            <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button id="btnPlayPause" title="Play/Pause">
                            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button id="btnStop" title="Stop">
                            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                        </button>
                        <button id="btnNext" title="Next">
                            <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                        </button>
                    </div>
                    <div class="progress-row">
                        <span class="time-label" id="timeCurrent">0:00</span>
                        <div class="progress-bar" id="progressBar"><div class="progress-fill" id="progressFill"></div></div>
                        <span class="time-label" id="timeDuration">0:00</span>
                    </div>
                </div>
                <div class="ragina-input-row">
                    <button class="mic-orb" id="micOrb" title="Click to speak">
                        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 3.91c-2.84-.48-5-2.94-5-5.91h-2c0 3.83 2.82 6.93 6.5 7.48V21h3v-3.52c3.68-.55 6.5-3.65 6.5-7.48h-2c0 2.97-2.16 5.43-5 5.91z"/></svg>
                    </button>
                    <input type="text" id="chatInput" placeholder="Type or speak…" autocomplete="off">
                    <button class="send-btn" id="sendBtn">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        Send
                    </button>
                </div>
            </div>
        </div>
        <div id="youtubePlayerContainer"></div>
    `;

    // ─── INJECT ──────────────────────────────────────────────────────────
    function injectApp() {
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);

        const container = document.createElement('div');
        container.innerHTML = appHTML;
        while (container.firstChild) {
            document.body.appendChild(container.firstChild);
        }
    }

    // ─── APP LOGIC ────────────────────────────────────────────────────────
    function initApp() {
        // DOM refs
        const app = document.getElementById('raginaApp');
        const header = document.getElementById('raginaHeader');
        const logo = document.getElementById('raginaLogo');
        const liveTranscript = document.getElementById('liveTranscript');
        const messages = document.getElementById('raginaMessages');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const micOrb = document.getElementById('micOrb');
        const voiceToggleBtn = document.getElementById('voiceToggleBtn');
        const minimizeBtn = document.getElementById('minimizeBtn');
        const closeBtn = document.getElementById('closeBtn');
        const musicController = document.getElementById('musicController');
        const songLabel = document.getElementById('songLabel');
        const btnPlayPause = document.getElementById('btnPlayPause');
        const btnStop = document.getElementById('btnStop');
        const progressFill = document.getElementById('progressFill');
        const timeCurrent = document.getElementById('timeCurrent');
        const timeDuration = document.getElementById('timeDuration');
        const progressBar = document.getElementById('progressBar');
        const chatStatus = document.getElementById('chatStatus');
        const saveChatBtn = document.getElementById('saveChatBtn');
        const loadChatBtn = document.getElementById('loadChatBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const fileInput = document.getElementById('fileInput');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        // ─── State ──────────────────────────────────────────────────────
        let engine = null;
        let voiceActive = true;
        let currentAudio = null;
        let conversationActive = false;
        let recognition = null;
        let userName = null;
        let awaitingName = false;
        let history = [];
        let isMinimized = true;
        let musicPlaying = false;
        let currentVideoId = null;
        let currentSongTitle = '';
        let musicProgressInterval = null;
        let musicDuration = 0;
        let musicCurrentTime = 0;
        let wasPlayingBeforeMic = false;
        let ttsLoading = false;
        let youtubePlayer = null;
        let playerReady = false;
        let playerReadyResolve = null;
        const playerReadyPromise = new Promise(resolve => { playerReadyResolve = resolve; });
        let messageHistory = [];
        let introDone = false;

        // ─── VAD State ──────────────────────────────────────────────────
        let vad = null;
        let audioContext = null;
        let micStream = null;
        let isSpeaking = false;
        let silenceTimer = null;
        let ttsAbortController = null;
        let llmAbortController = null;

        // ─── IndexedDB ──────────────────────────────────────────────────
        const DB_NAME = 'RAGinaChatDB';
        const STORE_NAME = 'chatHistory';
        const DB_VERSION = 1;

        function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async function saveToIndexedDB(data) {
            try {
                const db = await openDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ id: 'history', data });
                await tx.done;
                chatStatus.textContent = 'Auto‑saved ✓';
                chatStatus.style.color = '#6C63FF';
            } catch (e) {
                console.warn('IndexedDB save error:', e);
                chatStatus.textContent = 'Save failed';
                chatStatus.style.color = '#FF6584';
            }
        }

        async function loadFromIndexedDB() {
            try {
                const db = await openDB();
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get('history');
                return new Promise((resolve) => {
                    request.onsuccess = () => resolve(request.result ? request.result.data : null);
                    request.onerror = () => resolve(null);
                });
            } catch (e) {
                return null;
            }
        }

        async function clearIndexedDB() {
            try {
                const db = await openDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete('history');
                await tx.done;
            } catch (e) {}
        }

        // ─── Render messages ──────────────────────────────────────────
        function renderMessages(msgs) {
            messages.innerHTML = '';
            msgs.forEach(msg => {
                const div = document.createElement('div');
                div.className = 'msg ' + (msg.role || 'system');
                div.innerHTML = msg.text || msg.html || '';
                messages.appendChild(div);
            });
            messages.scrollTop = messages.scrollHeight;
        }

        function addMessage(role, text, extraHtml = '') {
            const fullText = text + extraHtml;
            const entry = { role, text: fullText };
            messageHistory.push(entry);
            const div = document.createElement('div');
            div.className = 'msg ' + role;
            div.innerHTML = fullText;
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
            saveToIndexedDB(messageHistory);
            return div;
        }

        async function restoreChat() {
            const saved = await loadFromIndexedDB();
            if (saved && saved.length > 0) {
                messageHistory = saved;
                renderMessages(saved);
                const nameMsg = saved.find(m => m.role === 'system' && m.text.includes('Welcome back'));
                if (nameMsg) {
                    const match = nameMsg.text.match(/Welcome back, ([^!]+)/);
                    if (match) userName = match[1];
                }
                introDone = true;
                conversationActive = true;
                if (userName) {
                    try { localStorage.setItem('ragina_user_name', userName); } catch(e) {}
                }
                chatStatus.textContent = `Loaded ${saved.length} messages`;
                chatStatus.style.color = '#6C63FF';
                return true;
            }
            return false;
        }

        // ─── YouTube Player ────────────────────────────────────────────
        function initYouTubePlayer() {
            if (window.YT && window.YT.Player) {
                if (youtubePlayer) return;
                youtubePlayer = new YT.Player('youtubePlayerContainer', {
                    height: '0',
                    width: '0',
                    videoId: '',
                    playerVars: {
                        autoplay: 0,
                        controls: 0,
                        modestbranding: 1,
                        rel: 0,
                        showinfo: 0,
                        iv_load_policy: 3
                    },
                    events: {
                        onReady: onPlayerReady,
                        onStateChange: onPlayerStateChange,
                        onError: onPlayerError
                    }
                });
            } else {
                setTimeout(initYouTubePlayer, 500);
            }
        }

        function onPlayerReady(event) {
            youtubePlayer = event.target;
            playerReady = true;
            if (playerReadyResolve) playerReadyResolve();
            if (currentVideoId) {
                try {
                    youtubePlayer.loadVideoById(currentVideoId);
                    if (musicPlaying) {
                        youtubePlayer.playVideo();
                    }
                } catch (e) {
                    console.warn('Failed to load pending video:', e);
                }
            }
        }

        function onPlayerStateChange(event) {
            const state = event.data;
            if (state === YT.PlayerState.PLAYING) {
                musicPlaying = true;
                updatePlayPauseBtn(true);
                if (!musicProgressInterval) {
                    musicProgressInterval = setInterval(updateProgressFromPlayer, 500);
                }
            } else if (state === YT.PlayerState.PAUSED) {
                musicPlaying = false;
                updatePlayPauseBtn(false);
            } else if (state === YT.PlayerState.ENDED) {
                stopSong();
                addMessage('bot', 'Song finished!');
                if (voiceActive && conversationActive && !currentAudio && !ttsLoading) {
                    setTimeout(startListening, 500);
                }
            }
        }

        function onPlayerError(event) {
            console.warn('YouTube player error:', event.data);
            addMessage('bot', 'Sorry, there was an error playing that song.');
        }

        function updateProgressFromPlayer() {
            if (!youtubePlayer || !playerReady) return;
            try {
                const current = youtubePlayer.getCurrentTime();
                const duration = youtubePlayer.getDuration();
                if (duration && duration > 0) {
                    musicDuration = duration;
                    musicCurrentTime = current;
                    updateProgressUI();
                }
            } catch (e) {}
        }

        // ─── loadVideo with robust waiting ────────────────────────────
        async function loadVideo(videoId, title) {
            if (!playerReady) {
                console.log('⏳ Waiting for YouTube player...');
                await playerReadyPromise;
                console.log('✅ YouTube player ready.');
            }
            if (!youtubePlayer || typeof youtubePlayer.loadVideoById !== 'function') {
                console.warn('⚠️ YouTube player not fully initialized. Re-initializing...');
                playerReady = false;
                initYouTubePlayer();
                await playerReadyPromise;
                if (!youtubePlayer || typeof youtubePlayer.loadVideoById !== 'function') {
                    addMessage('bot', 'Sorry, the music player is not available. Please try again.');
                    return;
                }
            }
            currentVideoId = videoId;
            currentSongTitle = title;
            try {
                youtubePlayer.loadVideoById(videoId);
                youtubePlayer.playVideo();
                musicPlaying = true;
                musicDuration = 0;
                musicCurrentTime = 0;
                updatePlayPauseBtn(true);
                showMusicController();
                songLabel.textContent = '🎵 ' + title;
                updateProgressUI();
                if (musicProgressInterval) clearInterval(musicProgressInterval);
                musicProgressInterval = setInterval(updateProgressFromPlayer, 500);
            } catch (err) {
                console.error('loadVideo error:', err);
                addMessage('bot', 'Sorry, I couldn\'t play that song.');
            }
        }

        // ─── Other music functions ──────────────────────────────────────
        function pauseSong() {
            if (youtubePlayer && playerReady) {
                youtubePlayer.pauseVideo();
            }
            musicPlaying = false;
            updatePlayPauseBtn(false);
        }

        function resumeSong() {
            if (youtubePlayer && playerReady) {
                youtubePlayer.playVideo();
            }
            musicPlaying = true;
            updatePlayPauseBtn(true);
        }

        function stopSong() {
            if (youtubePlayer && playerReady) {
                youtubePlayer.stopVideo();
            }
            musicPlaying = false;
            currentVideoId = null;
            currentSongTitle = '';
            updatePlayPauseBtn(false);
            hideMusicController();
            if (musicProgressInterval) {
                clearInterval(musicProgressInterval);
                musicProgressInterval = null;
            }
            musicCurrentTime = 0;
            musicDuration = 0;
            updateProgressUI();
        }

        function showMusicController() { musicController.style.display = 'flex'; }
        function hideMusicController() { musicController.style.display = 'none'; }

        function updatePlayPauseBtn(playing) {
            if (playing) {
                btnPlayPause.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            } else {
                btnPlayPause.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            }
        }

        function formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        function updateProgressUI() {
            const pct = (musicDuration > 0) ? (musicCurrentTime / musicDuration) * 100 : 0;
            progressFill.style.width = pct + '%';
            timeCurrent.textContent = formatTime(musicCurrentTime);
            timeDuration.textContent = formatTime(musicDuration);
        }

        // ─── Music command execution ──────────────────────────────────
        function executeMusicAction(action, song) {
            switch (action) {
                case 'play':
                    if (song) {
                        searchAndPlay(song);
                    } else {
                        addMessage('bot', "What song would you like to play?");
                    }
                    break;
                case 'pause':
                    if (musicPlaying) {
                        pauseSong();
                        addMessage('bot', '⏸️ Music paused.');
                    } else {
                        addMessage('bot', 'No song is playing right now.');
                    }
                    break;
                case 'resume':
                    if (currentVideoId && !musicPlaying) {
                        resumeSong();
                        addMessage('bot', '▶️ Resuming music.');
                    } else if (musicPlaying) {
                        addMessage('bot', 'Music is already playing.');
                    } else {
                        addMessage('bot', 'No song is paused or stopped.');
                    }
                    break;
                case 'stop':
                    stopSong();
                    addMessage('bot', '⏹️ Music stopped.');
                    break;
                case 'change':
                    if (currentVideoId) {
                        stopSong();
                        addMessage('bot', "⏭️ Song changed. What would you like to hear next?");
                    } else {
                        addMessage('bot', "No song is currently playing. Just tell me what you'd like to hear!");
                    }
                    break;
                default:
                    return false;
            }
            return true;
        }

        // ─── Fast music command matching ──────────────────────────────
        function handleMusicCommandFast(text) {
            const lower = text.toLowerCase().trim();

            if (/\b(?:not\s+this|some\s+other|different)\s+(?:song|music|track)\b/i.test(lower) ||
                /\b(?:change|skip|next)\s+(?:this|the)?\s*(?:song|music|track)\b/i.test(lower) ||
                lower === 'skip' || lower === 'next' || lower === 'change') {
                executeMusicAction('change');
                return true;
            }

            let playMatch = lower.match(/^(?:play|play me|can you play|put on)\s+(.+)/i);
            if (playMatch) {
                const query = playMatch[1].trim();
                const fillerWords = ['not this', 'some other', 'different', 'another', 'something else'];
                if (query.length <= 2 || fillerWords.some(w => query.includes(w))) {
                    executeMusicAction('change');
                    return true;
                }
                searchAndPlay(query);
                return true;
            }

            let songMatch = lower.match(/^(.+)\s+(?:song|music|track)$/i);
            if (songMatch) {
                const query = songMatch[1].trim();
                const fillerWords = ['not this', 'some other', 'different', 'another', 'something else'];
                if (query.length <= 2 || fillerWords.some(w => query.includes(w))) {
                    executeMusicAction('change');
                    return true;
                }
                searchAndPlay(query);
                return true;
            }

            if (/\b(?:pause|hold)\s+(?:the\s+)?(?:song|music|track)\b/i.test(lower) || lower === 'pause') {
                executeMusicAction('pause');
                return true;
            }
            if (/\b(?:resume|continue|unpause)\s+(?:the\s+)?(?:song|music|track)\b/i.test(lower) || lower === 'resume') {
                executeMusicAction('resume');
                return true;
            }
            if (/\b(?:stop|end|finish)\s+(?:the\s+)?(?:song|music|track)\b/i.test(lower) || lower === 'stop') {
                executeMusicAction('stop');
                return true;
            }

            return false;
        }

        // ─── AI‑based music command parser ────────────────────────────
        async function parseMusicCommandWithAI(text) {
            const prompt = `You are a music command parser. Given the user's message, determine if they want to control music playback. If yes, respond with a JSON object containing "action" and optionally "song". Actions: "play", "pause", "resume", "stop", "change". If not a music command, respond with {"action": "none"}.

            Important: Only set action to "play" if the user specifically asks for a song by name or artist. If they say things like "not this song", "some other song", "different song", "change", "skip", "next", then action should be "change". If they are just chatting, action should be "none".

            User: "${text}"
            Response:`;

            try {
                const res = await fetch(AI_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });
                if (!res.ok) throw new Error(`AI ${res.status}`);
                const data = await res.json();
                const jsonMatch = data.text.match(/\{.*\}/s);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.action === 'play') {
                        const song = (parsed.song || '').trim();
                        const filler = ['not this', 'some other', 'different', 'another', 'something else', 'change', 'skip'];
                        if (!song || song.length <= 2 || filler.some(w => song.toLowerCase().includes(w))) {
                            return { action: 'change' };
                        }
                    }
                    return parsed;
                }
                return { action: 'none' };
            } catch (e) {
                return { action: 'none' };
            }
        }

        // ─── Improved getSelectedText ──────────────────────────────────
        function getSelectedText() {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) return '';
            const text = sel.toString().trim();
            console.log('📌 Selected text:', text);
            return text;
        }

        // ─── AI call with retry, fallback, and abort signal ────────────
        async function callAI(prompt, signal) {
            let attempts = 0;
            const maxAttempts = 2;
            let lastError = null;

            while (attempts < maxAttempts) {
                attempts++;
                try {
                    const res = await fetch(AI_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt }),
                        signal: signal, // pass abort signal
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    if (data.error || !data.text?.trim()) throw new Error(data.error || 'Empty response');
                    return data.text.trim();
                } catch (err) {
                    if (err.name === 'AbortError') throw err; // propagate abort
                    lastError = err;
                    console.warn(`AI attempt ${attempts} failed:`, err.message);
                    if (attempts === 1 && FALLBACK_AI_ENDPOINT && FALLBACK_AI_ENDPOINT !== AI_ENDPOINT) {
                        try {
                            const res = await fetch(FALLBACK_AI_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt }),
                                signal: signal,
                            });
                            if (res.ok) {
                                const data = await res.json();
                                if (data.text?.trim()) return data.text.trim();
                            }
                        } catch (e) {}
                    }
                    if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 2000));
                }
            }
            throw lastError || new Error('All AI attempts failed.');
        }

        // ─── Modified getAIAnswer to use abort signal ──────────────
        async function getAIAnswer(question, selectedText, signal) {
            let context = '';
            if (selectedText) {
                context = `The user has selected the following text on the page: "${selectedText}".\n\n`;
            }
            if (engine && typeof engine.retrieve === 'function') {
                try {
                    const chunks = engine.retrieve(question, 5) || [];
                    const ragContext = chunks.map((c, i) => `[${i+1}] ${c.text}`).join('\n\n');
                    if (ragContext) {
                        context += 'Relevant context from knowledge base:\n' + ragContext + '\n\n';
                    }
                } catch (e) {}
            }
            const recentHistory = history.slice(-8)
                .map(h => `${h.role === 'user' ? (userName || 'User') : 'RAGina'}: ${h.text}`)
                .join('\n');
            const prompt =
                `You are RAGina — witty, warm, sharp-tongued AI with access to YouTube music. Talk like a real friend. You can play songs. If the user asks for music, say you'll play it. Only use context below if relevant. You're talking to ${userName || 'someone new'}.

${context ? 'User provided selected text context:\n' + context : ''}

Recent:
${recentHistory}

${userName || 'User'}: ${question}
RAGina:`;

            return await callAI(prompt, signal);
        }

        // ─── searchAndPlay with better error handling ──────────────────
        async function searchAndPlay(query) {
            if (!query || query.length < 2) {
                addMessage('bot', "Could you be more specific? What song would you like?");
                return;
            }
            try {
                const url = YT_SEARCH_URL + encodeURIComponent(query);
                console.log('🔍 Searching for:', url);
                const res = await fetch(url);
                console.log('📡 Response status:', res.status);
                if (!res.ok) {
                    throw new Error(`Worker returned ${res.status}`);
                }
                const data = await res.json();
                console.log('📦 Data received:', data);
                if (!data.success || !data.items || data.items.length === 0) {
                    addMessage('bot', `Couldn't find "${query}" through the API.`);
                    const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                    addMessage('bot', `Open this link to play: <a href="${fallbackUrl}" target="_blank">${query} on YouTube</a>`);
                    return;
                }
                const song = data.items[0];
                await loadVideo(song.id, song.title);
                addMessage('bot', `🎵 Playing: <strong>${escapeHTML(song.title)}</strong>`);
                if (voiceActive && !musicPlaying) await speakText(`Playing ${song.title}.`);
            } catch (err) {
                console.error('❌ Search error:', err);
                addMessage('bot', `Oops, I couldn't play that right now. Error: ${err.message || 'unknown'}`);
            }
        }

        function escapeHTML(str) { const d = document.createElement('div');
            d.textContent = str; return d.innerHTML; }

        // ─── Button controls (music) ──────────────────────────────────
        btnPlayPause.addEventListener('click', () => {
            if (musicPlaying) {
                pauseSong();
                addMessage('bot', '⏸️ Paused.');
            } else if (currentVideoId) {
                resumeSong();
                addMessage('bot', '▶️ Resumed.');
            } else {
                addMessage('bot', 'No song loaded. Tell me what to play!');
            }
        });

        btnStop.addEventListener('click', () => {
            stopSong();
            addMessage('bot', '⏹️ Stopped.');
        });

        progressBar.addEventListener('click', (e) => {
            if (!youtubePlayer || !playerReady || !currentVideoId) return;
            const rect = progressBar.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const duration = youtubePlayer.getDuration();
            if (duration && duration > 0) {
                const seekTo = x * duration;
                youtubePlayer.seekTo(seekTo, true);
                updateProgressFromPlayer();
            }
        });

        // ─── Drag / Click ──────────────────────────────────────────────
        let dragActive = false;
        let dragStartX = 0, dragStartY = 0;
        let pointerDownX = 0, pointerDownY = 0;
        let startLeft = 0, startTop = 0;
        let isClick = false;

        function onPointerDown(e) {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.btn-icon')) {
                return;
            }
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            pointerDownX = clientX;
            pointerDownY = clientY;
            dragStartX = clientX;
            dragStartY = clientY;
            dragActive = true;
            isClick = true;
            const rect = app.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            app.style.transition = 'none';
            e.preventDefault();
        }

        function onPointerMove(e) {
            if (!dragActive) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            const dx = clientX - dragStartX;
            const dy = clientY - dragStartY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isClick = false;
            }
            app.style.left = (startLeft + dx) + 'px';
            app.style.top = (startTop + dy) + 'px';
            app.style.right = 'auto';
            app.style.bottom = 'auto';
        }

        function onPointerUp(e) {
            if (!dragActive) return;
            dragActive = false;
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.btn-icon')) {
                return;
            }
            const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            const dx = clientX - pointerDownX;
            const dy = clientY - pointerDownY;
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && isClick) {
                handleClick(e);
            }
            isClick = false;
        }

        function handleClick(e) {
            if (isMinimized) {
                setMinimized(false);
                if (!introDone) introduce();
            } else {
                const target = e.target;
                if (target.closest && target.closest('.logo')) {
                    if (!introDone) introduce();
                    e.stopPropagation();
                }
            }
        }

        header.addEventListener('mousedown', onPointerDown);
        header.addEventListener('touchstart', onPointerDown, { passive: false });
        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('mouseup', onPointerUp);
        document.addEventListener('touchend', onPointerUp);

        logo.addEventListener('click', (e) => {
            if (isMinimized) {
                setMinimized(false);
                if (!introDone) introduce();
            } else if (!introDone) {
                introduce();
            }
            e.stopPropagation();
        });

        // ─── Minimize / Close ──────────────────────────────────────────
        function setMinimized(min) {
            isMinimized = min;
            app.classList.toggle('minimized', min);
            if (min) {
                minimizeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>`;
                // Stop VAD when minimized
                stopVAD();
            } else {
                minimizeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>`;
                // Start VAD if voice is active and conversation is active
                if (voiceActive && conversationActive) startVAD();
                if (!musicPlaying) chatInput.focus();
            }
        }

        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setMinimized(!isMinimized);
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setMinimized(true);
        });

        // ─── Intro & name ──────────────────────────────────────────────
        async function introduce() {
            if (introDone) return;
            introDone = true;
            const introText = "Hey there! I'm RAGina, your personal mentalist. I can chat, answer questions, and even play music. What's your name?";
            addMessage('bot', introText);
            awaitingName = true;
            conversationActive = true;
            if (voiceActive) {
                await speakText(introText);
                // After greeting, start VAD (if not minimized)
                if (!isMinimized) startVAD();
            }
        }

        // ─── AI helpers ────────────────────────────────────────────────
        function waitForEngine(timeoutMs) {
            return new Promise(resolve => {
                const start = Date.now();
                (function poll() {
                    if (window.RAGina && window.RAGina.getEngine) {
                        try { resolve(window.RAGina.getEngine()); return; } catch (e) {}
                    }
                    if (Date.now() - start > timeoutMs) { resolve(null); return; }
                    setTimeout(poll, 200);
                })();
            });
        }

        async function loadName() { try { return localStorage.getItem('ragina_user_name'); } catch (e) { return null; } }
        async function saveName(name) { try { localStorage.setItem('ragina_user_name', name); } catch (e) {} }

        function extractName(raw) {
            const text = raw.trim();
            const m = text.match(/(?:my name is|i am|i'm|im|call me|it's|its)\s+([a-z][a-z '-]{0,24})/i);
            const word = m && m[1] ? m[1].trim().split(/\s+/)[0] : (text.split(/\s+/)[0] || text);
            const clean = word.replace(/[^a-zA-Z'-]/g, '');
            return clean ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : 'friend';
        }

        // ─── Core sendMessage ──────────────────────────────────────────
        async function sendMessage(rawText) {
            const text = (rawText || '').trim();
            if (!text) return;
            chatInput.value = '';

            const selected = getSelectedText();

            if (awaitingName) {
                awaitingName = false;
                userName = extractName(text);
                await saveName(userName);
                addMessage('user', text);
                const greet = `Nice to meet you, ${userName}! What can I help you with today?`;
                history.push({ role: 'user', text }, { role: 'bot', text: greet });
                addMessage('bot', greet);
                if (voiceActive) await speakText(greet);
                if (!musicPlaying && !currentAudio && !ttsLoading) {
                    setTimeout(startListening, 500);
                }
                return;
            }

            if (selected) {
                addMessage('system', `📝 Selected: "${selected}"`);
            }

            if (handleMusicCommandFast(text)) {
                addMessage('user', text);
                return;
            }

            const aiCommand = await parseMusicCommandWithAI(text);
            if (aiCommand.action && aiCommand.action !== 'none') {
                const executed = executeMusicAction(aiCommand.action, aiCommand.song);
                if (executed) {
                    addMessage('user', text);
                    return;
                }
            }

            addMessage('user', text);
            history.push({ role: 'user', text });
            if (history.length > 16) history = history.slice(-16);

            // Create abort controller for LLM
            llmAbortController = new AbortController();

            showTyping();
            if (voiceActive) setLiveTranscript('Thinking…');
            try {
                const answer = await getAIAnswer(text, selected, llmAbortController.signal);
                hideTyping();
                setLiveTranscript('');
                addMessage('bot', answer);
                history.push({ role: 'bot', text: answer });
                if (voiceActive && !musicPlaying) {
                    await speakText(answer);
                } else {
                    if (conversationActive && !musicPlaying) {
                        setTimeout(startListening, 500);
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('LLM fetch aborted (barge‑in)');
                } else {
                    hideTyping();
                    setLiveTranscript('');
                    addMessage('bot', "I'm having trouble connecting to my brain. Could you try again in a moment?");
                    console.error('sendMessage error:', err);
                }
            } finally {
                llmAbortController = null;
            }
        }

        // ─── TTS (abortable) ────────────────────────────────────────────
        async function speakText(text) {
            if (!voiceActive || !text) return;
            const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[\u{2600}-\u{26FF}]/gu, '').trim();
            if (!cleanText) return;

            // Abort any previous TTS
            if (ttsAbortController) {
                ttsAbortController.abort();
                ttsAbortController = null;
            }
            stopAudio(); // kills any current audio element

            isSpeaking = true;
            ttsAbortController = new AbortController();

            try {
                const res = await fetch(VOICE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: cleanText, language: 'en-US', voice_id: VOICE_ID, speed: VOICE_SPEED }),
                    signal: ttsAbortController.signal,
                });
                if (!res.ok) throw new Error(`TTS ${res.status}`);
                const blob = await res.blob();
                const audioUrl = URL.createObjectURL(blob);
                currentAudio = new Audio(audioUrl);
                currentAudio.addEventListener('ended', () => {
                    currentAudio = null;
                    isSpeaking = false;
                    ttsAbortController = null;
                    if (conversationActive && !musicPlaying && !vad) {
                        if (!vad) setTimeout(startListening, 500);
                    }
                });
                currentAudio.addEventListener('error', () => {
                    currentAudio = null;
                    isSpeaking = false;
                    ttsAbortController = null;
                    if (conversationActive && !musicPlaying && !vad) setTimeout(startListening, 500);
                });
                currentAudio.play();
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.log('TTS aborted (barge‑in)');
                } else {
                    console.warn('Voice failed:', err.message);
                }
                isSpeaking = false;
                ttsAbortController = null;
            }
        }

        // ─── Stop audio ────────────────────────────────────────────────
        function stopAudio() {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio.onended = null;
                currentAudio.onerror = null;
                currentAudio = null;
            }
            if (ttsAbortController) {
                ttsAbortController.abort();
                ttsAbortController = null;
            }
            ttsLoading = false;
            isSpeaking = false;
        }

        // ─── VAD Handlers ──────────────────────────────────────────────
        function handleBargeIn() {
            if (!voiceActive || !conversationActive || isMinimized) return;
            if (isSpeaking || ttsAbortController || llmAbortController) {
                console.log('🔊 Barge‑in – interrupting...');
                stopAudio(); // kills TTS
                if (llmAbortController) {
                    llmAbortController.abort();
                    llmAbortController = null;
                }
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                    silenceTimer = null;
                }
                isSpeaking = false;
            }
        }

        function handleSpeechEnd(audioBuffer) {
            // Placeholder for future server-side STT
            console.log('VAD speech end – not used for transcription yet.');
        }

        // ─── VAD Lifecycle ──────────────────────────────────────────────
        async function startVAD() {
            if (vad) return;
            if (typeof MicVAD === 'undefined') {
                console.warn('VAD library not loaded – barge‑in disabled.');
                return;
            }
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                vad = await MicVAD.new({
                    ...VAD_CONFIG,
                    stream: micStream,
                });
                vad.start();
                console.log('✅ VAD started');
            } catch (e) {
                console.warn('VAD init failed:', e);
                vad = null;
                if (micStream) {
                    micStream.getTracks().forEach(t => t.stop());
                    micStream = null;
                }
                if (audioContext && audioContext.state !== 'closed') {
                    try { audioContext.close(); } catch(e) {}
                    audioContext = null;
                }
            }
        }

        function stopVAD() {
            if (vad) {
                try { vad.stop(); } catch(e) {}
                vad = null;
            }
            if (micStream) {
                micStream.getTracks().forEach(t => t.stop());
                micStream = null;
            }
            if (audioContext && audioContext.state !== 'closed') {
                try { audioContext.close(); } catch(e) {}
                audioContext = null;
            }
        }

        // ─── Mic ────────────────────────────────────────────────────────
        function startListening() {
            if (!voiceActive || !SpeechRecognition) return;
            if (currentAudio) return;
            if (ttsLoading) return;
            if (musicPlaying) return;
            if (isMinimized) return;

            if (recognition) {
                try { recognition.stop(); } catch (e) {}
                recognition = null;
            }

            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = '';

            recognition.addEventListener('result', (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i];
                    if (r.isFinal) {
                        finalTranscript += r[0].transcript;
                    } else {
                        interim += r[0].transcript;
                    }
                }
                chatInput.value = finalTranscript + interim;
                setLiveTranscript(interim || finalTranscript, !!interim);
            });

            recognition.addEventListener('end', () => {
                micOrb.classList.remove('listening');
                const text = finalTranscript.trim();
                finalTranscript = '';
                recognition = null;
                setLiveTranscript('');

                if (text) {
                    chatInput.value = text;
                    sendMessage(text);
                } else {
                    if (wasPlayingBeforeMic && currentVideoId) {
                        wasPlayingBeforeMic = false;
                        resumeSong();
                    }
                }
            });

            recognition.addEventListener('error', (e) => {
                micOrb.classList.remove('listening');
                setLiveTranscript('');
                recognition = null;
                if (e.error === 'not-allowed') {
                    setLiveTranscript('Mic denied');
                    setTimeout(() => setLiveTranscript(''), 4000);
                }
                if (wasPlayingBeforeMic && currentVideoId) {
                    wasPlayingBeforeMic = false;
                    resumeSong();
                }
            });

            try {
                recognition.start();
                micOrb.classList.add('listening');
                setLiveTranscript('🎤 Listening…', true);
            } catch (e) {
                recognition = null;
            }
        }

        function stopListening() {
            if (recognition) {
                try { recognition.stop(); } catch (e) {}
                recognition = null;
            }
            micOrb.classList.remove('listening');
            setLiveTranscript('');
            if (wasPlayingBeforeMic && currentVideoId) {
                wasPlayingBeforeMic = false;
                resumeSong();
            }
        }

        micOrb.addEventListener('click', () => {
            if (!voiceActive) return;

            if (currentAudio) {
                stopAudio();
                if (musicPlaying) {
                    wasPlayingBeforeMic = true;
                    pauseSong();
                }
                if (!conversationActive) conversationActive = true;
                setTimeout(startListening, 100);
                return;
            }

            if (micOrb.classList.contains('listening')) {
                stopListening();
                return;
            }

            if (musicPlaying) {
                wasPlayingBeforeMic = true;
                pauseSong();
            }

            if (!conversationActive) conversationActive = true;
            startListening();
        });

        voiceToggleBtn.addEventListener('click', () => {
            voiceActive = !voiceActive;
            if (voiceActive) {
                voiceToggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
                voiceToggleBtn.classList.remove('voice-off');
                if (!isMinimized && conversationActive) startVAD();
            } else {
                voiceToggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
                voiceToggleBtn.classList.add('voice-off');
                stopListening();
                stopSong();
                stopAudio();
                stopVAD();
            }
        });

        sendBtn.addEventListener('click', () => sendMessage(chatInput.value));
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage(chatInput.value);
        });

        // ─── Export / Import / Clear ──────────────────────────────────
        saveChatBtn.addEventListener('click', () => {
            const data = JSON.stringify(messageHistory, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ragina-chat-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            chatStatus.textContent = 'Exported ✓';
            chatStatus.style.color = '#6C63FF';
            setTimeout(() => {
                chatStatus.textContent = 'Auto‑saved';
                chatStatus.style.color = '#666';
            }, 3000);
        });

        loadChatBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (Array.isArray(data)) {
                        messageHistory = data;
                        renderMessages(data);
                        saveToIndexedDB(data);
                        chatStatus.textContent = `Loaded ${data.length} messages`;
                        chatStatus.style.color = '#6C63FF';
                        const nameMsg = data.find(m => m.role === 'system' && m.text.includes('Welcome back'));
                        if (nameMsg) {
                            const match = nameMsg.text.match(/Welcome back, ([^!]+)/);
                            if (match) {
                                userName = match[1];
                                try { localStorage.setItem('ragina_user_name', userName); } catch(e) {}
                            }
                        }
                        history = data.filter(m => m.role === 'user' || m.role === 'bot')
                            .map(m => ({ role: m.role, text: m.text }));
                        introDone = true;
                        conversationActive = true;
                        if (userName) {
                            setTimeout(() => {
                                if (voiceActive && !musicPlaying && !currentAudio && !ttsLoading) {
                                    startListening();
                                }
                            }, 1000);
                        }
                    } else {
                        throw new Error('Invalid format');
                    }
                } catch (err) {
                    alert('Failed to load chat file. Make sure it\'s a valid JSON export.');
                    console.error(err);
                }
            };
            reader.readAsText(file);
            fileInput.value = '';
        });

        clearChatBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all chat history?')) {
                messageHistory = [];
                messages.innerHTML = '';
                history = [];
                userName = null;
                introDone = false;
                conversationActive = false;
                awaitingName = false;
                try { localStorage.removeItem('ragina_user_name'); } catch(e) {}
                await clearIndexedDB();
                chatStatus.textContent = 'Cleared';
                chatStatus.style.color = '#FF6584';
                setTimeout(() => {
                    chatStatus.textContent = 'Auto‑saved';
                    chatStatus.style.color = '#666';
                }, 3000);
            }
        });

        // ─── Typing / transcript ──────────────────────────────────────
        function setLiveTranscript(text, interim = false) {
            liveTranscript.textContent = text || '';
            liveTranscript.classList.toggle('interim', interim);
        }

        let typingEl = null;

        function showTyping() {
            typingEl = document.createElement('div');
            typingEl.className = 'typing-dots';
            typingEl.innerHTML = '<span></span><span></span><span></span>';
            messages.appendChild(typingEl);
            messages.scrollTop = messages.scrollHeight;
        }

        function hideTyping() {
            if (typingEl) { typingEl.remove(); typingEl = null; }
        }

        // ─── Boot ──────────────────────────────────────────────────────
        (async function init() {
            // Load YouTube API if not present
            if (!window.YT || !window.YT.Player) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                document.head.appendChild(script);
                await new Promise(resolve => {
                    const check = () => {
                        if (window.YT && window.YT.Player) {
                            resolve();
                        } else {
                            setTimeout(check, 200);
                        }
                    };
                    check();
                });
            }
            initYouTubePlayer();

            engine = await waitForEngine(5000);

            const hasHistory = await restoreChat();
            if (!hasHistory) {
                // No history – just show orb
            } else {
                if (userName) conversationActive = true;
            }
            setMinimized(true);
        })();

        // ─── Expose YouTube callback ──────────────────────────────────
        window.onYouTubeIframeAPIReady = function() {
            if (!youtubePlayer && window.YT && window.YT.Player) {
                initYouTubePlayer();
            }
        };
    }

    // ─── EXECUTE ──────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectApp();
            initApp();
        });
    } else {
        injectApp();
        initApp();
    }

})();