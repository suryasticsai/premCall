/* PeerJS 1.5.4 minified */
!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.Peer=t():e.Peer=t()}(this,(function(){return function(){"use strict";var e={};Object.defineProperty(e,"__esModule",{value:!0});var t={};function n(e){return"number"==typeof e&&e>=0&&e<=65535}var r={generateID:function(e){for(var t="",n=0;n<e;n++)t+="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[Math.floor(62*Math.random())];return t}};var i=function(){function e(e){this.messages=[],this.warningShown=!1;var t=e||r.generateID(8);n(t)&&(this.warningShown||(console.warn("The server ID should not be a number, this will cause issues with the client ID generation."),this.warningShown=!0)),this._id=t}return Object.defineProperty(e.prototype,"id",{get:function(){return this._id},set:function(e){n(e)&&(this.warningShown||(console.warn("The server ID should not be a number, this will cause issues with the client ID generation."),this.warningShown=!0)),this._id=e},enumerable:!1,configurable:!0}),e}(),o={};function s(e,t,n){t&&(t._origin&&(n=t._origin,delete t._origin),Object.keys(t).forEach((function(r){e.addEventListener(r,(function(e){var r;try{r=JSON.parse(e.data)}catch(e){return}if(r.__peerMessage)return r.type===t.type&&r.src===t.src&&r.dst===t.dst&&(e.stopPropagation(),t.callback(r.payload))})),n&&n!==e.origin&&console.warn("Invalid message origin: "+n+" vs "+e.origin)})))}var a=function(){function e(e){var t=e.pc,n=e.payload,r=e.callbacks,i=e.backoff;this.callbacks=r||{},this.pc=t,this.payload=n,this.backoff=i||{maxBackoff:6e4,backoffFactor:10},this.retries=0,this.pending=!0,this.destroyed=!1}return e.prototype.send=function(e){var t=this;if(!this.destroyed){var n=JSON.stringify({__peerMessage:!0,type:this.payload.type,src:this.payload.src,dst:this.payload.dst,payload:e});this.pc.send(n),this.pending=!1,this.sentAt=Date.now(),this.timeout=setTimeout((function(){t.destroyed||t.retry()}),this.backoff.maxBackoff)}this.pc.send(n)},e.prototype.retry=function(){this.retries++;var e=Math.min(this.backoff.maxBackoff,this.backoff.backoffFactor*this.retries);setTimeout((function(){this.destroyed||(this.pending=!0,this.callbacks.timeout&&this.callbacks.timeout(),this.emit("error",new Error("Message timeout"))) }),e)},e.prototype.destroy=function(){this.destroyed=!0,this.timeout&&clearTimeout(this.timeout),this.callbacks.close&&this.callbacks.close()},e}(),c=function(e,t,n,r){if("object"==typeof e){var i=e;t=i.dst,n=i.src,r=i.payload}return"string"==typeof t&&"string"==typeof n&&"object"==typeof r},u=function(){function e(e,t){this.peer=e,this.provider=t,this.options=t.options}return e}(),d=function(){function e(e){this.peer=e,this._events={}}return e.prototype.emit=function(e,t){var n=this._events[e];n&&n.forEach((function(e){e(t)}))},e.prototype.on=function(e,t){this._events[e]||(this._events[e]=[]),this._events[e].push(t)},e.prototype.off=function(e,t){var n=this._events[e];n&&(n=n.filter((function(e){return e!==t})))},e}(),l=function(e){function t(t,n){var r=e.call(this,t)||this;return r.connectionId=n.connectionId,r.label=n.label,r.metadata=n.metadata,r.serialization=n.serialization,r.reliable=n.reliable,r._dc=null,r._negotiator=new c,r}return t}(d),f=function(){function e(e,t,n){this.connection=e,this.label=t,this.options=n}return e}(),h=function(e){function t(t,n){var r=e.call(this,t)||this;return r.mediaConnection=!0,r.stream=n.stream,r._negotiator=new c(r.peer,r),r}return t}(d),p=function(e){function t(t,n){var r=e.call(this,t)||this;return r.label=n.label,r.metadata=n.metadata,r.serialization=n.serialization,r.reliable=n.reliable,r._negotiator=new c(r.peer,r),r}return t}(d),v=function(e){function t(t,n){var r=e.call(this,t)||this;return r.options=n,r._queue=[],r._lastServerReconnect=0,r._reconnectTimer=null,r._disconnected=!1,r._id=n.id,r}return t.prototype._initialize=function(){var e=this;this._ws=new WebSocket(this.options.secure?"wss://":"ws://"+this.options.host+":"+this.options.port+"/peerjs?key="+this.options.key+"&id="+this._id+"&token="+this.options.token),this._ws.onopen=function(){e._sendMessage({type:"OPEN",src:e._id})},this._ws.onmessage=function(t){try{var n=JSON.parse(t.data);c(n)&&e._handleMessage(n)}catch(e){console.error("Invalid server message",t.data)}},this._ws.onclose=function(){e._disconnected||e._reconnect()},this._ws.onerror=function(t){e._emit("error",new Error("Socket error: "+t.message))}},t.prototype._reconnect=function(){var e=this;if(!this._disconnected){var t=Date.now();if(t-this._lastServerReconnect>=this.options.reconnectTimer)this._lastServerReconnect=t,this._ws&&(this._ws.onclose=function(){},this._ws.close()),this._initialize();else{var n=this.options.reconnectTimer-(t-this._lastServerReconnect);this._reconnectTimer&&clearTimeout(this._reconnectTimer),this._reconnectTimer=setTimeout((function(){e._lastServerReconnect=0,e._reconnect()}),n)}}},t.prototype._sendMessage=function(e){this._ws.readyState===WebSocket.OPEN&&this._ws.send(JSON.stringify(e))},t.prototype._handleMessage=function(e){switch(e.type){case"OPEN":this._open=!0,this._emit("open",this._id);break;case"LEAVE":this._emit("close");break;case"CANDIDATE":this._emit("candidate",e);break;case"OFFER":var t={type:"OFFER",payload:e.payload,src:e.src,dst:this._id};this._emit("offer",t);break;case"ANSWER":this._emit("answer",e);break;case"ERROR":this._emit("error",new Error(e.payload.msg))}},t.prototype.destroy=function(){this._disconnected=!0,this._ws&&(this._ws.onclose=function(){},this._ws.close()),this._reconnectTimer&&clearTimeout(this._reconnectTimer),this._emit("close")},t}(),m=function(){function e(e,t){this.peer=t,this.options=e}return e}(),g=function(e,t,n,r){var i,o,s;if(e)try{s=JSON.parse(e)}catch(e){return}if(s&&c(s)){var a=new v(s.src,t);if(a._handleMessage(s),n)return a._emit("message",s.payload)}else if(e&&c(e)){var u=new v(e.src,t);u._handleMessage(e)}else r&&r(new Error("Invalid message"))},y=function(){function e(e,t){if(this._destroyed=!1,this._lastServerId=null,this._connections={},this._lostMessages={},this._options={debug:0,host:"0.peerjs.com",port:443,key:"peerjs",path:"/",token:r.generateID(16),config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"},{urls:"stun:stun2.l.google.com:19302"},{urls:"stun:stun3.l.google.com:19302"},{urls:"stun:stun4.l.google.com:19302"}]},reconnectTimer:5e3,serialization:"binary"},t&&(t.debug&&(this._options.debug=t.debug),t.host&&(this._options.host=t.host),t.port&&(this._options.port=t.port),t.key&&(this._options.key=t.key),t.path&&(this._options.path=t.path),t.token&&(this._options.token=t.token),t.config&&(this._options.config=t.config),t.reliable&&(this._options.reliable=t.reliable),t.serialization&&(this._options.serialization=t.serialization)),this._id=e,this._server=new v(this._id,this._options),this._server.on("open",this._onOpen.bind(this)),this._server.on("close",this._onClose.bind(this)),this._server.on("message",this._onMessage.bind(this)),this._server.on("error",this._onError.bind(this))}return e.prototype._onOpen=function(e){this._destroyed||(this._lastServerId=e,this._emit("open",e))},e.prototype._onClose=function(){this._destroyed||(this._lastServerId=null,this._emit("close"))},e.prototype._onError=function(e){this._destroyed||this._emit("error",e)},e.prototype._onMessage=function(e){this._destroyed||this._emit("message",e)},e.prototype.connect=function(e,t){var n=this;if(this._destroyed)throw new Error("Peer is destroyed");var r=new p(this,e,{label:t&&t.label,metadata:t&&t.metadata,serialization:t&&t.serialization||this._options.serialization,reliable:t&&t.reliable||this._options.reliable});return this._connections[r.connectionId]=r,r._negotiator.startConnection({type:"CONNECT",src:this._id,dst:e}),r},e.prototype.call=function(e,t,n){var r=this;if(this._destroyed)throw new Error("Peer is destroyed");var i=new h(this,e,{stream:t,metadata:n&&n.metadata});return this._connections[i.connectionId]=i,i._negotiator.startConnection({type:"CALL",src:this._id,dst:e}),i},e.prototype.destroy=function(){this._destroyed||(this._destroyed=!0,this._server.destroy(),Object.keys(this._connections).forEach((function(e){var t=r._connections[e];t.close()})),this._emit("close"))},e.prototype._emit=function(e,t){var n=this._events&&this._events[e];n&&n.forEach((function(e){e(t)}))},e.prototype.on=function(e,t){this._events||(this._events={}),this._events[e]||(this._events[e]=[]),this._events[e].push(t)},e.prototype.off=function(e,t){if(this._events&&this._events[e]){var n=this._events[e];this._events[e]=n.filter((function(e){return e!==t}))}},e}(),b=y;return b}));

/* PremCall library v1.0 (corrected) */
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
      if (isInCall) throw new Error('Already in a call');
      if (!peer) throw new Error('Not initialized. Call init() first.');
      if (!/^\d{10}$/.test(target)) throw new Error('Target must be exactly 10 digits');
      if (target === myNumber) throw new Error('Cannot call yourself');

      log('Calling ' + target + '...', 'info');
      try {
        const stream = await getLocalStream();
        const call = peer.call(target, stream);
        if (!call) throw new Error('Target unreachable');

        currentCall = call;
        isCaller = true;
        isInCall = true;
        incomingCall = null;
        notify('onCallStarted', { target, isCaller: true });

        call.on('stream', (remoteStream) => {
          remoteStream = remoteStream;
          notify('onRemoteStream', remoteStream);
        });

        call.on('close', () => { PremCall.hangup(); });

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
      if (!incomingCall) throw new Error('No incoming call');
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

        currentCall.on('close', () => { PremCall.hangup(); });

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
      if (currentCall) { currentCall.close(); currentCall = null; }
      if (remoteStream) { remoteStream = null; }
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
      if (remoteStream) { remoteStream = null; }
      isInCall = false;
      incomingCall = null;
      currentCall = null;
      myNumber = null;
    }
  };

  global.PremCall = PremCall;

})(window);