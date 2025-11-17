// Desktop World V5 - Ultimate client
// Adds WebRTC voice chat (signaling via socket.io), client-side recording (canvas+mic), avatars, and improved visuals

document.addEventListener('DOMContentLoaded', ()=>{
  const socket = io();
  const REAL_PATH = 'C:/Users/Louise/Desktop';
  const shopsEntity = document.getElementById('shops');
  const islandsEntity = document.getElementById('islands');
  const avatarsEntity = document.getElementById('avatars');
  const panel = document.getElementById('panel');
  const panelTitle = document.getElementById('panelTitle');
  const panelBody = document.getElementById('panelBody');
  const previewBtn = document.getElementById('previewBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const closePanel = document.getElementById('closePanel');
  const enterBtn = document.getElementById('enterBtn');
  const toggleAvatarBtn = document.getElementById('toggleAvatar');
  const toggleVoiceBtn = document.getElementById('toggleVoice');
  const recordBtn = document.getElementById('recordBtn');
  const avatarSizeInput = document.getElementById('avatarSize');
  let humanMode = false;
  let myId = null;
  let peers = {}; // peer connections for voice (RTCPeerConnection)
  let audioStreams = {}; // remote audio elements
  let localStream = null;
  let recorder = null;
  let recordingChunks = [];

  // spawn shops function (same as before)
  function spawnShops(){
    const categories = ['Photos','Documents','Music','Videos','Apps','Archives'];
    shopsEntity.innerHTML = '';
    categories.forEach((c,i)=>{
      const shop = document.createElement('a-entity');
      shop.setAttribute('geometry','primitive: box; width:4; height:3; depth:2');
      const color = ['#ff77c1','#66f2ff','#ffd166','#8aff8a','#a08aff','#ffb86b'][i%6];
      shop.setAttribute('material', `color:${color}; metalness:0.2; opacity:0.95`);
      shop.setAttribute('position', `${-40 + i*12} 1.5 -28`);
      shop.setAttribute('class','clickable');
      const sign = document.createElement('a-text');
      sign.setAttribute('value', c);
      sign.setAttribute('align','center');
      sign.setAttribute('color','#001213');
      sign.setAttribute('position','0 1.8 1.05');
      sign.setAttribute('width','3');
      shop.appendChild(sign);
      shopsEntity.appendChild(shop);
      shop.addEventListener('click', ()=> openShop(c));
    });
  }

  function openShop(name){ alert('Entering shop: ' + name); spawnIsland(name); }
  function spawnIsland(category){
    const baseX = 24 + (Math.random()*6 - 3);
    const baseZ = -32 + (Math.random()*6 - 3);
    const island = document.createElement('a-entity');
    island.setAttribute('position', `${baseX} 0 ${baseZ}`);
    const platform = document.createElement('a-cylinder');
    platform.setAttribute('height','0.4'); platform.setAttribute('radius','6'); platform.setAttribute('material','color:#02182a; opacity:0.95'); platform.setAttribute('position','0 0.2 0');
    island.appendChild(platform);
    for(let i=0;i<20;i++){
      const angle = (i/20)*Math.PI*2;
      const x = Math.cos(angle)*3.2;
      const z = Math.sin(angle)*3.2;
      const orb = document.createElement('a-sphere');
      orb.setAttribute('radius', String(0.45 + Math.random()*0.5));
      orb.setAttribute('position', `${x} 1.1 ${z}`);
      orb.setAttribute('material', `color:#${Math.floor(Math.random()*0xffffff).toString(16)}; metalness:0.3`);
      orb.setAttribute('class','clickable');
      orb.setAttribute('data-name', `${category}-item-${i}`);
      orb.addEventListener('click', ()=> openPanel({name:`${category} Item ${i}`, type:category, size:'--'}));
      island.appendChild(orb);
    }
    islandsEntity.appendChild(island);
  }

  function openPanel(item){ panelTitle.innerText = item.name; panelBody.innerHTML = `<strong>Type:</strong> ${item.type}<br/><strong>Size:</strong> ${item.size}<br/><strong>Path:</strong> ${item.path||'local-demo'}<br/>`; panel.classList.remove('hidden'); }
  closePanel.addEventListener('click', ()=> panel.classList.add('hidden'));
  previewBtn.addEventListener('click', ()=> alert('Preview not available in demo.'));
  openFolderBtn.addEventListener('click', ()=> alert('Open folder requires helper.'));

  enterBtn.addEventListener('click', ()=>{ document.getElementById('ui').style.display='none'; const rig=document.getElementById('cameraRig'); rig.setAttribute('animation__enter','property: position; to: 0 1.6 0; dur: 900; easing: easeInOutQuad'); });

  toggleAvatarBtn.addEventListener('click', ()=> toggleHumanMode());
  document.addEventListener('keydown',(e)=>{ if(e.key.toLowerCase()==='h') toggleHumanMode(); if(e.key.toLowerCase()==='v') startVoicePushToTalk(); if(e.key.toLowerCase()==='r') toggleRecording(); });

  function toggleHumanMode(){ humanMode = !humanMode; alert('Human Mode ' + (humanMode ? 'ON' : 'OFF')); if(myId) socket.emit('mode',{id:myId,human:humanMode}); }

  // RECORDING: capture canvas + mic and download webm
  async function startRecording(){
    try{
      const canvas = document.querySelector('canvas');
      if(!canvas) return alert('No canvas found to record');
      const canvasStream = canvas.captureStream(30); // 30fps
      // get mic
      const micStream = await navigator.mediaDevices.getUserMedia({audio:true});
      // combine tracks
      const combined = new MediaStream();
      canvasStream.getVideoTracks().forEach(t=>combined.addTrack(t));
      micStream.getAudioTracks().forEach(t=>combined.addTrack(t));
      recorder = new MediaRecorder(combined,{mimeType:'video/webm;codecs=vp9,opus'});
      recordingChunks = [];
      recorder.ondataavailable = e => { if(e.data.size>0) recordingChunks.push(e.data); };
      recorder.onstop = ()=>{
        const blob = new Blob(recordingChunks, {type:'video/webm'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='desktop_world_walk.webm'; a.click();
        URL.revokeObjectURL(url);
        alert('Recording saved as desktop_world_walk.webm');
      };
      recorder.start();
      alert('Recording started');
    }catch(e){ console.error(e); alert('Recording failed: ' + e.message); }
  }

  function stopRecording(){ if(recorder && recorder.state !== 'inactive'){ recorder.stop(); alert('Recording stopped'); } }

  function toggleRecording(){ if(recorder && recorder.state === 'recording') stopRecording(); else startRecording(); }

  recordBtn.addEventListener('click', ()=> toggleRecording());

  // VOICE: WebRTC signaling via socket.io - create offer/answer and exchange ICE
  async function initLocalAudio(){ if(localStream) return localStream; try{ localStream = await navigator.mediaDevices.getUserMedia({audio:true}); return localStream; }catch(e){ alert('Microphone access denied or not available'); return null; } }

  function createPeerConnection(peerId, isInitiator){
    const pc = new RTCPeerConnection({iceServers: [{urls:'stun:stun.l.google.com:19302'}]});
    pc.onicecandidate = e => { if(e.candidate) socket.emit('ice',{to:peerId,candidate:e.candidate}); };
    pc.ontrack = e => { // attach remote audio
      let audio = audioStreams[peerId];
      if(!audio){ audio = document.createElement('audio'); audio.autoplay = true; audioStreams[peerId]=audio; document.body.appendChild(audio); }
      audio.srcObject = e.streams[0];
    };
    // add local audio
    if(localStream){
      localStream.getTracks().forEach(track=> pc.addTrack(track, localStream));
    }
    return pc;
  }

  socket.on('connect', ()=>{ myId = socket.id; console.log('Connected as', myId); socket.emit('join',{id:myId}); });

  // signaling handlers
  socket.on('signal-offer', async (data)=>{
    // data: {from, sdp}
    const from = data.from;
    const pc = createPeerConnection(from,false);
    peers[from] = pc;
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    // ensure local audio
    await initLocalAudio();
    localStream.getTracks().forEach(track=> pc.addTrack(track, localStream));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('signal-answer',{to:from,sdp:pc.localDescription});
  });

  socket.on('signal-answer', async (data)=>{
    const from = data.from;
    const pc = peers[from];
    if(pc){ await pc.setRemoteDescription(new RTCSessionDescription(data.sdp)); }
  });

  socket.on('signal-ice', (data)=>{
    const from = data.from;
    const pc = peers[from];
    if(pc && data.candidate){ pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e=>console.warn(e)); }
  });

  // when someone joins, create offer to them
  socket.on('new-peer', async (data)=>{
    const peerId = data.id;
    if(peerId === myId) return;
    await initLocalAudio();
    const pc = createPeerConnection(peerId,true);
    peers[peerId] = pc;
    // add local tracks
    localStream.getTracks().forEach(track=> pc.addTrack(track, localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal-offer',{to:peerId,sdp:pc.localDescription});
  });

  // multiplayer: receive player map and render avatars
  socket.on('players', (data)=>{
    Object.keys(data).forEach(id=>{
      if(id===myId) return;
      const state = data[id];
      let ent = document.getElementById('avatar-' + id);
      if(!ent){
        ent = document.createElement('a-entity');
        ent.setAttribute('id','avatar-' + id);
        ent.setAttribute('geometry','primitive: box; depth:0.6; height:1.6; width:0.6');
        ent.setAttribute('material','color:#ffcc66; metalness:0.2');
        const name = document.createElement('a-text');
        name.setAttribute('value', id.substring(0,6));
        name.setAttribute('align','center');
        name.setAttribute('position','0 1.1 0');
        name.setAttribute('color','#001213');
        ent.appendChild(name);
        avatarsEntity.appendChild(ent);
      }
      ent.setAttribute('position', `${state.position.x} ${state.position.y} ${state.position.z}`);
      ent.setAttribute('rotation', `${state.rotation.x} ${state.rotation.y} ${state.rotation.z}`);
      const s = parseFloat(avatarSizeInput.value) || 1;
      ent.setAttribute('scale', `${s} ${s} ${s}`);
    });
    // remove missing
    const existing = Array.from(avatarsEntity.children).map(c=>c.id.replace('avatar-',''));
    existing.forEach(id=>{ if(!data[id]){ const el = document.getElementById('avatar-' + id); if(el) el.remove(); }});
  });

  // send regular updates of our camera position to server
  setInterval(()=>{
    const rig = document.getElementById('cameraRig');
    const pos = rig.getAttribute('position');
    const rot = rig.getAttribute('rotation');
    socket.emit('update',{id: socket.id, position: pos, rotation: rot, human: humanMode});
  }, 100);

  // spawn initial shops
  spawnShops();

});
