// premcall-core.js - fixed: isSpeaking ReferenceError + TTS-end-gated mic restart
(function(global) {
    'use strict';

    const RAGINA_NUMBER = '0000000000';
    const API_URL = 'https://ragina-crawler-ragina.vercel.app/api/ask';

    // ---------- audio utilities ----------
    let actx = null;
    function audioCtx() {
        if (!actx) {
            try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch(e) { return null; }
        }
        if (actx.state === 'suspended') actx.resume().catch(()=>{});
        return actx;
    }

    function beep(f1, f2, dur) {
        const ctx = audioCtx();
        if (!ctx) return;
        const now = ctx.currentTime,
              g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        g.connect(ctx.destination);
        [f1, f2].forEach(f => {
            if (!f) return;
            const o = ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            o.connect(g);
            o.start(now);
            o.stop(now + dur);
        });
    }

    const DTMF = {
        '1':[697,1209], '2':[697,1336], '3':[697,1477],
        '4':[770,1209], '5':[770,1336], '6':[770,1477],
        '7':[852,1209], '8':[852,1336], '9':[852,1477],
        '*':[941,1209], '0':[941,1336], '#':[941,1477]
    };

    let ringtoneTimer = null;
    function startRingtone() {
        stopRingtone();
        beep(440, 480, 0.35);
        ringtoneTimer = setInterval(() => beep(440, 480, 0.35), 1600);
    }
    function stopRingtone() {
        if (ringtoneTimer) { clearInterval(ringtoneTimer); ringtoneTimer = null; }
    }

    function vibrate(pattern) {
        if (navigator.vibrate) try { navigator.vibrate(pattern); } catch(e) {}
    }

    // ---------- TTS ----------
    let ttsVoices = [];
    let speechUnlocked = false;
    let speechQueue = Promise.resolve();

    if (window.speechSynthesis) {
        ttsVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => ttsVoices = window.speechSynthesis.getVoices();
    }

    function unlockSpeech() {
        if (!window.speechSynthesis || speechUnlocked) return;
        const p = new SpeechSynthesisUtterance(' ');
        p.volume = 0;
        p.onend = () => speechUnlocked = true;
        window.speechSynthesis.speak(p);
        setTimeout(() => speechUnlocked = true, 500);
    }

    // FIXED: speakText now takes { onStart, onEnd } callbacks instead of
    // touching an undeclared bare `isSpeaking` variable. onEnd is guaranteed
    // to fire exactly once (natural end, error, OR a 12s watchdog) so the
    // conversation can never get stuck waiting forever.
    function speakText(text, { onStart, onEnd } = {}) {
        const finish = () => { if (onEnd) onEnd(); };

        if (!window.speechSynthesis) { finish(); return; }
        const clean = String(text).replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        if (!clean) { finish(); return; }

        if (!speechUnlocked) {
            unlockSpeech();
            setTimeout(() => speakText(clean, { onStart, onEnd }), 300);
            return;
        }

        speechQueue = speechQueue.then(() => new Promise(resolve => {
            let done = false;
            const settle = () => {
                if (done) return;
                done = true;
                finish();
                resolve();
            };
            if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
            setTimeout(() => {
                const u = new SpeechSynthesisUtterance(clean);
                u.lang = 'en-US';
                u.volume = 0.9;
                u.voice = ttsVoices.find(v => v.lang.startsWith('en') && /female|zira|samantha|google/i.test(v.name))
                    || ttsVoices.find(v => v.lang.startsWith('en'))
                    || ttsVoices[0]
                    || null;
                u.onstart = () => { if (onStart) onStart(); };
                u.onend = settle;
                u.onerror = settle;
                setTimeout(settle, 12000); // watchdog: never hang forever
                try { window.speechSynthesis.speak(u); } catch(e) { settle(); }
            }, 60);
        }));
    }

    // ---------- AI ----------
    async function askRAGina(query) {
        try {
            const resp = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'You are RAGina, a friendly assistant. Answer concisely:\n' + query })
            });
            if (!resp.ok) throw 0;
            return (await resp.json()).text || 'No response.';
        } catch(e) {
            return "I'm having trouble answering right now. Please try again.";
        }
    }

    async function generateSummary(log) {
        if (!log || log.messages.length < 2) return null;
        const convo = log.messages.map(m =>
            (m.role === 'user' ? 'User: ' : 'RAGina: ') + m.text
        ).join('\n');
        try {
            const resp = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Summarize this phone conversation in exactly 2 short sentences:\n' + convo + '\nSummary:'
                })
            });
            const sum = ((await resp.json()).text || '').trim();
            if (sum) {
                log.summary = sum;
                updateLogSummary(log.id, sum);
                return sum;
            }
        } catch(e) {}
        return null;
    }

    // ---------- call logs ----------
    function getLogs() {
        try { return JSON.parse(localStorage.getItem('premCallLogs')) || []; }
        catch(e) { return []; }
    }
    function saveLogs(l) {
        try { localStorage.setItem('premCallLogs', JSON.stringify(l)); }
        catch(e) {}
    }
    function updateLogSummary(id, sum) {
        const logs = getLogs();
        const l = logs.find(x => x.id === id);
        if (l) { l.summary = sum; saveLogs(logs); }
    }

    // ---------- core class ----------
    class PremCallCore {
        constructor(options = {}) {
            this.onIncomingCall = options.onIncomingCall || (() => {});
            this.onCallStarted = options.onCallStarted || (() => {});
            this.onCallEnded = options.onCallEnded || (() => {});
            this.onTranscript = options.onTranscript || (() => {});
            this.onTimerUpdate = options.onTimerUpdate || (() => {});
            this.onStatusChange = options.onStatusChange || (() => {});
            this.onError = options.onError || (() => {});

            this.peer = null;
            this.myNumber = null;
            this.activeCall = null;
            this.incomingCall = null;
            this.localStream = null;
            this.inCall = false;
            this.muted = false;
            this.speakerOn = false;
            this.raginaCallActive = false;
            this.raginaRecognition = null;
            this.raginaIsMuted = false;
            this.isSpeaking = false;
            this.liveRecognition = null;
            this.timerInterval = null;
            this.timerSeconds = 0;
            this.currentLog = null;
            this.lastLog = null;
            this.conversationState = 0;
            this.userName = '';
        }

        init(number) {
            console.log('[PremCallCore] init() called with number:', number);
            this.myNumber = number;
            if (typeof global.Peer !== 'undefined' && number && number !== RAGINA_NUMBER) {
                console.log('[PremCallCore] Creating Peer with ID:', number);
                try {
                    this.peer = new global.Peer(number, { debug: 2 });  // verbose logging
                    console.log('[PremCallCore] Peer instance created:', this.peer);
                    this._attachPeerHandlers();
                    this.onStatusChange('connecting');
                } catch(e) {
                    console.error('[PremCallCore] Peer creation error:', e);
                    this.onError('Peer init failed: ' + e.message);
                }
            } else {
                console.log('[PremCallCore] RAGina-only mode (no Peer)');
                this.onStatusChange('online');
            }
            this._recoverLog();
        }

        call(number) {
            console.log('[PremCallCore] call() called with number:', number);
            if (number === RAGINA_NUMBER) {
                this._startRAGinaCall();
                return;
            }
            if (!this.peer) {
                console.warn('[PremCallCore] No peer object – registration required');
                this.onError('Register to call real numbers.');
                return;
            }
            console.log('[PremCallCore] Peer exists, attempting call...');
            this._getLocalStream().then(stream => {
                const call = this.peer.call(number, stream);
                if (!call) {
                    this.onError('Unreachable.');
                    return;
                }
                this._startLog(number, 'peer', 'outgoing');
                this._showCallScreenPeer(number, true);
                this._wireCallEvents(call);
            }).catch(err => {
                console.error('[PremCallCore] Microphone error:', err);
                this.onError('Microphone denied.');
            });
        }

        answer() {
            if (!this.incomingCall) return;
            const call = this.incomingCall;
            this.incomingCall = null;
            this._stopRingtone();
            this._getLocalStream().then(stream => {
                this._startLog(call.peer, 'peer', 'incoming');
                call.answer(stream);
                this._showCallScreenPeer(call.peer, false);
                this._wireCallEvents(call);
            }).catch(() => {
                this.onError('Microphone denied.');
            });
        }

        reject() {
            if (this.incomingCall) {
                const id = this.incomingCall.peer;
                this.incomingCall.close();
                this.incomingCall = null;
                this._addHistoryEntry(id, 'missed', '—');
            }
            this._stopRingtone();
        }

        hangup() {
            if (this.raginaCallActive) {
                this._endRAGinaCall();
            } else {
                this._endPeerCall();
            }
        }

        mute() {
            if (this.raginaCallActive) {
                this.raginaIsMuted = !this.raginaIsMuted;
                if (this.raginaIsMuted && this.raginaRecognition) {
                    try { this.raginaRecognition.stop(); } catch(e) {}
                    this.raginaRecognition = null;
                }
                return this.raginaIsMuted;
            }
            this.muted = !this.muted;
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(t => t.enabled = !this.muted);
            }
            return this.muted;
        }

        speaker() {
            this.speakerOn = !this.speakerOn;
            return this.speakerOn;
        }

        isInCall() {
            return this.inCall || this.raginaCallActive;
        }

        async checkStatus(number) {
            if (number === RAGINA_NUMBER) return true;
            if (!this.peer) return false;
            return new Promise(resolve => {
                try {
                    const conn = this.peer.connect(number);
                    let done = false;
                    const finish = v => {
                        if (!done) { done = true; resolve(v); try { conn.close(); } catch(e) {} }
                    };
                    conn.on('open', () => finish(true));
                    conn.on('error', () => finish(false));
                    setTimeout(() => finish(false), 3000);
                } catch(e) {
                    resolve(false);
                }
            });
        }

        getLogs() { return getLogs(); }
        getLastLog() { return this.lastLog; }

        exportLog(log, format) {
            if (!log) { this.onError('No call selected.'); return; }
            let content, filename, mime;
            const stamp = new Date(log.started).toISOString().replace(/[:.]/g, '-');
            if (format === 'json') {
                content = JSON.stringify(this._buildLogJSON(log), null, 2);
                filename = 'premcall-' + stamp + '.json';
                mime = 'application/json';
            } else {
                content = this.logText(log);
                filename = 'premcall-' + stamp + '.txt';
                mime = 'text/plain';
            }
            const url = URL.createObjectURL(new Blob([content], { type: mime }));
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        logText(log) {
            let out = 'PremCall Transcript\nNumber: ' + log.number +
                '\nType: ' + (log.type === 'ragina' ? 'RAGina AI Call' : 'Voice Call') +
                '\nDirection: ' + log.direction +
                '\nStarted: ' + new Date(log.started).toLocaleString() +
                '\nDuration: ' + (log.duration || '—') + '\n';
            if (log.summary) out += 'AI Recap: ' + log.summary + '\n';
            out += '\n' + (log.messages.length ?
                log.messages.map(m =>
                    '[' + new Date(m.timestamp).toLocaleTimeString() + '] ' +
                    (m.role === 'user' ? 'You' : (log.type === 'ragina' ? 'RAGina' : 'Live')) +
                    ': ' + m.text
                ).join('\n') :
                '(no transcript recorded)'
            );
            return out;
        }

        playDtmf(d) {
            const t = DTMF[d];
            if (t) beep(t[0], t[1], 0.08);
        }
        vibrate(pattern) { vibrate(pattern); }
        unlockSpeech() { unlockSpeech(); }

        // ---------- private ----------
        _getLocalStream() {
            if (this.localStream && this.localStream.getAudioTracks().length) {
                return Promise.resolve(this.localStream);
            }
            return navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true }
            }).then(stream => {
                this.localStream = stream;
                return stream;
            });
        }

        _attachPeerHandlers() {
            if (!this.peer) return;
            this.peer.on('open', (id) => {
                console.log('[PremCallCore] Peer open with id:', id);
                this.onStatusChange('online');
            });
            this.peer.on('disconnected', () => {
                console.warn('[PremCallCore] Peer disconnected');
                this.onStatusChange('offline');
                setTimeout(() => {
                    if (this.peer && !this.peer.destroyed) {
                        try { this.peer.reconnect(); } catch(e) {}
                    }
                }, 3000);
            });
            this.peer.on('error', (err) => {
                console.error('[PremCallCore] Peer error:', err);
                this.onError('Network: ' + err.type);
            });
            this.peer.on('call', call => {
                console.log('[PremCallCore] Incoming call from:', call.peer);
                if (this.isInCall()) { call.close(); return; }
                this.incomingCall = call;
                this._startRingtone();
                this.onIncomingCall(call.peer);
            });
        }

        _wireCallEvents(call) {
            this.activeCall = call;
            this.inCall = true;
            call.on('stream', stream => {
                console.log('[PremCallCore] Call stream received');
                this._onCallConnected();
            });
            call.on('close', () => {
                console.log('[PremCallCore] Call closed');
                this._endPeerCall();
            });
            call.on('error', (err) => {
                console.error('[PremCallCore] Call error:', err);
                this._endPeerCall();
            });
        }

        _showCallScreenPeer(peerId, isCaller) {
            this.onCallStarted('peer', peerId, isCaller);
            this._startTimer();
        }

        _startTimer() {
            this._stopTimer();
            this.timerSeconds = 0;
            this.timerInterval = setInterval(() => {
                this.timerSeconds++;
                this.onTimerUpdate(this.timerSeconds);
            }, 1000);
        }

        _stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            const out = this.timerSeconds;
            this.timerSeconds = 0;
            return out;
        }

        _startRingtone() { startRingtone(); vibrate([300,200,300]); }
        _stopRingtone() { stopRingtone(); }

        // ---------- logs ----------
        _startLog(number, type, direction) {
            this.currentLog = {
                id: Date.now(),
                number, type, direction,
                started: Date.now(),
                ended: null,
                duration: '',
                summary: '',
                messages: []
            };
            this._persistActiveLog();
        }

        _persistActiveLog() {
            try { localStorage.setItem('premCallActiveLog', JSON.stringify(this.currentLog)); } catch(e) {}
        }
        _clearActiveLog() { try { localStorage.removeItem('premCallActiveLog'); } catch(e) {} }

        _logMsg(role, text) {
            if (!this.currentLog) return;
            this.currentLog.messages.push({ role, text, timestamp: Date.now() });
            if (this.currentLog.messages.length > 300) this.currentLog.messages.shift();
            this._persistActiveLog();
            this.onTranscript(role, text);
        }

        _endLog(duration) {
            if (!this.currentLog) return null;
            this.currentLog.ended = Date.now();
            this.currentLog.duration = duration;
            const logs = getLogs();
            logs.unshift(this.currentLog);
            if (logs.length > 20) logs.length = 20;
            saveLogs(logs);
            this._clearActiveLog();
            this.lastLog = this.currentLog;
            const done = this.currentLog;
            this.currentLog = null;
            return done;
        }

        _addHistoryEntry(number, direction, duration, logId) {
            try {
                let h = JSON.parse(localStorage.getItem('premCallHistory')) || [];
                h.unshift({ number, direction, duration: duration || '—', timestamp: Date.now(), logId: logId || null });
                if (h.length > 50) h.length = 50;
                localStorage.setItem('premCallHistory', JSON.stringify(h));
            } catch(e) {}
        }

        _recoverLog() {
            try {
                const raw = localStorage.getItem('premCallActiveLog');
                if (raw) {
                    localStorage.removeItem('premCallActiveLog');
                    const l = JSON.parse(raw);
                    if (l && l.messages && l.messages.length) {
                        l.ended = Date.now();
                        l.duration = 'interrupted';
                        const logs = getLogs();
                        logs.unshift(l);
                        if (logs.length > 20) logs.length = 20;
                        saveLogs(logs);
                        this.lastLog = l;
                    }
                }
            } catch(e) {}
            if (!this.lastLog) {
                const logs = getLogs();
                this.lastLog = logs.find(l => l.messages && l.messages.length) || null;
            }
        }

        _buildLogJSON(log) {
            return {
                number: log.number,
                type: log.type,
                direction: log.direction,
                started: new Date(log.started).toISOString(),
                ended: log.ended ? new Date(log.ended).toISOString() : null,
                duration: log.duration || null,
                aiSummary: log.summary || null,
                messages: log.messages
            };
        }

        // ---------- RAGina ----------
        _startRAGinaCall() {
            if (this.raginaCallActive || this.inCall) {
                this.onError('Already in a call.');
                return;
            }
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) {
                this.onError('Voice calls not supported in this browser.');
                return;
            }
            this.unlockSpeech();
            this.raginaCallActive = true;
            this.conversationState = 0;
            this.userName = '';
            this._startLog(RAGINA_NUMBER, 'ragina', 'outgoing');
            this._startTimer();
            this.onCallStarted('ragina', RAGINA_NUMBER, true);
            setTimeout(() => {
                if (!this.raginaCallActive) return;
                const greet = "Hello! I'm RAGina. What is your name?";
                this._logMsg('ragina', greet);
                this.isSpeaking = true;
                speakText(greet, {
                    onEnd: () => {
                        this.isSpeaking = false;
                        // FIXED: wait for TTS to actually finish, not a guessed timeout
                        setTimeout(() => this._listenToRAGina(), 400);
                    }
                });
            }, 1200);
        }

        _listenToRAGina() {
            if (!this.raginaCallActive || this.raginaIsMuted || this.isSpeaking || this.raginaRecognition) {
                if (this.raginaCallActive && !this.raginaIsMuted && !this.raginaRecognition) {
                    setTimeout(() => this._listenToRAGina(), 600);
                }
                return;
            }
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) return;
            const rec = new SR();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = 'en-US';
            rec.maxAlternatives = 1;
            rec.onresult = async (e) => {
                if (this.isSpeaking) return;
                const text = e.results[0][0].transcript;
                if (!text.trim()) return;
                this._logMsg('user', text.trim());
                if (this.conversationState === 0) {
                    let name = text.trim();
                    const stopWords = ['um','uh','my name is','i am',"i'm"];
                    for (let sw of stopWords) {
                        if (name.toLowerCase().startsWith(sw)) {
                            name = name.slice(sw.length).trim();
                            break;
                        }
                    }
                    this.userName = name || 'Friend';
                    this.conversationState = 1;
                    const r = 'Nice to meet you, ' + this.userName + '. What can I help you with today?';
                    this._logMsg('ragina', r);
                    this.isSpeaking = true;
                    speakText(r, {
                        onEnd: () => {
                            this.isSpeaking = false;
                            setTimeout(() => this._listenToRAGina(), 400);
                        }
                    });
                } else {
                    const ans = await askRAGina(text);
                    if (!this.raginaCallActive) return;
                    this._logMsg('ragina', ans);
                    this.isSpeaking = true;
                    speakText(ans, {
                        onEnd: () => {
                            this.isSpeaking = false;
                            setTimeout(() => this._listenToRAGina(), 400);
                        }
                    });
                }
            };
            rec.onerror = (e) => {
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    this.onError('Microphone denied. Ending call.');
                    this._endRAGinaCall();
                    return;
                }
                this.raginaRecognition = null;
                if (this.raginaCallActive && !this.raginaIsMuted && !this.isSpeaking) {
                    setTimeout(() => this._listenToRAGina(), 600);
                }
            };
            rec.onend = () => {
                this.raginaRecognition = null;
                if (this.raginaCallActive && !this.raginaIsMuted && !this.isSpeaking) {
                    setTimeout(() => this._listenToRAGina(), 500);
                }
            };
            this.raginaRecognition = rec;
            try { rec.start(); } catch(e) {
                this.raginaRecognition = null;
                if (this.raginaCallActive && !this.raginaIsMuted) {
                    setTimeout(() => this._listenToRAGina(), 600);
                }
            }
        }

        _endRAGinaCall() {
            if (!this.raginaCallActive) return;
            this.raginaCallActive = false;
            this.isSpeaking = false;
            if (this.raginaRecognition) {
                try { this.raginaRecognition.stop(); } catch(e) {}
                this.raginaRecognition = null;
            }
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            const dur = this._stopTimer();
            const log = this._endLog(dur);
            this.onCallEnded(log);
            if (log && log.messages.length) {
                generateSummary(log).then(sum => {
                    if (sum) this.onCallEnded(log);
                });
            }
        }

        _endPeerCall() {
            if (this.activeCall) {
                try { this.activeCall.close(); } catch(e) {}
            }
            if (!this.inCall) return;
            this.activeCall = null;
            this.inCall = false;
            this._stopLiveTranscription();
            const dur = this._stopTimer();
            const log = this._endLog(dur);
            if (log) {
                this._addHistoryEntry(log.number, log.direction, dur, log.id);
            }
            this.onCallEnded(log);
            if (log && log.messages.length) {
                generateSummary(log).then(sum => {
                    if (sum) this.onCallEnded(log);
                });
            }
        }

        _onCallConnected() {
            this._startLiveTranscription();
            this.onCallStarted('peer', this.activeCall ? this.activeCall.peer : '', false);
        }

        _startLiveTranscription() {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) return;
            this._stopLiveTranscription();
            const rec = new SR();
            rec.continuous = false;
            rec.interimResults = false;
            rec.lang = 'en-US';
            this.liveRecognition = rec;
            rec.onresult = e => { this._logMsg('user', e.results[0][0].transcript); };
            rec.onend = () => {
                this.liveRecognition = null;
                if (this.inCall) setTimeout(() => this._startLiveTranscription(), 700);
            };
            rec.onerror = () => {};
            try { rec.start(); } catch(e) {}
        }

        _stopLiveTranscription() {
            if (this.liveRecognition) {
                try { this.liveRecognition.stop(); } catch(e) {}
                this.liveRecognition = null;
            }
        }

        destroy() {
            this._stopTimer();
            this._stopRingtone();
            if (this.peer) {
                try { this.peer.destroy(); } catch(e) {}
                this.peer = null;
            }
            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
                this.localStream = null;
            }
            if (this.activeCall) {
                try { this.activeCall.close(); } catch(e) {}
                this.activeCall = null;
            }
            if (this.raginaRecognition) {
                try { this.raginaRecognition.stop(); } catch(e) {}
                this.raginaRecognition = null;
            }
            if (this.liveRecognition) {
                try { this.liveRecognition.stop(); } catch(e) {}
                this.liveRecognition = null;
            }
            this.raginaCallActive = false;
            this.inCall = false;
            this.isSpeaking = false;
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        }
    }

    // ---------- expose ----------
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PremCallCore;
    } else {
        global.PremCallCore = PremCallCore;
    }

})(typeof window !== 'undefined' ? window : this);
