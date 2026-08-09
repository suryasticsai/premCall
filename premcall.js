// premcall.js – v1.0
// Exposes global `PremCall` object with event callbacks.
// Usage:
//   PremCall.init('1234567890', {
//     onIncoming: (callerId) => { ... },
//     onConnected: () => { ... },
//     onDisconnected: () => { ... },
//     onRemoteStream: (stream) => { ... },
//     onError: (err) => { ... }
//   });
//   PremCall.call('0987654321');
//   PremCall.answer();
//   PremCall.hangup();
//   PremCall.mute();
//   PremCall.speaker();

(function(global) {
  'use strict';

  // ─── Config ──────────────────────────────────────────────
  const CONFIG = {
    ICE: {
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
    }
  };

  // ─── State ──────────────────────────────────────────────────
  let myNumber = null;
  let peer = null;
  let currentCall = null;
  let localStream = null;
  let remoteStream = null;
  let isInCall = false;
  let isCaller = false;
  let incomingCall = null;
  let isMuted = false;
  let isSpeakerOn = false;
  let callbacks = {};

  // ─── Internal helpers ──────────────────────────────────────
  function log(msg, level) {
    console.log('[PremCall]', msg);
    if (callbacks.onLog) callbacks.onLog(msg, level);
  }

  function notify(event, data) {
    if (callbacks[event]) callbacks[event](data);
  }

  // ─── Microphone ──────────────────────────────────────────────
  async function getLocalStream() {
    if (localStream && localStream.getAudioTracks().length > 0) {
      return localStream;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      localStream = stream;
      log('Microphone acquired', 'info');
      return stream;
    } catch (err) {
      log('Microphone error: ' + err.message, 'error');
      throw err;
    }
  }

  // ─── PeerJS initialization ──────────────────────────────
  function initPeer(number, options) {
    if (peer) {
      peer.destroy();
      peer = null;
    }
    myNumber = number;
    callbacks = options || {};

    log('Initializing Peer with ID: ' + myNumber, 'info');
    peer = new Peer(myNumber, { debug: 2, config: CONFIG.ICE });

    peer.on('open', (id) => {
      log('Connected with ID: ' + id, 'info');
      notify('online', id);
    });

    peer.on('error', (err) => {
      log('Peer error: ' + err.type + ' – ' + err.message, 'error');
      if (err.type === 'unavailable-id') {
        notify('error', new Error('Number already taken'));
      } else {
        notify('error', err);
      }
    });

    peer.on('close', () => {
      log('Connection closed', 'warn');
      notify('offline', null);
      if (isInCall) hangup();
    });

    peer.on('disconnected', () => {
      log('Disconnected – reconnecting...', 'warn');
      notify('offline', null);
      setTimeout(() => {
        if (peer && !isInCall) peer.reconnect();
      }, 3000);
    });

    peer.on('call', (call) => {
      log('Incoming call from: ' + call.peer, 'info');
      if (isInCall) {
        call.close();
        log('Rejected – already in call', 'warn');
        return;
      }
      incomingCall = call;
      notify('incoming', call.peer);
    });
  }

  // ─── Public API ──────────────────────────────────────────

  const PremCall = {
    /**
     * Initialize the library with a 10‑digit number.
     * @param {string} number – your 10‑digit phone number
     * @param {object} callbacks – event handlers
     *   onIncoming(callerId)
     *   onConnected()
     *   onDisconnected()
     *   onRemoteStream(stream)
     *   onError(err)
     *   onLog(msg, level)
     */
    init(number, options) {
      if (!/^\d{10}$/.test(number)) {
        throw new Error('Number must be exactly 10 digits');
      }
      initPeer(number, options);
    },

    /**
     * Place a call to another 10‑digit number.
     */
    async call(target) {
      if (isInCall) {
        throw new Error('Already in a call');
      }
      if (!peer) {
        throw new Error('Not initialized. Call init() first.');
      }
      if (!/^\d{10}$/.test(target)) {
        throw new Error('Target must be exactly 10 digits');
      }
      if (target === myNumber) {
        throw new Error('Cannot call yourself');
      }

      log('Calling ' + target + '...', 'info');
      try {
        const stream = await getLocalStream();
        const call = peer.call(target, stream);
        if (!call) {
          throw new Error('Target unreachable');
        }

        currentCall = call;
        isCaller = true;
        isInCall = true;
        incomingCall = null;
        notify('callStarted', { target, isCaller: true });

        call.on('stream', (remoteStream) => {
          remoteStream = remoteStream;
          notify('remoteStream', remoteStream);
        });

        call.on('close', () => {
          PremCall.hangup();
        });

        call.on('error', (err) => {
          log('Call error: ' + err.message, 'error');
          PremCall.hangup();
          notify('error', err);
        });

        // ICE monitoring
        const pc = call.peerConnection;
        if (pc) {
          pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            log('ICE state: ' + state, 'info');
            if (state === 'connected' || state === 'completed') {
              notify('connected', null);
            } else if (state === 'failed' || state === 'disconnected') {
              PremCall.hangup();
              notify('error', new Error('Connection lost'));
            }
          };
        }
      } catch (err) {
        log('Call failed: ' + err.message, 'error');
        throw err;
      }
    },

    /**
     * Answer an incoming call.
     */
    async answer() {
      if (!incomingCall) {
        throw new Error('No incoming call');
      }
      try {
        const stream = await getLocalStream();
        incomingCall.answer(stream);
        currentCall = incomingCall;
        isCaller = false;
        isInCall = true;
        const caller = incomingCall.peer;
        incomingCall = null;
        notify('callStarted', { target: caller, isCaller: false });

        currentCall.on('stream', (remoteStream) => {
          remoteStream = remoteStream;
          notify('remoteStream', remoteStream);
        });

        currentCall.on('close', () => {
          PremCall.hangup();
        });

        currentCall.on('error', (err) => {
          log('Call error (answer): ' + err.message, 'error');
          PremCall.hangup();
          notify('error', err);
        });

        const pc = currentCall.peerConnection;
        if (pc) {
          pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            log('ICE state: ' + state, 'info');
            if (state === 'connected' || state === 'completed') {
              notify('connected', null);
            } else if (state === 'failed' || state === 'disconnected') {
              PremCall.hangup();
              notify('error', new Error('Connection lost'));
            }
          };
        }
      } catch (err) {
        log('Answer failed: ' + err.message, 'error');
        throw err;
      }
    },

    /**
     * Hang up the current call.
     */
    hangup() {
      if (currentCall) {
        currentCall.close();
        currentCall = null;
      }
      if (remoteStream) {
        remoteStream = null;
      }
      isInCall = false;
      isCaller = false;
      isMuted = false;
      incomingCall = null;
      notify('callEnded', null);
      log('Call ended', 'info');
    },

    /**
     * Toggle mute.
     */
    mute() {
      if (!localStream) return;
      isMuted = !isMuted;
      localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      notify('muteToggled', isMuted);
      return isMuted;
    },

    /**
     * Toggle speaker (visual only – real switching is browser‑dependent).
     */
    speaker() {
      isSpeakerOn = !isSpeakerOn;
      notify('speakerToggled', isSpeakerOn);
      return isSpeakerOn;
    },

    /**
     * Check if a target number is online.
     * Returns a promise that resolves to true/false.
     */
    checkStatus(target) {
      return new Promise((resolve) => {
        if (!peer) return resolve(false);
        const conn = peer.connect(target);
        let done = false;
        conn.on('open', () => {
          if (!done) { done = true; resolve(true); conn.close(); }
        });
        conn.on('error', () => {
          if (!done) { done = true; resolve(false); }
        });
        setTimeout(() => {
          if (!done) { done = true; resolve(false); conn.close(); }
        }, 3000);
      });
    },

    /**
     * Return the current number.
     */
    getNumber() { return myNumber; },

    /**
     * Return current call state.
     */
    isInCall() { return isInCall; },

    /**
     * Destroy the peer instance and clean up.
     */
    destroy() {
      if (peer) { peer.destroy(); peer = null; }
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      if (remoteStream) {
        remoteStream = null;
      }
      isInCall = false;
      incomingCall = null;
      currentCall = null;
      myNumber = null;
    }
  };

  // Expose globally
  global.PremCall = PremCall;

})(window);
