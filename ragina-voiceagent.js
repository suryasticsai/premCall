// =====================================================================
// RAGina Integration for premCall index.html
// =====================================================================

// --- Configuration ---
const RAGINA_NUMBER = '0000000000';
const RAGINA_NAME = 'RAGina';
const CALL_HISTORY_KEY = 'raginaCallHistory';

// --- State ---
let isCallActive = false;
let isMuted = false;
let isSpeakerOn = false;
let callStartTime = null;
let callTimerInterval = null;
let callTranscript = [];
let recognition = null;

// --- DOM refs (these will be set when the call UI is ready) ---
let callTimerEl = null;
let muteBtn = null;
let speakerBtn = null;
let endCallBtn = null;
let callStatusEl = null;

// --- Init function to be called from index.html ---
function initRAGinaIntegration() {
    // Find call UI elements (adjust selectors to match your HTML)
    callTimerEl = document.getElementById('callTimer') || document.querySelector('.call-timer');
    muteBtn = document.getElementById('muteBtn') || document.querySelector('.call-btn.mute');
    speakerBtn = document.getElementById('speakerBtn') || document.querySelector('.call-btn.speaker');
    endCallBtn = document.getElementById('endCallBtn') || document.querySelector('.call-btn.hangup');
    callStatusEl = document.getElementById('callStatus') || document.querySelector('.call-status');

    // Add RAGina as a contact if it doesn't exist already
    addRAGinaContact();

    // Bind call control buttons if they exist
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (speakerBtn) speakerBtn.addEventListener('click', toggleSpeaker);
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
}

// --- Add RAGina to the conversation list ---
function addRAGinaContact() {
    // This function should add RAGina to your conversations object and refresh the list.
    // If you store conversations in localStorage, do it here.
    // For simplicity, we'll assume you have a function `addConversation(peer, messages)`.
    // If not, adapt to your data model.

    // Example: if you have a global `conversations` object:
    if (window.conversations && !conversations[RAGINA_NUMBER]) {
        conversations[RAGINA_NUMBER] = [
            {
                text: '🤖 Hello! I\'m RAGina. Call me or chat with me.',
                timestamp: Date.now(),
                direction: 'incoming',
                from: RAGINA_NUMBER,
                pending: false,
                error: false
            }
        ];
        // Save to localStorage if needed
        if (typeof saveConversations === 'function') {
            saveConversations();
        }
        // Refresh the conversation list if you have a render function
        if (typeof renderConversationList === 'function') {
            renderConversationList();
        }
    }
}

// =====================================================================
// Core Call Functions
// =====================================================================

function startCall() {
    if (isCallActive) return;

    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Your browser does not support voice calls.');
        return;
    }

    // Reset state
    callTranscript = [];
    callStartTime = Date.now();
    isCallActive = true;

    // Update UI (show call screen, start timer, etc.)
    showCallUI(true);
    updateCallStatus('Connecting...');
    showToast('📞 Calling RAGina...');

    // Start the call timer
    if (callTimerEl) {
        callTimerInterval = setInterval(() => {
            if (callStartTime) {
                const duration = Date.now() - callStartTime;
                callTimerEl.textContent = formatDuration(duration);
            }
        }, 1000);
    }

    // Add a system message
    addMessageToChat('🔊 Call connected. You can speak or type.', 'incoming');

    // Start listening
    listenForCallSpeech();

    // Optionally: play a dial tone or ringback (not implemented)
}

function listenForCallSpeech() {
    if (!isCallActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // If muted, don't start recognition
    if (isMuted) {
        setTimeout(listenForCallSpeech, 500);
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;

        // Add user's spoken text as outgoing message
        addMessageToChat(transcript, 'outgoing');
        callTranscript.push({ role: 'user', text: transcript, timestamp: Date.now() });

        // Show thinking indicator
        showThinking();

        try {
            const answer = await askRAGina(transcript);
            hideThinking();
            // Add RAGina's reply as incoming message
            addMessageToChat(answer, 'incoming');
            callTranscript.push({ role: 'assistant', text: answer, timestamp: Date.now() });
            // Speak the answer
            speakText(answer);
        } catch (err) {
            hideThinking();
            addMessageToChat('Error: ' + err.message, 'incoming', true);
        }

        // Continue listening if call is still active
        if (isCallActive) {
            setTimeout(listenForCallSpeech, 800);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            showToast('Microphone access denied. Ending call.');
            endCall();
            return;
        }
        // Retry after a delay
        if (isCallActive) {
            setTimeout(listenForCallSpeech, 600);
        }
    };

    recognition.onend = () => {
        if (isCallActive && !isMuted) {
            // The recognition might have ended due to silence; restart
            setTimeout(listenForCallSpeech, 400);
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.warn('Recognition start failed:', e);
        if (isCallActive) {
            setTimeout(listenForCallSpeech, 600);
        }
    }
}

function endCall() {
    if (!isCallActive) return;

    const duration = callStartTime ? Date.now() - callStartTime : 0;
    isCallActive = false;

    // Clean up speech recognition
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
        recognition = null;
    }

    // Cancel any ongoing speech
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

    // Add system message
    addMessageToChat('📞 Call ended. Duration: ' + formatDuration(duration), 'incoming');
}

// =====================================================================
// AI & Speech Helpers
// =====================================================================

async function askRAGina(query) {
    // Use the RAGina engine if available
    const engine = window.RAGina?.getEngine?.();
    if (!engine || !engine.isReady) {
        throw new Error('RAGina engine is not ready.');
    }

    // Retrieve relevant chunks
    const chunks = engine.retrieve(query, 3);
    const contextText = chunks.length > 0
        ? chunks.map((c, i) => `[${i+1}] ${c.source || 'doc'}\n${c.text}`).join('\n\n')
        : 'No relevant documents found.';

    const prompt = `You are RAGina, a sassy mentalist who can read any document. Answer using ONLY the context below. If the answer isn't there, respond with attitude that the info isn't in the files.

Context:
${contextText}

Question: ${query}
Answer (as RAGina, with sass):`;

    // Call your LLM endpoint (same as in raginagent.html)
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

function speakText(text) {
    if (!window.speechSynthesis) return;
    // Clean text of emojis (optional)
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

// =====================================================================
// UI Controls
// =====================================================================

function toggleMute() {
    isMuted = !isMuted;
    if (muteBtn) {
        muteBtn.classList.toggle('active');
        muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    }
    showToast(isMuted ? '🔇 Muted' : '🎤 Unmuted');
    // If unmuted and call is active, restart recognition
    if (!isMuted && isCallActive) {
        listenForCallSpeech();
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
    // Show/hide the call overlay or call controls
    const callControls = document.querySelector('.call-controls');
    if (callControls) {
        callControls.classList.toggle('active', show);
    }
    // Also update the main call button icon if you have one
    const callBtn = document.querySelector('.call-btn.main-call');
    if (callBtn) {
        callBtn.innerHTML = show ? '<i class="fas fa-phone-slash"></i>' : '<i class="fas fa-phone"></i>';
    }
}

function updateCallStatus(status) {
    if (callStatusEl) {
        callStatusEl.textContent = status;
    }
}

function showThinking() {
    // You can add a "thinking" indicator in the chat
    // For simplicity, we'll just use a system message or a dot animation
    // You might want to adapt this to your UI
}

function hideThinking() {
    // Remove the thinking indicator
}

// =====================================================================
// Message Helpers (adapt to your app's addMessage function)
// =====================================================================

function addMessageToChat(text, direction, isError = false) {
    // This should call your existing addMessage function with the correct peer
    if (window.addMessage && typeof window.addMessage === 'function') {
        // If you have a global addMessage function that takes peer, msg object
        // For example: addMessage(peer, { text, direction, ... })
        window.addMessage(RAGINA_NUMBER, {
            text: text,
            timestamp: Date.now(),
            direction: direction,
            from: direction === 'outgoing' ? 'user' : RAGINA_NUMBER,
            pending: false,
            error: isError
        });
    } else {
        // Fallback: log to console
        console.log(direction + ':', text);
    }
}

// =====================================================================
// Call Log Storage & Download
// =====================================================================

function saveCallLog(log) {
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem(CALL_HISTORY_KEY) || '[]');
    } catch (e) {}
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

// =====================================================================
// Utility
// =====================================================================

function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    return mins + ':' + secs;
}

function showToast(msg) {
    // Use your existing toast function if available
    if (window.showToast && typeof window.showToast === 'function') {
        window.showToast(msg);
    } else {
        alert(msg); // fallback
    }
}

// =====================================================================
// Export / Expose
// =====================================================================

// Make functions available globally
window.initRAGinaIntegration = initRAGinaIntegration;
window.startCall = startCall;
window.endCall = endCall;
window.toggleMute = toggleMute;
window.toggleSpeaker = toggleSpeaker;