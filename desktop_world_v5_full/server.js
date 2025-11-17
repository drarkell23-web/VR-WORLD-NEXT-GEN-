const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, '/')));

// local helper endpoints under /local
app.get('/local/health', (req,res)=> res.json({status:'ok'}));
app.get('/local/list', (req,res)=>{ const p = req.query.path || __dirname; const safe = path.normalize(p); try{ const files = fs.readdirSync(safe).slice(0,1000).map(f=>{ const fp = path.join(safe,f); let stat = {size:0,mtime:null,isDirectory:false}; try{ const st = fs.statSync(fp); stat.size = st.size; stat.mtime = st.mtime; stat.isDirectory = st.isDirectory(); }catch(e){} return {name:f,path:fp,size:stat.size,mtime:stat.mtime,isDirectory:stat.isDirectory}; }); res.json({path:safe,files}); }catch(e){ res.status(400).json({error:e.toString()}); } });
app.get('/local/thumb', (req,res)=>{ const p = req.query.path; if(!p) return res.status(400).json({error:'path required'}); const safe = path.normalize(p); try{ if(!fs.existsSync(safe)) return res.status(404).json({error:'not found'}); const ext = path.extname(safe).toLowerCase(); if(!['.jpg','.jpeg','.png','.gif','bmp'].includes(ext)) return res.status(400).json({error:'not an image'}); sharp(safe).resize(1600,900,{fit:'inside'}).jpeg().toBuffer().then(buf=>{ res.set('Content-Type','image/jpeg'); res.send(buf); }).catch(err=> res.status(500).json({error:err.toString()})); }catch(e){ res.status(500).json({error:e.toString()}); } });

// in-memory players
const players = {};

// Socket.io events for multiplayer and WebRTC signaling
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  // send current state
  socket.emit('players', players);
  // inform others of new peer for WebRTC setup
  socket.broadcast.emit('new-peer', { id: socket.id });

  socket.on('update', (data)=>{
    players[data.id] = {position: data.position, rotation: data.rotation, human: data.human};
    io.emit('players', players);
  });

  socket.on('mode', (data)=>{ if(players[data.id]) players[data.id].human = data.human; io.emit('players', players); });

  // WebRTC signaling messages - relay between peers
  socket.on('signal-offer', (data)=>{ const to = data.to; if(to && io.sockets.sockets.get(to)) io.to(to).emit('signal-offer', {from: socket.id, sdp: data.sdp}); });
  socket.on('signal-answer', (data)=>{ const to = data.to; if(to && io.sockets.sockets.get(to)) io.to(to).emit('signal-answer', {from: socket.id, sdp: data.sdp}); });
  socket.on('signal-ice', (data)=>{ const to = data.to; if(to && io.sockets.sockets.get(to)) io.to(to).emit('signal-ice', {from: socket.id, candidate: data.candidate}); });

  socket.on('disconnect', ()=>{ delete players[socket.id]; io.emit('players', players); io.emit('peer-left', {id: socket.id}); });
});

server.listen(PORT, ()=> console.log('Server running on port ' + PORT));
