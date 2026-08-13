/* ============================================================
   PremCall Chat v1.0
   Adds WhatsApp-like text messaging to PremCall.
   Must be loaded AFTER premcall.min.js (or any PremCall lib).
   ============================================================ */
(function(global) {
  'use strict';

  if (typeof PremCall === 'undefined') {
    console.error('[PremCall-Chat] PremCall not found. Load premcall.min.js first.');
    return;
  }

  // ---------- Messaging core (patch PremCall) ----------
  let myNumber = null;
  let peer = null;
  const messageListeners = new Set();
  let originalCallbacks = {};

  // Patch PremCall.init to capture peer and set up data listeners
  const originalInit = PremCall.init;
  if (typeof originalInit === 'function' && !PremCall.__chatPatched) {
    PremCall.init = function(number, options) {
      myNumber = number;
      originalCallbacks = options || {};

      // Temporarily wrap global Peer constructor to capture the instance
      const OriginalPeer = global.Peer;
      let capturedPeer = null;
      global.Peer = function(...args) {
        const p = new OriginalPeer(...args);
        capturedPeer = p;
        return p;
      };

      originalInit.call(PremCall, number, options);

      // Restore Peer
      global.Peer = OriginalPeer;
      peer = capturedPeer;

      // Set up incoming data connections
      if (peer) {
        peer.on('connection', (conn) => {
          conn.on('data', (data) => {
            try {
              const msg = JSON.parse(data);
              if (msg && msg.type === 'premcall-message') {
                const message = {
                  from: msg.from,
                  text: msg.text,
                  timestamp: msg.timestamp || Date.now(),
                  direction: 'incoming'
                };
                // Notify internal chat UI and external listeners
                chatUI.handleIncoming(message);
                messageListeners.forEach(cb => cb(message));
                if (typeof originalCallbacks.onMessage === 'function') {
                  originalCallbacks.onMessage(message);
                }
              }
            } catch (e) {
              console.warn('[PremCall-Chat] Invalid message data', e);
            }
          });
        });
      }
    };
    PremCall.__chatPatched = true;
  }

  // Add sendMessage method
  PremCall.sendMessage = function(target, text) {
    return new Promise((resolve, reject) => {
      if (!peer) return reject(new Error('PremCall not initialized.'));
      if (!/^\d{10}$/.test(target)) return reject(new Error('Target must be 10 digits.'));
      if (!text || typeof text !== 'string' || text.trim().length === 0)
        return reject(new Error('Message cannot be empty.'));

      const payload = {
        type: 'premcall-message',
        from: myNumber,
        text: text.trim(),
        timestamp: Date.now()
      };

      const conn = peer.connect(target, { reliable: true });
      let done = false;
      conn.on('open', () => {
        conn.send(JSON.stringify(payload));
        if (!done) {
          done = true;
          resolve({ target, text: payload.text, timestamp: payload.timestamp, direction: 'outgoing' });
          setTimeout(() => { try { conn.close(); } catch(e) {} }, 500);
        }
      });
      conn.on('error', (err) => { if (!done) { done = true; reject(err); } });
      setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error('Send timeout'));
          try { conn.close(); } catch(e) {}
        }
      }, 5000);
    });
  };

  PremCall.onMessage = function(cb) { if (typeof cb === 'function') messageListeners.add(cb); };
  PremCall.offMessage = function(cb) { messageListeners.delete(cb); };

  // ---------- Chat UI ----------
  const chatUI = (function() {
    // State
    const conversations = new Map(); // key: peer number, value: array of messages
    let activePeer = null;
    let overlay = null;
    let msgList = null;
    let input = null;
    let sendBtn = null;
    let backBtn = null;
    let headerTitle = null;

    // Load from localStorage
    function loadConversations() {
      try {
        const data = JSON.parse(localStorage.getItem('premCallChats') || '{}');
        Object.keys(data).forEach(key => {
          conversations.set(key, data[key]);
        });
      } catch(e) {}
    }
    function saveConversations() {
      const obj = {};
      conversations.forEach((msgs, peer) => { obj[peer] = msgs; });
      localStorage.setItem('premCallChats', JSON.stringify(obj));
    }

    // Build UI
    function buildUI() {
      if (overlay) return;

      overlay = document.createElement('div');
      overlay.id = 'premcall-chat-overlay';
      overlay.style.cssText = `
        position:fixed; inset:0; z-index:10000; display:none;
        background:var(--bg-0,#05070d); color:var(--text,#eef2fb);
        font-family:var(--font-body,'Inter',sans-serif);
        flex-direction:column;
      `;

      // Header
      const header = document.createElement('div');
      header.style.cssText = `
        display:flex; align-items:center; padding:0.8rem 1rem;
        background:var(--surface,#0e1424); border-bottom:1px solid var(--line,#1e2a42);
      `;
      backBtn = document.createElement('button');
      backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
      backBtn.style.cssText = 'background:none;border:none;color:var(--text);font-size:1.3rem;cursor:pointer;';
      headerTitle = document.createElement('div');
      headerTitle.style.cssText = 'flex:1;text-align:center;font-weight:700;font-size:1.1rem;';
      header.appendChild(backBtn);
      header.appendChild(headerTitle);

      // Messages area
      msgList = document.createElement('div');
      msgList.style.cssText = 'flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;';

      // Input area
      const inputArea = document.createElement('div');
      inputArea.style.cssText = 'display:flex;gap:0.5rem;padding:0.8rem;background:var(--surface);border-top:1px solid var(--line);';
      input = document.createElement('input');
      input.placeholder = 'Type a message...';
      input.style.cssText = 'flex:1;padding:0.6rem 1rem;border-radius:20px;border:1px solid var(--line);background:var(--bg-0);color:var(--text);outline:none;';
      sendBtn = document.createElement('button');
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      sendBtn.style.cssText = 'background:var(--signal,#4f8cf7);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;';
      inputArea.appendChild(input);
      inputArea.appendChild(sendBtn);

      overlay.appendChild(header);
      overlay.appendChild(msgList);
      overlay.appendChild(inputArea);
      document.body.appendChild(overlay);

      backBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
        activePeer = null;
      });

      sendBtn.addEventListener('click', sendMessage);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
    }

    // Render messages for active peer
    function renderMessages() {
      if (!msgList || !activePeer) return;
      msgList.innerHTML = '';
      const msgs = conversations.get(activePeer) || [];
      msgs.forEach(msg => {
        const bubble = document.createElement('div');
        const isOutgoing = msg.direction === 'outgoing';
        bubble.style.cssText = `
          max-width:80%; align-self:${isOutgoing ? 'flex-end' : 'flex-start'};
          background:${isOutgoing ? 'var(--signal,#4f8cf7)' : 'var(--surface-2,#141c30)'};
          color:${isOutgoing ? '#fff' : 'var(--text)'};
          padding:0.6rem 0.9rem; border-radius:15px; font-size:0.9rem;
        `;
        bubble.textContent = msg.text;
        msgList.appendChild(bubble);
      });
      msgList.scrollTop = msgList.scrollHeight;
    }

    // Open chat with a peer
    function openChat(peerNumber) {
      if (!overlay) buildUI();
      activePeer = peerNumber;
      headerTitle.textContent = peerNumber;
      overlay.style.display = 'flex';
      renderMessages();
      input.focus();
    }

    // Add a message to conversation
    function addMessage(peerNumber, msg) {
      if (!conversations.has(peerNumber)) conversations.set(peerNumber, []);
      conversations.get(peerNumber).push(msg);
      saveConversations();
      if (activePeer === peerNumber) {
        renderMessages();
      } else {
        // update toast or conversation list (we don't show list for now)
        showToast(`New message from ${peerNumber}: ${msg.text}`);
      }
    }

    // Handle incoming message
    function handleIncoming(msg) {
      addMessage(msg.from, msg);
      // Optionally vibrate
      if (navigator.vibrate) navigator.vibrate(50);
    }

    // Send message
    function sendMessage() {
      if (!activePeer || !input) return;
      const text = input.value.trim();
      if (!text) return;
      PremCall.sendMessage(activePeer, text)
        .then(result => {
          addMessage(activePeer, {
            from: myNumber,
            text: text,
            timestamp: Date.now(),
            direction: 'outgoing'
          });
          input.value = '';
        })
        .catch(err => {
          showToast('Send failed: ' + err.message);
        });
    }

    // Simple toast (reuse existing if available)
    function showToast(msg) {
      let toast = document.getElementById('toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
          position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
          background:var(--surface-3,#1b2540); border:1px solid var(--line);
          color:var(--text); padding:0.7rem 1.3rem; border-radius:40px;
          font-size:0.85rem; z-index:11000; opacity:0; transition:opacity .3s;
        `;
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.style.opacity = '0', 2500);
    }

    // Hook into existing dialpad message button
    function hookDialer() {
      const messageKey = document.querySelector('[data-action="message"]');
      if (messageKey) {
        messageKey.addEventListener('click', () => {
          const dialDisplay = document.getElementById('dialText') || document.getElementById('dialDisplay');
          let number = '';
          if (dialDisplay) {
            number = dialDisplay.textContent.replace(/\D/g, '').slice(0,10);
          }
          if (/^\d{10}$/.test(number)) {
            openChat(number);
          } else {
            // prompt
            const input = prompt('Enter 10-digit number to chat with:');
            if (input && /^\d{10}$/.test(input)) openChat(input);
          }
        });
      }
    }

    // Init
    loadConversations();
    buildUI();
    hookDialer();

    return { handleIncoming, openChat };
  })();

  console.log('[PremCall-Chat] Chat module loaded.');
})(window);