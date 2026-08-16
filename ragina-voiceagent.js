// =====================================================================
// RAGina Integration – Dialer‑friendly version
// =====================================================================

const RAGINA_NUMBER = '0000000000';
const RAGINA_NAME = 'RAGina';
const CALL_HISTORY_KEY = 'raginaCallHistory';

let isCallActive = false;
let isMuted = false;
let isSpeakerOn = false;
let callStartTime = null;
let callTimerInterval = null;
let callTranscript = [];
let recognition = null;
let callTimerEl = null;
let muteBtn = null;
let speakerBtn = null;
let endCallBtn = null;
let callStatusEl = null;

// --- Called from your index.html after DOM is ready ---
function initRAGinaIntegration() {
    // Locate your call control elements (adjust selectors to match your HTML)
    callTimerEl = document.getElementById('callTimer') || document.querySelector('.call-timer');
    muteBtn = document.getElementById('muteBtn') || document.querySelector('.call-btn.mute');
    speakerBtn = document.getElementById('speakerBtn') || document.querySelector('.call-btn.speaker');
    endCallBtn = document.getElementById('endCallBtn') || document.querySelector('.call-btn.hangup');

    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (speakerBtn) speakerBtn.addEventListener('click', toggleSpeaker);
    if (endCallBtn) endCallBtn.addEventListener('click', endRAGinaCall);

    // Add RAGina as a contact (optional: if your app doesn't auto‑create it)
    ensureRAGinaContact();

    // Expose the dial function globally
    window.startRAGinaCall = startRAGinaCall;
    window.endRAGinaCall = endRAGinaCall;
}

// --- Make sure RAGina appears in your conversation list ---
function ensureRAGinaContact() {
    // If your app has a `conversations` object and `addConversation` function, use them.
    // Otherwise, you can handle this in your app's own initialisation.
    // This function is a placeholder – you can adapt it to your data model.
    if (window.conversations && !window.conversations[RAGINA_NUMBER]) {
        window.conversations[RAGINA_NUMBER] = [
            {
                text: '🤖 Hello! I\'m RAGina. Dial my number to call me.',
                timestamp: Date.now(),
                direction: 'incoming',
                from: RAGINA_NUMBER,
                pending: false,
                error: false
            }
        ];
        if (typeof window.saveConversations === 'function') {
            window.saveConversations();
        }
        if (typeof window.renderConversationList === 'function') {
            window.renderConversationList();
        }
    }
}

// --- Start a call to RAGina (called when user dials RAGINA_NUMBER) ---
function startRAGinaCall() {
    if (isCallActive) {
        showToast('Call already in progress.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Your browser does not support voice calls.');
        return;
    }

    // Reset state
    callTranscript = [];
    callStartTime = Date.now();
    isCallActive = true;

    // Show call UI (activate your call overlay)
    showCallUI(true);
    updateCallStatus('Connected');
    showToast('📞 Connected to RAGina');

    // Start timer
    if (callTimerEl) {
        callTimerInterval = setInterval(() => {
            if (callStartTime) {
                callTimerEl.textContent = formatDuration(Date.now() - callStartTime);
            }
        }, 1000);
    }

    // Add a system message (optional)
    addMessageToChat('🔊 Call connected. You can speak or type.', 'incoming');

    // Start listening
    listenForRAGinaSpeech();
}

// --- Listen for user speech ---
function listenForRAGinaSpeech() {
    if (!isCallActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // If muted, poll again later
    if (isMuted) {
        setTimeout(listenForRAGinaSpeech, 500);
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;

        // Add user's spoken text to chat
        addMessageToChat(transcript, 'outgoing');
        callTranscript.push({ role: 'user', text: transcript, timestamp: Date.now() });

        // Show thinking indicator (optional)
        showThinkingIndicator(true);

        try {
            const answer = await askRAGina(transcript);
            showThinkingIndicator(false);
            addMessageToChat(answer, 'incoming');
            callTranscript.push({ role: 'assistant', text: answer, timestamp: Date.now() });
            speakText(answer);
        } catch (err) {
            showThinkingIndicator(false);
            addMessageToChat('Error: ' + err.message, 'incoming', true);
        }

        if (isCallActive) {
            setTimeout(listenForRAGinaSpeech, 800);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            showToast('Microphone access denied. Ending call.');
            endRAGinaCall();
            return;
        }
        if (isCallActive) {
            recognition = null;
            setTimeout(listenForRAGinaSpeech, 600);
        }
    };

    recognition.onend = () => {
        if (isCallActive && !isMuted) {
            setTimeout(listenForRAGinaSpeech, 400);
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn('Recognition start failed:', e);
        if (isCallActive) {
            setTimeout(listenForRAGinaSpeech, 600);
        }
    }
}

// --- End the call ---
function endRAGinaCall() {
    if (!isCallActive) return;

    const duration = callStartTime ? Date.now() - callStartTime : 0;
    isCallActive = false;

    // Clean up speech recognition
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
        recognition = null;
    }

    // Cancel speech synthesis
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    // Stop timer
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }

    // Save transcript
    if (callTranscript.length > 0) {
        const callLog = {
            timestamp: callStartTime || Date.now(),
            duration: duration,
            caller: 'user',
            callee: RAGINA_NUMBER,
            transcript: callTranscript,
            summary: callTranscript.map(m => m.text).join(' ')
        };
        saveCallLog(callLog);
        downloadCallLog(callLog);
        showToast('📞 Call ended. Transcript saved.');
    } else {
        showToast('Call ended.');
    }

    // Reset UI
    showCallUI(false);
    updateCallStatus('Idle');
    if (callTimerEl) callTimerEl.textContent = '00:00';

    addMessageToChat('📞 Call ended. Duration: ' + formatDuration(duration), 'incoming');
}

// --- AI call (same as before) ---
async function askRAGina(query) {
    const engine = window.RAGina?.getEngine?.();
    if (!engine || !engine.isReady) {
        throw new Error('RAGina engine is not ready.');
    }

    const chunks = engine.retrieve(query, 3);
    const contextText = chunks.length > 0
        ? chunks.map((c, i) => `[${i+1}] ${c.source || 'doc'}\n${c.text}`).join('\n\n')
        : 'No relevant documents found.';

    const prompt = `You are RAGina, a sassy mentalist who can read any document. Answer using ONLY the context below. If the answer isn't there, respond with attitude that the info isn't in the files.

Context:
${contextText}

Question: ${query}
Answer (as RAGina, with sass):`;

    const resp = await fetch('https://ragina-crawler-ragina.vercel.app/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    if (!resp.ok) throw new Error(`LLM error: ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data.text || 'No response from RAGina.';
}

// --- Speech synthesis ---
function speakText(text) {
    if (!window.speechSynthesis) return;
    const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[\u{2600}-\u{26FF}]/gu, '').trim();
    if (!cleanText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
}

// --- UI controls ---
function toggleMute() {
    isMuted = !isMuted;
    if (muteBtn) {
        muteBtn.classList.toggle('active');
        muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    }
    showToast(isMuted ? '🔇 Muted' : '🎤 Unmuted');
    if (!isMuted && isCallActive) {
        listenForRAGinaSpeech();
    }
}

function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    if (speakerBtn) {
        speakerBtn.classList.toggle('active');
        speakerBtn.innerHTML = isSpeakerOn ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-off"></i>';
    }
    showToast(isSpeakerOn ? '🔊 Speaker on' : '🔇 Speaker off');
}

function showCallUI(show) {
    const callControls = document.querySelector('.call-controls');
    if (callControls) callControls.classList.toggle('active', show);
    const callBtn = document.querySelector('.call-btn.main-call');
    if (callBtn) callBtn.innerHTML = show ? '<i class="fas fa-phone-slash"></i>' : '<i class="fas fa-phone"></i>';
}

function updateCallStatus(status) {
    if (callStatusEl) callStatusEl.textContent = status;
}

// --- Message helper ---
function addMessageToChat(text, direction, isError = false) {
    if (window.addMessage && typeof window.addMessage === 'function') {
        window.addMessage(RAGINA_NUMBER, {
            text: text,
            timestamp: Date.now(),
            direction: direction,
            from: direction === 'outgoing' ? 'user' : RAGINA_NUMBER,
            pending: false,
            error: isError
        });
    } else {
        console.log(direction + ':', text);
    }
}

// --- Thinking indicator (stub – you can implement it) ---
function showThinkingIndicator(show) {
    // Implement if you want a "thinking..." animation in the chat
}

// --- Call log storage ---
function saveCallLog(log) {
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]'); } catch (e) {}
    logs.push(log);
    localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(logs));
}

function downloadCallLog(callLog) {
    const json = JSON.stringify(callLog, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date(callLog.timestamp).toISOString().replace(/[:.]/g, '-');
    a.download = `ragina-call-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Utilities ---
function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    return mins + ':' + secs;
}

function showToast(msg) {
    if (window.showToast && typeof window.showToast === 'function') {
        window.showToast(msg);
    } else {
        alert(msg);
    }
}

// --- Expose to window ---
window.initRAGinaIntegration = initRAGinaIntegration;
window.startRAGinaCall = startRAGinaCall;
window.endRAGinaCall = endRAGinaCall;
window.toggleMute = toggleMute;
window.toggleSpeaker = toggleSpeaker;