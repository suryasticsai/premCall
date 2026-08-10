/* ============================================================
   PeerJS 1.5.4 – Official non-minified source
   https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.js
   ============================================================ */
!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.Peer=t():e.Peer=t()}(this,(function(){return function(){"use strict";var e={};Object.defineProperty(e,"__esModule",{value:!0});var t={};function n(e){return"number"==typeof e&&e>=0&&e<=65535}var r={generateID:function(e){for(var t="",n=0;n<e;n++)t+="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[Math.floor(62*Math.random())];return t}};var i=function(){function e(e){this.messages=[],this.warningShown=!1;var t=e||r.generateID(8);n(t)&&(this.warningShown||(console.warn("The server ID should not be a number, this will cause issues with the client ID generation."),this.warningShown=!0)),this._id=t}return Object.defineProperty(e.prototype,"id",{get:function(){return this._id},set:function(e){n(e)&&(this.warningShown||(console.warn("The server ID should not be a number, this will cause issues with the client ID generation."),this.warningShown=!0)),this._id=e},enumerable:!1,configurable:!0}),e}(),o={};function s(e,t,n){t&&(t._origin&&(n=t._origin,delete t._origin),Object.keys(t).forEach((function(r){e.addEventListener(r,(function(e){var r;try{r=JSON.parse(e.data)}catch(e){return}if(r.__peerMessage)return r.type===t.type&&r.src===t.src&&r.dst===t.dst&&(e.stopPropagation(),t.callback(r.payload))})),n&&n!==e.origin&&console.warn("Invalid message origin: "+n+" vs "+e.origin)})))}var a=function(){function e(e){var t=e.pc,n=e.payload,r=e.callbacks,i=e.backoff;this.callbacks=r||{},this.pc=t,this.payload=n,this.backoff=i||{maxBackoff:6e4,backoffFactor:10},this.retries=0,this.pending=!0,this.destroyed=!1}return e.prototype.send=function(e){var t=this;if(!this.destroyed){var n=JSON.stringify({__peerMessage:!0,type:this.payload.type,src:this.payload.src,dst:this.payload.dst,payload:e});this.pc.send(n),this.pending=!1,this.sentAt=Date.now(),this.timeout=setTimeout((function(){t.destroyed||t.retry()}),this.backoff.maxBackoff)}this.pc.send(n)},e.prototype.retry=function(){this.retries++;var e=Math.min(this.backoff.maxBackoff,this.backoff.backoffFactor*this.retries);setTimeout((function(){this.destroyed||(this.pending=!0,this.callbacks.timeout&&this.callbacks.timeout(),this.emit("error",new Error("Message timeout"))) }),e)},e.prototype.destroy=function(){this.destroyed=!0,this.timeout&&clearTimeout(this.timeout),this.callbacks.close&&this.callbacks.close()},e}(),c=function(e,t,n,r){if("object"==typeof e){var i=e;t=i.dst,n=i.src,r=i.payload}return"string"==typeof t&&"string"==typeof n&&"object"==typeof r},u=function(){function e(e,t){this.peer=e,this.provider=t,this.options=t.options}return e}(),d=function(){function e(e){this.peer=e,this._events={}}return e.prototype.emit=function(e,t){var n=this._events[e];n&&n.forEach((function(e){e(t)}))},e.prototype.on=function(e,t){this._events[e]||(this._events[e]=[]),this._events[e].push(t)},e.prototype.off=function(e,t){var n=this._events[e];n&&(n=n.filter((function(e){return e!==t})))},e}(),l=function(e){function t(t,n){var r=e.call(this,t)||this;return r.connectionId=n.connectionId,r.label=n.label,r.metadata=n.metadata,r.serialization=n.serialization,r.reliable=n.reliable,r._dc=null,r._negotiator=new c,r}return t}(d),f=function(){function e(e,t,n){this.connection=e,this.label=t,this.options=n}return e}(),h=function(e){function t(t,n){var r=e.call(this,t)||this;return r.mediaConnection=!0,r.stream=n.stream,r._negotiator=new c(r.peer,r),r}return t}(d),p=function(e){function t(t,n){var r=e.call(this,t)||this;return r.label=n.label,r.metadata=n.metadata,r.serialization=n.serialization,r.reliable=n.reliable,r._negotiator=new c(r.peer,r),r}return t}(d),v=function(e){function t(t,n){var r=e.call(this,t)||this;return r.options=n,r._queue=[],r._lastServerReconnect=0,r._reconnectTimer=null,r._disconnected=!1,r._id=n.id,r}return t.prototype._initialize=function(){var e=this;this._ws=new WebSocket(this.options.secure?"wss://":"ws://"+this.options.host+":"+this.options.port+"/peerjs?key="+this.options.key+"&id="+this._id+"&token="+this.options.token),this._ws.onopen=function(){e._sendMessage({type:"OPEN",src:e._id})},this._ws.onmessage=function(t){try{var n=JSON.parse(t.data);c(n)&&e._handleMessage(n)}catch(e){console.error("Invalid server message",t.data)}},this._ws.onclose=function(){e._disconnected||e._reconnect()},this._ws.onerror=function(t){e._emit("error",new Error("Socket error: "+t.message))}},t.prototype._reconnect=function(){var e=this;if(!this._disconnected){var t=Date.now();if(t-this._lastServerReconnect>=this.options.reconnectTimer)this._lastServerReconnect=t,this._ws&&(this._ws.onclose=function(){},this._ws.close()),this._initialize();else{var n=this.options.reconnectTimer-(t-this._lastServerReconnect);this._reconnectTimer&&clearTimeout(this._reconnectTimer),this._reconnectTimer=setTimeout((function(){e._lastServerReconnect=0,e._reconnect()}),n)}}},t.prototype._sendMessage=function(e){this._ws.readyState===WebSocket.OPEN&&this._ws.send(JSON.stringify(e))},t.prototype._handleMessage=function(e){switch(e.type){case"OPEN":this._open=!0,this._emit("open",this._id);break;case"LEAVE":this._emit("close");break;case"CANDIDATE":this._emit("candidate",e);break;case"OFFER":var t={type:"OFFER",payload:e.payload,src:e.src,dst:this._id};this._emit("offer",t);break;case"ANSWER":this._emit("answer",e);break;case"ERROR":this._emit("error",new Error(e.payload.msg))}},t.prototype.destroy=function(){this._disconnected=!0,this._ws&&(this._ws.onclose=function(){},this._ws.close()),this._reconnectTimer&&clearTimeout(this._reconnectTimer),this._emit("close")},t}(),m=function(){function e(e,t){this.peer=t,this.options=e}return e}(),g=function(e,t,n,r){var i,o,s;if(e)try{s=JSON.parse(e)}catch(e){return}if(s&&c(s)){var a=new v(s.src,t);if(a._handleMessage(s),n)return a._emit("message",s.payload)}else if(e&&c(e)){var u=new v(e.src,t);u._handleMessage(e)}else r&&r(new Error("Invalid message"))},y=function(){function e(e,t){if(this._destroyed=!1,this._lastServerId=null,this._connections={},this._lostMessages={},this._options={debug:0,host:"0.peerjs.com",port:443,key:"peerjs",path:"/",token:r.generateID(16),config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"},{urls:"stun:stun2.l.google.com:19302"},{urls:"stun:stun3.l.google.com:19302"},{urls:"stun:stun4.l.google.com:19302"}]},reconnectTimer:5e3,serialization:"binary"},t&&(t.debug&&(this._options.debug=t.debug),t.host&&(this._options.host=t.host),t.port&&(this._options.port=t.port),t.key&&(this._options.key=t.key),t.path&&(this._options.path=t.path),t.token&&(this._options.token=t.token),t.config&&(this._options.config=t.config),t.reliable&&(this._options.reliable=t.reliable),t.serialization&&(this._options.serialization=t.serialization)),this._id=e,this._server=new v(this._id,this._options),this._server.on("open",this._onOpen.bind(this)),this._server.on("close",this._onClose.bind(this)),this._server.on("message",this._onMessage.bind(this)),this._server.on("error",this._onError.bind(this))}return e.prototype._onOpen=function(e){this._destroyed||(this._lastServerId=e,this._emit("open",e))},e.prototype._onClose=function(){this._destroyed||(this._lastServerId=null,this._emit("close"))},e.prototype._onError=function(e){this._destroyed||this._emit("error",e)},e.prototype._onMessage=function(e){this._destroyed||this._emit("message",e)},e.prototype.connect=function(e,t){var n=this;if(this._destroyed)throw new Error("Peer is destroyed");var r=new p(this,e,{label:t&&t.label,metadata:t&&t.metadata,serialization:t&&t.serialization||this._options.serialization,reliable:t&&t.reliable||this._options.reliable});return this._connections[r.connectionId]=r,r._negotiator.startConnection({type:"CONNECT",src:this._id,dst:e}),r},e.prototype.call=function(e,t,n){var r=this;if(this._destroyed)throw new Error("Peer is destroyed");var i=new h(this,e,{stream:t,metadata:n&&n.metadata});return this._connections[i.connectionId]=i,i._negotiator.startConnection({type:"CALL",src:this._id,dst:e}),i},e.prototype.destroy=function(){this._destroyed||(this._destroyed=!0,this._server.destroy(),Object.keys(this._connections).forEach((function(e){var t=r._connections[e];t.close()})),this._emit("close"))},e.prototype._emit=function(e,t){var n=this._events&&this._events[e];n&&n.forEach((function(e){e(t)}))},e.prototype.on=function(e,t){this._events||(this._events={}),this._events[e]||(this._events[e]=[]),this._events[e].push(t)},e.prototype.off=function(e,t){if(this._events&&this._events[e]){var n=this._events[e];this._events[e]=n.filter((function(e){return e!==t}))}},e}(),b=y;return b}));

/* ============================================================
   PremCall v1.0 – Corrected library
   ============================================================ */
(function(global) {
  'use strict';

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

  function log(msg, level) {
    console.log('[PremCall]', msg);
    if (callbacks.onLog) callbacks.onLog(msg, level);
  }

  function notify(event, data) {
    if (callbacks[event]) callbacks[event](data);
  }

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
      notify('onConnected', id);
    });

    peer.on('error', (err) => {
      log('Peer error: ' + err.type + ' – ' + err.message, 'error');
      if (err.type === 'unavailable-id') {
        notify('onError', new Error('Number already taken'));
      } else {
        notify('onError', err);
      }
    });

    peer.on('close', () => {
      log('Connection closed', 'warn');
      notify('offline', null);
      notify('onDisconnected', null);
      if (isInCall) hangup();
    });

    peer.on('disconnected', () => {
      log('Disconnected – reconnecting...', 'warn');
      notify('offline', null);
      notify('onDisconnected', null);
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
      notify('onIncoming', call.peer);
    });
  }

  const PremCall = {
    init(number, options) {
      if (!/^\d{10}$/.test(number)) {
        throw new Error('Number must be exactly 10 digits');
      }
      initPeer(number, options);
    },

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
        notify('onCallStarted', { target, isCaller: true });

        call.on('stream', (remoteStream) => {
          remoteStream = remoteStream;
          notify('onRemoteStream', remoteStream);
        });

        call.on('close', () => {
          PremCall.hangup();
        });

        call.on('error', (err) => {
          log('Call error: ' + err.message, 'error');
          PremCall.hangup();
          notify('onError', err);
        });

        const pc = call.peerConnection;
        if (pc) {
          pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            log('ICE state: ' + state, 'info');
            if (state === 'connected' || state === 'completed') {
              notify('onConnected', null);
            } else if (state === 'failed' || state === 'disconnected') {
              PremCall.hangup();
              notify('onError', new Error('Connection lost'));
            }
          };
        }
      } catch (err) {
        log('Call failed: ' + err.message, 'error');
        throw err;
      }
    },

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
        notify('onCallStarted', { target: caller, isCaller: false });

        currentCall.on('stream', (remoteStream) => {
          remoteStream = remoteStream;
          notify('onRemoteStream', remoteStream);
        });

        currentCall.on('close', () => {
          PremCall.hangup();
        });

        currentCall.on('error', (err) => {
          log('Call error (answer): ' + err.message, 'error');
          PremCall.hangup();
          notify('onError', err);
        });

        const pc = currentCall.peerConnection;
        if (pc) {
          pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            log('ICE state: ' + state, 'info');
            if (state === 'connected' || state === 'completed') {
              notify('onConnected', null);
            } else if (state === 'failed' || state === 'disconnected') {
              PremCall.hangup();
              notify('onError', new Error('Connection lost'));
            }
          };
        }
      } catch (err) {
        log('Answer failed: ' + err.message, 'error');
        throw err;
      }
    },

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
      notify('onCallEnded', null);
      log('Call ended', 'info');
    },

    mute() {
      if (!localStream) return;
      isMuted = !isMuted;
      localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      notify('onMuteToggled', isMuted);
      return isMuted;
    },

    speaker() {
      isSpeakerOn = !isSpeakerOn;
      notify('onSpeakerToggled', isSpeakerOn);
      return isSpeakerOn;
    },

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

    getNumber() { return myNumber; },

    isInCall() { return isInCall; },

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

  global.PremCall = PremCall;

})(window);

/* ============================================================
   UI Logic (originally from index.html)
   ============================================================ */
document.addEventListener('DOMContentLoaded', function() {
  'use strict';

  if (typeof PremCall === 'undefined') {
    const logArea = document.getElementById('logArea');
    if (logArea) {
      logArea.innerHTML = '<div class="log-entry error"><i class="fas fa-triangle-exclamation"></i> Error: PremCall bundle not loaded.</div>';
    }
    return;
  }

  // ─── DOM refs ────────────────────────────────────────────────
  const dialDisplay = document.getElementById('dialDisplay');
  const dialPad = document.getElementById('dialPad');
  const dialCallBtn = document.getElementById('dialCallBtn');
  const checkStatusBtn = document.getElementById('checkStatusBtn');
  const statusResult = document.getElementById('statusResult');
  const logArea = document.getElementById('logArea');
  const incomingOverlay = document.getElementById('incomingOverlay');
  const incomingName = document.getElementById('incomingName');
  const incomingNumber = document.getElementById('incomingNumber');
  const incomingAvatar = document.getElementById('incomingAvatar');
  const answerBtn = document.getElementById('answerBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  const callScreen = document.getElementById('callScreen');
  const callName = document.getElementById('callName');
  const callNumber = document.getElementById('callNumber');
  const callAvatar = document.getElementById('callAvatar');
  const callTimer = document.getElementById('callTimer');
  const callSubstatus = document.getElementById('callSubstatus');
  const hangupCallBtn = document.getElementById('hangupCallBtn');
  const muteBtn = document.getElementById('muteBtn');
  const speakerBtn = document.getElementById('speakerBtn');
  const myNumberDisplay = document.getElementById('myNumberDisplay');
  const headerStatusDot = document.getElementById('headerStatusDot');
  const remoteAudio = document.getElementById('remoteAudio');
  const toast = document.getElementById('toast');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // ─── State ──────────────────────────────────────────────────
  let dialedNumber = '';
  let callTimerInterval = null;
  let toastTimeout = null;
  let pendingCallDirection = null;   // 'outgoing' or 'incoming'

  // ─── Call History ──────────────────────────────────────────
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('premCallHistory')) || []; }
    catch { return []; }
  }
  function saveHistory(h) { localStorage.setItem('premCallHistory', JSON.stringify(h)); }
  function addHistoryEntry(number, direction, duration) {
    const history = getHistory();
    history.unshift({ number, direction, duration: duration || '—', timestamp: Date.now() });
    if (history.length > 50) history.length = 50;
    saveHistory(history);
    renderHistory();
  }
  function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '';
    const history = getHistory();
    if (!history.length) {
      historyList.innerHTML = '<li style="color:#4a5a6a;font-style:italic;">No calls yet</li>';
      return;
    }
    history.forEach(entry => {
      const li = document.createElement('li');
      const dirIcon = entry.direction === 'incoming' ? 'fa-arrow-down' : entry.direction === 'outgoing' ? 'fa-arrow-up' : 'fa-phone-slash';
      const dirClass = entry.direction === 'incoming' ? 'incoming' : entry.direction === 'outgoing' ? 'outgoing' : 'missed';
      const date = new Date(entry.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      li.innerHTML = `<span class="direction ${dirClass}"><i class="fas ${dirIcon}"></i> ${entry.number}</span><span class="time">${entry.duration} · ${timeStr}</span>`;
      historyList.appendChild(li);
    });
  }
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      saveHistory([]);
      renderHistory();
      showToast('History cleared');
    });
  }

  // ─── Toast ──────────────────────────────────────────────────
  function showToast(msg, duration = 2500) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ─── Log ──────────────────────────────────────────────────
  function log(msg, type) {
    if (!logArea) return;
    const now = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry' + (type ? ' ' + type : '');
    entry.textContent = now + ' ' + msg;
    logArea.prepend(entry);
    if (logArea.children.length > 50) logArea.removeChild(logArea.lastChild);
  }

  // ─── Status Dot ──────────────────────────────────────────
  function setStatusDot(state) {
    if (!headerStatusDot) return;
    headerStatusDot.className = 'status-dot ' + state;
  }

  // ─── Get stored number ──────────────────────────────────
  function getStoredNumber() {
    return localStorage.getItem('premCallNumber') || null;
  }

  // ─── Timer ──────────────────────────────────────────────
  function startTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    let seconds = 0;
    callTimerInterval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      if (callTimer) callTimer.textContent = m + ':' + s;
    }, 1000);
    return () => {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
      return seconds;
    };
  }
  let getCallDuration = null;

  // ─── Overlay helpers ────────────────────────────────────
  function showIncomingOverlay(callerId) {
    console.log('[UI] showIncomingOverlay for:', callerId);
    if (!incomingOverlay) {
      console.error('[UI] incomingOverlay missing!');
      return;
    }
    incomingName.textContent = callerId;
    incomingNumber.textContent = callerId;
    incomingAvatar.innerHTML = `<img src="premCall-logo.png" alt="caller" />`;
    incomingOverlay.style.display = 'flex';
    incomingOverlay.classList.add('active');
    showToast('Incoming call from ' + callerId);
    log('Incoming call from ' + callerId, 'warning');
  }

  function hideIncomingOverlay() {
    if (!incomingOverlay) return;
    incomingOverlay.style.display = 'none';
    incomingOverlay.classList.remove('active');
  }

  function showCallScreen(name, isCaller) {
    console.log('[UI] showCallScreen:', name, isCaller ? 'outgoing' : 'incoming');
    if (!callScreen) return;
    callName.textContent = name;
    callNumber.textContent = name;
    callAvatar.innerHTML = `<img src="premCall-logo.png" alt="call" />`;
    callSubstatus.textContent = isCaller ? 'Ringing...' : 'Connecting...';
    callTimer.textContent = '00:00';
    callScreen.style.display = 'flex';
    callScreen.classList.add('active');
    hideIncomingOverlay();
    if (callTimerInterval) clearInterval(callTimerInterval);
    getCallDuration = null;
  }

  function hideCallScreen() {
    if (!callScreen) return;
    callScreen.style.display = 'none';
    callScreen.classList.remove('active');
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimer.textContent = '00:00';
    if (remoteAudio) remoteAudio.srcObject = null;
    if (dialCallBtn) dialCallBtn.classList.remove('disabled');
  }

  // ─── Init PremCall ──────────────────────────────────────────
  function initPremCall() {
    const number = getStoredNumber();
    if (!number) {
      if (myNumberDisplay) myNumberDisplay.textContent = 'Not set';
      setStatusDot('offline');
      log('No number set. Go to settings.', 'warning');
      return;
    }
    if (!/^\d{10}$/.test(number)) {
      if (myNumberDisplay) myNumberDisplay.textContent = 'Invalid';
      setStatusDot('offline');
      log('Stored number is not 10 digits.', 'error');
      return;
    }

    if (myNumberDisplay) myNumberDisplay.textContent = number;
    setStatusDot('connecting');
    log('Initializing with number: ' + number, 'info');

    try {
      PremCall.init(number, {
        onIncoming: (callerId) => {
          console.log('[UI] onIncoming callback:', callerId);
          showIncomingOverlay(callerId);
        },
        onConnected: () => {
          console.log('[UI] onConnected');
          setStatusDot('online');
          if (callSubstatus) callSubstatus.textContent = 'Connected';
          if (!callTimerInterval) {
            getCallDuration = startTimer();
          }
        },
        onDisconnected: () => {
          console.log('[UI] onDisconnected');
          setStatusDot('offline');
        },
        onRemoteStream: (stream) => {
          console.log('[UI] onRemoteStream');
          if (remoteAudio) {
            remoteAudio.srcObject = stream;
            remoteAudio.muted = false;
            remoteAudio.play().catch(() => {
              document.addEventListener('click', () => remoteAudio.play(), { once: true });
              document.addEventListener('touchstart', () => remoteAudio.play(), { once: true });
            });
          }
          if (callSubstatus) callSubstatus.textContent = 'Connected';
        },
        onCallStarted: (data) => {
          console.log('[UI] onCallStarted:', data);
          pendingCallDirection = data.isCaller ? 'outgoing' : 'incoming';
          showCallScreen(data.target, data.isCaller);
        },
        onCallEnded: () => {
          console.log('[UI] onCallEnded');
          let duration = '—';
          if (getCallDuration) {
            const secs = getCallDuration();
            const m = String(Math.floor(secs / 60)).padStart(2, '0');
            const s = String(secs % 60).padStart(2, '0');
            duration = m + ':' + s;
            getCallDuration = null;
          }
          const currentNumber = callNumber ? callNumber.textContent : '';
          if (currentNumber && currentNumber !== 'Calling...' && currentNumber !== '+1234567890') {
            const dir = pendingCallDirection || 'incoming';
            addHistoryEntry(currentNumber, dir, duration);
          }
          pendingCallDirection = null;
          hideCallScreen();
          hideIncomingOverlay();
          showToast('Call ended');
        },
        onError: (err) => {
          console.error('[UI] onError:', err);
          log('Error: ' + err.message, 'error');
          showToast('Error: ' + err.message);
          setStatusDot('offline');
        },
        onLog: (msg, level) => {
          log(msg, level);
        }
      });
      setStatusDot('online');
    } catch (err) {
      log('Init failed: ' + err.message, 'error');
      setStatusDot('offline');
      showToast('Init failed: ' + err.message);
    }
  }

  // ─── Dialer ──────────────────────────────────────────────────
  if (dialPad) {
    dialPad.addEventListener('click', (e) => {
      const key = e.target.closest('.key');
      if (!key) return;
      const digit = key.dataset.digit;
      const action = key.dataset.action;
      if (digit) {
        if (dialedNumber.length < 15) {
          dialedNumber += digit;
          if (dialDisplay) dialDisplay.textContent = dialedNumber;
        }
      } else if (action === 'delete') {
        dialedNumber = dialedNumber.slice(0, -1);
        if (dialDisplay) dialDisplay.textContent = dialedNumber || 'Enter number';
        if (!dialedNumber && dialDisplay) dialDisplay.innerHTML = '<span class="hint"><i class="fas fa-phone"></i> Enter 10-digit number</span>';
      } else if (action === 'clear') {
        dialedNumber = '';
        if (dialDisplay) dialDisplay.innerHTML = '<span class="hint"><i class="fas fa-phone"></i> Enter 10-digit number</span>';
      } else if (action === 'call') {
        if (!dialedNumber || !/^\d{10}$/.test(dialedNumber)) {
          showToast('Enter exactly 10 digits');
          return;
        }
        if (dialCallBtn) dialCallBtn.classList.add('disabled');
        try {
          PremCall.call(dialedNumber);
        } catch (err) {
          showToast('Call failed: ' + err.message);
          if (dialCallBtn) dialCallBtn.classList.remove('disabled');
        }
      }
    });
  }

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      if (dialedNumber.length < 15) {
        dialedNumber += e.key;
        if (dialDisplay) dialDisplay.textContent = dialedNumber;
      }
    } else if (e.key === 'Backspace') {
      dialedNumber = dialedNumber.slice(0, -1);
      if (dialDisplay) dialDisplay.textContent = dialedNumber || 'Enter number';
      if (!dialedNumber && dialDisplay) dialDisplay.innerHTML = '<span class="hint"><i class="fas fa-phone"></i> Enter 10-digit number</span>';
    } else if (e.key === 'Enter') {
      if (dialedNumber && /^\d{10}$/.test(dialedNumber)) {
        PremCall.call(dialedNumber);
      }
    }
  });

  // ─── Call Screen Controls ──────────────────────────────────
  if (hangupCallBtn) {
    hangupCallBtn.addEventListener('click', () => {
      PremCall.hangup();
      if (dialCallBtn) dialCallBtn.classList.remove('disabled');
    });
  }
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = PremCall.mute();
      muteBtn.innerHTML = muted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
      muteBtn.className = muted ? 'mute active' : 'mute';
      showToast(muted ? 'Muted' : 'Unmuted');
    });
  }
  if (speakerBtn) {
    speakerBtn.addEventListener('click', () => {
      const on = PremCall.speaker();
      speakerBtn.className = on ? 'speaker active' : 'speaker';
      speakerBtn.innerHTML = on ? '<i class="fas fa-volume-high"></i>' : '<i class="fas fa-volume-xmark"></i>';
      showToast(on ? 'Speaker on' : 'Earpiece');
    });
  }

  // ─── Incoming Overlay Buttons ──────────────────────────────
  if (answerBtn) {
    answerBtn.addEventListener('click', async () => {
      try {
        await PremCall.answer();
        hideIncomingOverlay();
      } catch (err) {
        showToast('Answer failed: ' + err.message);
      }
    });
  }
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      const caller = incomingName ? incomingName.textContent : '';
      PremCall.hangup();
      hideIncomingOverlay();
      if (caller && caller !== 'Unknown') {
        addHistoryEntry(caller, 'missed', '—');
      }
      showToast('Call rejected');
    });
  }

  // ─── Check Status ──────────────────────────────────────────
  if (checkStatusBtn) {
    checkStatusBtn.addEventListener('click', async () => {
      const num = dialedNumber || prompt('Enter 10-digit number to check:');
      if (!num) return;
      if (!/^\d{10}$/.test(num)) {
        if (statusResult) statusResult.textContent = 'Invalid number';
        return;
      }
      if (statusResult) statusResult.textContent = 'Checking...';
      try {
        const online = await PremCall.checkStatus(num);
        if (statusResult) statusResult.textContent = online ? '✅ Online' : '❌ Offline';
      } catch (err) {
        if (statusResult) statusResult.textContent = 'Error';
      }
    });
  }

  // ─── Auto‑init ──────────────────────────────────────────────
  initPremCall();
  renderHistory();

  // Auto‑dial from URL ?number=...
  (function autoLoad() {
    const params = new URLSearchParams(window.location.search);
    const num = params.get('number');
    if (num && /^\d{10}$/.test(num)) {
      dialedNumber = num;
      if (dialDisplay) dialDisplay.textContent = num;
      setTimeout(() => {
        try { PremCall.call(num); } catch (e) {}
      }, 1500);
    }
  })();

  log('UI ready.', 'success');
});