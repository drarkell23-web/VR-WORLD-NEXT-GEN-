const {app, BrowserWindow} = require('electron');
const path = require('path');
const {exec} = require('child_process');
function createWindow(){ const win = new BrowserWindow({width:1280,height:800,webPreferences:{nodeIntegration:false,contextIsolation:true}}); win.loadURL('http://localhost:3000'); }
app.whenReady().then(()=>{ // start server automatically
  const server = exec('node server.js', {cwd: path.join(__dirname)});
  server.stdout.on('data', d=> console.log('server:',d)); server.stderr.on('data', d=> console.error('server-err:',d));
  createWindow();
});
