const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const viewers = new Set();
const partyRooms = new Map();
const GAME_PAGE = fs.readFileSync(path.join(__dirname, '..', 'hell-agency.html'), 'utf8');
const THREE_BUNDLE = fs.readFileSync(path.join(__dirname, '..', 'three.min.js'), 'utf8');

function sendJson(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

function broadcastRoom(room, message, except) {
  const payload = JSON.stringify(message);
  for (const client of room.clients.values()) {
    if (client.ws !== except && client.ws.readyState === 1) client.ws.send(payload);
  }
}

function leaveParty(ws) {
  const room = ws.partyRoom;
  if (!room || !ws.playerId) return;
  const playerId = ws.playerId;
  room.clients.delete(playerId);
  ws.partyRoom = null;
  ws.playerId = null;
  broadcastRoom(room, { type: 'leave', id: playerId });
  if (room.clients.size === 0) {
    partyRooms.delete(room.code);
  } else if (room.hostId === playerId) {
    room.hostId = room.clients.keys().next().value;
    broadcastRoom(room, { type: 'host', hostId: room.hostId });
  }
}

function handlePartyMessage(ws, data) {
  if (data.length > 8192) {
    ws.close(1009, 'Message too large');
    return;
  }

  let message;
  try {
    message = JSON.parse(data.toString());
  } catch {
    sendJson(ws, { type: 'error', message: 'Messaggio online non valido.' });
    return;
  }

  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'join') {
    if (ws.partyRoom) {
      sendJson(ws, { type: 'error', message: 'Sei già in una stanza.' });
      return;
    }
    const code = typeof message.room === 'string' ? message.room.toUpperCase() : '';
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      sendJson(ws, { type: 'error', message: 'Il codice stanza deve avere da 4 a 8 lettere o numeri.' });
      return;
    }

    let room = partyRooms.get(code);
    if (room && room.clients.size >= 4) {
      sendJson(ws, { type: 'error', message: 'Stanza piena (massimo 4 agenti).' });
      return;
    }
    if (!room) {
      room = { code, hostId: null, clients: new Map() };
      partyRooms.set(code, room);
    }

    const id = randomUUID();
    const player = {
      id,
      name: typeof message.name === 'string' ? message.name.slice(0, 16) : 'Agente',
      character: Number.isInteger(message.character) ? Math.max(0, Math.min(2, message.character)) : 0,
      x: 0,
      z: 0,
      yaw: 0,
      kills: 0
    };
    const client = { id, player, ws };
    room.clients.set(id, client);
    if (!room.hostId) room.hostId = id;
    ws.playerId = id;
    ws.partyRoom = room;
    sendJson(ws, {
      type: 'welcome',
      id,
      hostId: room.hostId,
      players: Array.from(room.clients.values())
        .filter(existing => existing.id !== id)
        .map(existing => existing.player)
    });
    broadcastRoom(room, { type: 'peer', player }, ws);
    return;
  }

  const room = ws.partyRoom;
  const client = room && room.clients.get(ws.playerId);
  if (!room || !client) return;

  if (message.type === 'state') {
    const p = message.player;
    if (!p || ![p.x, p.z, p.yaw].every(Number.isFinite) ||
        Math.abs(p.x) > 20 || Math.abs(p.z) > 20) return;
    client.player = {
      ...client.player,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      kills: Number.isInteger(p.kills) ? Math.max(0, p.kills) : 0
    };
    broadcastRoom(room, { type: 'state', player: client.player }, ws);
  } else if (message.type === 'bots' && room.hostId === client.id) {
    if (!Array.isArray(message.bots) || message.bots.length > 20) return;
    const bots = message.bots.filter(bot =>
      bot && typeof bot.id === 'string' && bot.id.length <= 40 &&
      Number.isFinite(bot.x) && Math.abs(bot.x) <= 22 &&
      Number.isFinite(bot.z) && Math.abs(bot.z) <= 22 &&
      Number.isFinite(bot.hp) && bot.hp >= 0 && bot.hp <= 500
    ).map(bot => ({ id: bot.id, x: bot.x, z: bot.z, hp: bot.hp }));
    broadcastRoom(room, { type: 'bots', bots }, ws);
  } else if (message.type === 'damage') {
    if (typeof message.botId !== 'string' || message.botId.length > 40 ||
        !Number.isFinite(message.amount) || message.amount < 1 || message.amount > 50) return;
    const host = room.clients.get(room.hostId);
    if (host) sendJson(host.ws, { type: 'damage', id: client.id, botId: message.botId, amount: message.amount });
  } else if (message.type === 'shot') {
    const shot = message;
    if (![shot.x, shot.y, shot.z, shot.vx, shot.vz].every(Number.isFinite) ||
        Math.abs(shot.x) > 25 || Math.abs(shot.z) > 25 ||
        Math.abs(shot.vx) > 25 || Math.abs(shot.vz) > 25) return;
    broadcastRoom(room, {
      type: 'shot',
      id: client.id,
      x: shot.x,
      y: shot.y,
      z: shot.z,
      vx: shot.vx,
      vz: shot.vz,
      kind: shot.kind === 'bot' ? 'bot' : 'player'
    }, ws);
  }
}

const PAGE = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SchermoLive</title></head>
<body style="margin:0;background:#000;height:100vh;display:flex;align-items:center;justify-content:center">
<img id="i" style="max-width:100%;max-height:100%">
<p id="s" style="position:fixed;top:8px;left:12px;color:#888;font:14px sans-serif">In attesa della trasmissione…</p>
<script>
const img = document.getElementById('i'), st = document.getElementById('s');
function connect() {
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/watch');
  ws.binaryType = 'blob';
  ws.onmessage = e => {
    const u = URL.createObjectURL(e.data);
    img.onload = () => URL.revokeObjectURL(u);
    img.onerror = () => {
      st.textContent = 'Ricevuti dati, ma il fotogramma non è un’immagine valida.';
      st.style.display = 'block';
      URL.revokeObjectURL(u);
    };
    img.src = u;
    st.style.display = 'none';
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();
</script></body></html>`;

const SHARE_PAGE = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101522">
<title>Condividi lo schermo - SchermoLive</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #101522; color: #f4f6fb; font: 16px/1.5 system-ui, sans-serif; }
main { width: min(100%, 560px); padding: 32px; border: 1px solid #30394c; border-radius: 20px; background: #192133; box-shadow: 0 20px 60px #0005; }
h1 { margin: 0 0 8px; font-size: 1.8rem; }
p { color: #c3cada; }
.hint { margin: 22px 0; padding: 14px 16px; border-radius: 12px; background: #222d42; }
#status { min-height: 28px; color: #a9d8ff; }
#status.error { color: #ffb4ab; }
.buttons { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
button { min-height: 48px; padding: 10px 20px; border: 0; border-radius: 10px; font: inherit; font-weight: 650; cursor: pointer; }
button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
button:disabled { cursor: not-allowed; opacity: .55; }
#start { background: #82cfff; color: #102033; }
#stop { background: #384258; color: #fff; }
small { display: block; margin-top: 20px; color: #aab4c7; }
</style>
</head>
<body>
<main>
  <h1>Condividi lo schermo</h1>
  <p>Trasmetti lo schermo a chi sta guardando SchermoLive.</p>
  <div class="hint">Quando premi <strong>Avvia condivisione</strong>, il browser ti chiederà quale schermo o finestra condividere. La trasmissione parte solo dopo la tua scelta. Puoi interromperla qui o dai controlli del browser.</div>
  <p id="status" role="status" aria-live="polite">Pronto per iniziare.</p>
  <div class="buttons">
    <button id="start" type="button">Avvia condivisione</button>
    <button id="stop" type="button" disabled>Interrompi</button>
  </div>
  <small>Compatibile con browser desktop che supportano la condivisione dello schermo. Vengono inviati solo fotogrammi video, senza audio. Tieni aperta questa pagina durante la trasmissione.</small>
</main>
<video id="source" autoplay muted playsinline hidden></video>
<canvas id="frame" hidden></canvas>
<script>
const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const statusText = document.getElementById('status');
const video = document.getElementById('source');
const canvas = document.getElementById('frame');
const context = canvas.getContext('2d');
let stream = null;
let socket = null;
let frameTimer = null;
let capturing = false;
let framePending = false;
let acknowledgedFirstFrame = false;

function setStatus(message, isError) {
  statusText.textContent = message;
  statusText.classList.toggle('error', Boolean(isError));
}

function stopCapture(message, isError) {
  capturing = false;
  if (frameTimer !== null) clearInterval(frameTimer);
  frameTimer = null;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  video.srcObject = null;
  if (socket) {
    const activeSocket = socket;
    socket = null;
    activeSocket.close();
  }
  framePending = false;
  acknowledgedFirstFrame = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  setStatus(message || 'Condivisione interrotta.', isError);
}

function connectIngest() {
  return new Promise((resolve, reject) => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = new WebSocket(protocol + '//' + location.host + '/ingest');
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        connection.close();
        reject(new Error('Timeout connessione'));
      }
    }, 10000);
    connection.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(connection);
    };
    connection.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Connessione WebSocket non riuscita'));
      }
    };
    connection.onclose = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Connessione WebSocket chiusa'));
      }
    };
  });
}

function sendFrame() {
  if (!capturing || framePending || !socket || socket.readyState !== WebSocket.OPEN ||
      video.videoWidth === 0 || video.videoHeight === 0) return;
  if (socket.bufferedAmount > 2 * 1024 * 1024) return;

  const scale = Math.min(1, 1280 / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.drawImage(video, 0, 0, width, height);
  framePending = true;
  canvas.toBlob(blob => {
    if (!blob) {
      framePending = false;
      return;
    }
    blob.arrayBuffer().then(data => {
      if (capturing && socket && socket.readyState === WebSocket.OPEN &&
          socket.bufferedAmount <= 2 * 1024 * 1024) socket.send(data);
    }).catch(() => {
      if (capturing) setStatus('Impossibile preparare un fotogramma. Riprova la condivisione.', true);
    }).finally(() => { framePending = false; });
  }, 'image/jpeg', 0.72);
}

startButton.addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    setStatus('Questo browser non supporta la condivisione dello schermo. Usa un browser desktop aggiornato.', true);
    return;
  }
  startButton.disabled = true;
  setStatus('Scegli lo schermo o la finestra nella richiesta del browser.', false);
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 8 },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    socket = await connectIngest();
    socket.binaryType = 'arraybuffer';
    socket.onmessage = event => {
      if (event.data === 'frame-received' && !acknowledgedFirstFrame) {
        acknowledgedFirstFrame = true;
        setStatus('Condivisione attiva. Il primo fotogramma è stato ricevuto dal server.', false);
      }
    };
    socket.onclose = () => {
      if (capturing) stopCapture('Connessione al server interrotta. Premi Avvia per riprovare.', true);
    };
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (capturing) stopCapture('Condivisione terminata dai controlli del browser.', false);
    });
    capturing = true;
    stopButton.disabled = false;
    setStatus('Connesso. Invio dei fotogrammi in corso…', false);
    frameTimer = setInterval(sendFrame, 125);
  } catch (error) {
    const wasCancelled = error && error.name === 'NotAllowedError';
    stopCapture(wasCancelled
      ? 'Condivisione annullata o autorizzazione non concessa.'
      : 'Impossibile avviare la condivisione. Controlla la connessione e riprova.', true);
  }
});

stopButton.addEventListener('click', () => stopCapture('Condivisione interrotta.', false));
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/game') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(GAME_PAGE);
  } else if (req.url === '/three.min.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(THREE_BUNDLE);
  } else if (req.url === '/view') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  } else if (req.url === '/share') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(SHARE_PAGE);
  } else if (req.url === '/') {
    res.writeHead(302, { Location: '/view' });
    res.end();
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const path = (req.url || '').split('?')[0];
  if (path !== '/ingest' && path !== '/watch' && path !== '/party') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    if (path === '/watch') {
      viewers.add(ws);
      ws.on('close', () => viewers.delete(ws));
    } else if (path === '/ingest') {
      let acknowledgedFirstFrame = false;
      ws.on('message', (data) => {
        if (!acknowledgedFirstFrame) {
          acknowledgedFirstFrame = true;
          if (ws.readyState === 1) ws.send('frame-received');
        }
        for (const v of viewers) if (v.readyState === 1) v.send(data, { binary: true });
      });
    } else {
      ws.on('message', data => handlePartyMessage(ws, data));
      ws.on('close', () => leaveParty(ws));
      ws.on('error', () => leaveParty(ws));
    }
  });
});

server.listen(PORT, () => console.log('In ascolto sulla porta ' + PORT));
