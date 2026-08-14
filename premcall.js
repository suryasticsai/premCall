/* ============================================================
   PremCall v2.1  (merged - call + chat)
   WebRTC calling + chat over PeerJS.

   Requires the official PeerJS library to be loaded first:
     <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
   which defines the global `Peer` class this file wraps.

   Public API:
     PremCall.init(number, callbacks)
     PremCall.call(targetNumber)          -> Promise
     PremCall.answer()                    -> Promise
     PremCall.hangup()
     PremCall.mute()                      -> boolean (new muted state)
     PremCall.speaker()                   -> boolean (new speaker state)
     PremCall.checkStatus(number)         -> Promise<boolean>
     PremCall.getNumber()                 -> string|null
     PremCall.isInCall()                  -> boolean
     PremCall.destroy()
     PremCall.sendMessage(target, text)   -> Promise
     PremCall.onMessage(cb) / PremCall.offMessage(cb)

   Callbacks passed to init(number, { ... }):
     onLog(message, level), online(id), onConnected(id),
     onError(err), offline(), onDisconnected(),
     onIncoming(peerId), onCallStarted({target, isCaller}),
     onRemoteStream(stream), onCallEnded(), onMuteToggled(bool),
     onSpeakerToggled(bool), onMessage(msg)
   ============================================================ */
(function (global) {
  'use strict';

  if (typeof global.Peer === 'undefined') {
    console.error('[PremCall] The PeerJS library was not found. ' +
      'Load https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js before this script.');
    return;
  }

  // ─── Config ──────────────────────────────────────────────
  const CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.ekiga.net' },
      { urls: 'stun:stun.ideasip.com' },
      {
        urls: ['turn:numb.viagenie.ca:3478', 'turn:numb.viagenie.ca:443'],
        username: 'webrtc@live.com',
        credential: 'muazkh'
      }
    ],
    iceCandidatePoolSize: 10
  };

  // ─── State ──────────────────────────────────────────────────
  let peer = null;
  let myNumber = null;
  let incomingCall = null;
  let activeCall = null;
  let localStream = null;
  let remoteStream = null;
  let inCall = false;
  let muted = false;
  let speakerOn = false;
  let callbacks = {};
  let messageListeners = new Set();

  // ─── Internal helpers ──────────────────────────────────────
  function log(message, level) {
    console.log('[PremCall]', message);
    if (callbacks.onLog) callbacks.onLog(message, level);
  }

  function fire(name, data) {
    if (callbacks[name]) callbacks[name](data);
  }

  // Resets all call-related state
  function resetCallState() {
    if (activeCall) {
      try { activeCall.close(); } catch (e) {}
    }
    activeCall = null;
    remoteStream = null;
    inCall = false;
    incomingCall = null;
    muted = false;
  }

  // ─── Microphone ──────────────────────────────────────────────
  async function getLocalStream() {
    if (localStream && localStream.getAudioTracks().length > 0) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      localStream = stream;
      log('Microphone acquired', 'info');
      return stream;
    } catch (e) {
      log('Microphone error: ' + e.message, 'error');
      throw e;
    }
  }

  // ─── Wire call events ──────────────────────────────────────
  function wireCallEvents(call, isCaller) {
    activeCall = call;
    inCall = true;
    fire('onCallStarted', { target: call.peer, isCaller: isCaller });

    call.on('stream', function (stream) {
      remoteStream = stream;
      fire('onRemoteStream', remoteStream);
    });

    call.on('close', function () {
      resetCallState();
      fire('onCallEnded', null);
    });

    call.on('error', function (err) {
      log('Call error: ' + err.message, 'error');
      resetCallState();
      fire('onError', err);
    });

    const pc = call.peerConnection;
    if (pc) {
      pc.oniceconnectionstatechange = function () {
        const state = pc.iceConnectionState;
        log('ICE state: ' + state, 'info');
        if (state === 'connected' || state === 'completed') {
          fire('onConnected', null);
        }
        if (state === 'failed' || state === 'disconnected') {
          resetCallState();
          fire('onError', new Error('Connection lost'));
        }
      };
    }
  }

  // ─── PeerJS initialization ──────────────────────────────
  function attachPeerHandlers() {
    peer.on('open', function (id) {
      log('Connected with ID: ' + id, 'info');
      fire('online', id);
      fire('onConnected', id);
    });

    peer.on('error', function (err) {
      log('Peer error: ' + err.type + ' - ' + err.message, 'error');
      if (err.type === 'unavailable-id') {
        fire('onError', new Error('Number already taken'));
      } else {
        fire('onError', err);
      }
    });

    peer.on('close', function () {
      log('Connection closed', 'warn');
      fire('offline', null);
      fire('onDisconnected', null);
      if (inCall) resetCallState();
    });

    peer.on('disconnected', function () {
      log('Disconnected - reconnecting...', 'warn');
      fire('offline', null);
      fire('onDisconnected', null);
      setTimeout(function () {
        if (peer && !peer.destroyed) peer.reconnect();
      }, 3000);
    });

    peer.on('call', function (call) {
      log('Incoming call from: ' + call.peer, 'info');
      if (inCall) {
        call.close();
        log('Rejected - already in call', 'warn');
        return;
      }
      incomingCall = call;
      fire('onIncoming', call.peer);
    });

    // ─── Message handling ──────────────────────────────────────
    peer.on('connection', function (conn) {
      conn.on('data', function (data) {
        try {
          const msg = typeof data === 'string' ? JSON.parse(data) : data;
          if (msg && msg.type === 'premcall-message') {
            const message = {
              from: msg.from,
              text: msg.text,
              timestamp: msg.timestamp || Date.now(),
              direction: 'incoming'
            };
            messageListeners.forEach(function (cb) { cb(message); });
            fire('onMessage', message);
          }
        } catch (e) {
          console.warn('[PremCall] Invalid message data', e);
        }
      });
    });
  }

  // ─── Public API ──────────────────────────────────────────

  const PremCall = {
    /**
     * Initialize the library with a 10‑digit number.
     */
    init: function (number, opts) {
      if (!/^\d{10}$/.test(number)) {
        throw new Error('Number must be exactly 10 digits');
      }
      
      // Clean up any existing instance
      if (peer) {
        peer.destroy();
        peer = null;
      }
      
      myNumber = number;
      callbacks = opts || {};
      peer = new global.Peer(number, { debug: 2, config: CONFIG });
      attachPeerHandlers();
    },

    /**
     * Place a call to another 10‑digit number.
     */
    call: async function (target) {
      if (inCall) throw new Error('Already in a call');
      if (!peer) throw new Error('Not initialized. Call init() first.');
      if (!/^\d{10}$/.test(target)) throw new Error('Target must be exactly 10 digits');
      if (target === myNumber) throw new Error('Cannot call yourself');
      
      log('Calling ' + target + '...', 'info');
      try {
        const stream = await getLocalStream();
        const call = peer.call(target, stream);
        if (!call) throw new Error('Target unreachable');
        wireCallEvents(call, true);
      } catch (e) {
        log('Call failed: ' + e.message, 'error');
        throw e;
      }
    },

    /**
     * Answer an incoming call.
     */
    answer: async function () {
      if (!incomingCall) throw new Error('No incoming call');
      const call = incomingCall;
      incomingCall = null;
      try {
        const stream = await getLocalStream();
        call.answer(stream);
        wireCallEvents(call, false);
      } catch (e) {
        log('Answer failed: ' + e.message, 'error');
        throw e;
      }
    },

    /**
     * Hang up the current call.
     */
    hangup: function () {
      resetCallState();
      fire('onCallEnded', null);
      log('Call ended', 'info');
    },

    /**
     * Toggle mute.
     */
    mute: function () {
      if (!localStream) return muted;
      muted = !muted;
      localStream.getAudioTracks().forEach(function (t) { t.enabled = !muted; });
      fire('onMuteToggled', muted);
      return muted;
    },

    /**
     * Toggle speaker (visual only – real switching is browser‑dependent).
     */
    speaker: function () {
      speakerOn = !speakerOn;
      fire('onSpeakerToggled', speakerOn);
      return speakerOn;
    },

    /**
     * Check if a target number is online.
     */
    checkStatus: function (number) {
      return new Promise(function (resolve) {
        if (!peer) return resolve(false);
        const conn = peer.connect(number);
        let done = false;
        conn.on('open', function () {
          if (!done) { done = true; resolve(true); conn.close(); }
        });
        conn.on('error', function () {
          if (!done) { done = true; resolve(false); }
        });
        setTimeout(function () {
          if (!done) { done = true; resolve(false); try { conn.close(); } catch (e) {} }
        }, 3000);
      });
    },

    /**
     * Return the current number.
     */
    getNumber: function () { return myNumber; },

    /**
     * Return current call state.
     */
    isInCall: function () { return inCall; },

    /**
     * Destroy the peer instance and clean up.
     */
    destroy: function () {
      if (peer) { 
        peer.destroy(); 
        peer = null; 
      }
      if (localStream) {
        localStream.getTracks().forEach(function (t) { t.stop(); });
        localStream = null;
      }
      remoteStream = null;
      inCall = false;
      incomingCall = null;
      activeCall = null;
      myNumber = null;
      muted = false;
      speakerOn = false;
      messageListeners.clear();
    },

    // ─── Chat ──────────────────────────────────────────────────

    /**
     * Send a message to another number.
     * @param {string} target - 10-digit number
     * @param {string} text - Message text
     * @returns {Promise} Resolves with message object on success
     */
    sendMessage: function (target, text) {
      return new Promise(function (resolve, reject) {
        if (!peer) return reject(new Error('PremCall not initialized.'));
        if (!/^\d{10}$/.test(target)) return reject(new Error('Target must be 10 digits.'));
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          return reject(new Error('Message cannot be empty.'));
        }
        
        const payload = {
          type: 'premcall-message',
          from: myNumber,
          text: text.trim(),
          timestamp: Date.now()
        };
        
        const conn = peer.connect(target, { reliable: true });
        let done = false;
        
        conn.on('open', function () {
          conn.send(JSON.stringify(payload));
          if (!done) {
            done = true;
            const messageObj = { 
              target: target, 
              text: payload.text, 
              timestamp: payload.timestamp, 
              direction: 'outgoing' 
            };
            resolve(messageObj);
            // Fire callback for outgoing messages too
            fire('onMessage', messageObj);
            setTimeout(function () { 
              try { conn.close(); } catch (e) {} 
            }, 500);
          }
        });
        
        conn.on('error', function (err) { 
          if (!done) { 
            done = true; 
            reject(err); 
          } 
        });
        
        setTimeout(function () {
          if (!done) {
            done = true;
            reject(new Error('Send timeout'));
            try { conn.close(); } catch (e) {}
          }
        }, 5000);
      });
    },

    /**
     * Register a message listener.
     */
    onMessage: function (cb) { 
      if (typeof cb === 'function') messageListeners.add(cb); 
    },

    /**
     * Remove a message listener.
     */
    offMessage: function (cb) { 
      messageListeners.delete(cb); 
    }
  };

  // Expose globally
  global.PremCall = PremCall;
  console.log('[PremCall] Library loaded (v2.1).');
})(window);