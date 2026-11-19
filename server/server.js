const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const viewers = new Set();

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
    img.src = u;
    st.style.display = 'none';
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/view') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
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
  if (path !== '/ingest' && path !== '/watch') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    if (path === '/watch') {
      viewers.add(ws);
      ws.on('close', () => viewers.delete(ws));
    } else {
      ws.on('message', (data) => {
        for (const v of viewers) if (v.readyState === 1) v.send(data, { binary: true });
      });
    }
  });
});

server.listen(PORT, () => console.log('In ascolto sulla porta ' + PORT));
