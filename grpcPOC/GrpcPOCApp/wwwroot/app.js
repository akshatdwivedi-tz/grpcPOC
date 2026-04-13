/* =========================================================================
   gRPC POC — Frontend JavaScript
   Demonstrates all four gRPC communication modes via REST/SSE bridge.
   ========================================================================= */

'use strict';

// ── Tab switching ──────────────────────────────────────────────────────────
function showTab(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  event.currentTarget.classList.add('active');
}

// ── Shared helpers ─────────────────────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function appendLog(boxId, text, cls = 'info') {
  const box = document.getElementById(boxId);
  const el  = document.createElement('div');
  el.className = 'entry ' + cls;
  el.innerHTML = `<span class="ts">${now()}</span>${text}`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function clearLog(boxId) {
  document.getElementById(boxId).innerHTML = '';
}

// ── MODE 1: UNARY RPC ──────────────────────────────────────────────────────
async function unarySend() {
  const sender  = document.getElementById('u-sender').value.trim()  || 'Anonymous';
  const content = document.getElementById('u-content').value.trim();
  if (!content) { appendLog('u-log', 'Please enter a message.', 'error'); return; }

  appendLog('u-log', `Sending: <span class="sender">${sender}</span>: "${content}"`, 'info');

  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId:   'user-' + sender.toLowerCase().replace(/\s/g, '-'),
        senderName: sender,
        content:    content
      })
    });

    const data = await res.json();
    if (data.success) {
      appendLog('u-log',
        `✓ Message saved — ID: <strong>${data.messageId}</strong> | "${data.message}"`,
        'success');
      document.getElementById('u-content').value = '';
    } else {
      appendLog('u-log', `✗ Server error: ${data.message}`, 'error');
    }
  } catch (err) {
    appendLog('u-log', `✗ Network error: ${err.message}`, 'error');
  }
}

// ── MODE 2: SERVER STREAMING RPC ───────────────────────────────────────────
function serverStream() {
  const limit  = parseInt(document.getElementById('ss-limit').value)  || 10;
  const offset = parseInt(document.getElementById('ss-offset').value) || 0;

  clearLog('ss-log');
  appendLog('ss-log', `Opening stream — limit=${limit}, offset=${offset}`, 'info');

  const url = `/api/chat/history?limit=${limit}&offset=${offset}`;
  const es  = new EventSource(url);
  let count = 0;

  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    count++;
    appendLog('ss-log',
      `#${msg.id} <span class="sender">${msg.senderName}</span>: "${msg.content}"`,
      'msg');
  };

  es.addEventListener('done', () => {
    appendLog('ss-log',
      count === 0
        ? 'Stream complete — no messages found (send some in Mode 1 first).'
        : `Stream complete — received ${count} message(s).`,
      'success');
    es.close();
  });

  es.onerror = () => {
    appendLog('ss-log', 'Stream ended / error.', 'error');
    es.close();
  };
}

// ── MODE 3: CLIENT STREAMING RPC ───────────────────────────────────────────
let csQueue = [];

function csAddToQueue() {
  const sender  = document.getElementById('cs-sender').value.trim()  || 'Anonymous';
  const content = document.getElementById('cs-content').value.trim();
  if (!content) { return; }

  csQueue.push({
    senderId:   'user-' + sender.toLowerCase().replace(/\s/g, '-'),
    senderName: sender,
    content:    content
  });

  document.getElementById('cs-content').value = '';
  renderQueue();
}

function renderQueue() {
  const box = document.getElementById('cs-queue');
  if (csQueue.length === 0) {
    box.innerHTML = '<em style="color:#475569">Queue is empty — add messages above.</em>';
    document.getElementById('cs-upload-btn').disabled = true;
    return;
  }

  box.innerHTML = csQueue.map((m, i) =>
    `<div class="queue-item">
       <span><span class="sender">${m.senderName}</span>: ${m.content}</span>
       <span style="color:#64748b">#${i + 1}</span>
     </div>`
  ).join('');
  document.getElementById('cs-upload-btn').disabled = false;
}

function csClearQueue() {
  csQueue = [];
  renderQueue();
  clearLog('cs-log');
  appendLog('cs-log', 'Queue cleared.', 'info');
}

async function csBulkUpload() {
  if (csQueue.length === 0) { return; }
  const batch = [...csQueue];

  appendLog('cs-log',
    `Client streaming ${batch.length} message(s) to server…`, 'info');

  try {
    const res = await fetch('/api/chat/bulk-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });

    const data = await res.json();
    if (data.success) {
      appendLog('cs-log',
        `✓ ${data.message} (${data.messagesUploaded} saved)`, 'success');
      csQueue = [];
      renderQueue();
    } else {
      appendLog('cs-log', `✗ Error: ${data.message}`, 'error');
    }
  } catch (err) {
    appendLog('cs-log', `✗ Network error: ${err.message}`, 'error');
  }
}

// ── MODE 4: BIDIRECTIONAL STREAMING RPC ────────────────────────────────────
let bidiES   = null;
let myName   = '';

function setDot(state) {  // 'green' | 'yellow' | 'red' | ''
  const dot = document.getElementById('bidi-dot');
  dot.className = 'dot ' + state;
}

function bidiConnect() {
  myName = document.getElementById('bidi-name').value.trim() || 'User';

  if (bidiES) { bidiES.close(); }

  setDot('yellow');
  document.getElementById('bidi-status').textContent = 'Connecting…';

  bidiES = new EventSource('/api/chat/live-stream');

  bidiES.onopen = () => {
    setDot('green');
    document.getElementById('bidi-status').textContent =
      `Connected as ${myName} — server is streaming in real-time`;
    document.getElementById('bidi-send-btn').disabled    = false;
    document.getElementById('bidi-disc-btn').disabled    = false;
    document.getElementById('bidi-connect-btn').disabled = true;
    appendBidiMsg({ senderName: '⚡ System', content: 'Bidirectional stream opened.' }, true);
  };

  bidiES.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const isMe = msg.senderName === myName;
    appendBidiMsg(msg, isMe);
  };

  bidiES.onerror = () => {
    setDot('red');
    document.getElementById('bidi-status').textContent = 'Stream error or server closed.';
    bidiDisconnect();
  };
}

function appendBidiMsg(msg, isMe) {
  const box = document.getElementById('bidi-chat');
  const el  = document.createElement('div');
  el.className = 'chat-bubble ' + (isMe ? 'me' : 'other');
  el.innerHTML =
    `<div class="sender">${msg.senderName} · ${now()}</div>` +
    `<div class="text">${msg.content}</div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

async function bidiSend() {
  const content = document.getElementById('bidi-content').value.trim();
  if (!content || !bidiES) return;

  document.getElementById('bidi-content').value = '';

  try {
    await fetch('/api/chat/live-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId:   'user-' + myName.toLowerCase().replace(/\s/g, '-'),
        senderName: myName,
        content:    content
      })
    });
    // The SSE stream will deliver the echo back (including to this client)
  } catch (err) {
    appendBidiMsg({ senderName: '⚠ Error', content: err.message }, true);
  }
}

function bidiDisconnect() {
  if (bidiES) { bidiES.close(); bidiES = null; }
  setDot('red');
  document.getElementById('bidi-status').textContent = 'Disconnected.';
  document.getElementById('bidi-send-btn').disabled    = true;
  document.getElementById('bidi-disc-btn').disabled    = true;
  document.getElementById('bidi-connect-btn').disabled = false;
}

// ── Key bindings ───────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const active = document.querySelector('.panel.active');
    if (!active) return;

    switch (active.id) {
      case 'tab-unary':         unarySend();   break;
      case 'tab-client-stream': csAddToQueue(); break;
    }
  }
});
