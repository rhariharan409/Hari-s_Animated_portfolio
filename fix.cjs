const fs = require('fs');

const lines = fs.readFileSync('style.css', 'utf-8').split('\n');

const newContent = `@media (max-width: 768px) {
  #cine-scene-attic-1 { top: 35vh; left: 8vw; }
  #cine-scene-attic-2 { top: 40vh; left: 15vw; }
  #cine-scene-attic-3 { top: 45vh; left: 20vw; }
  
  /* Hide some supporting text on mobile if needed */
  .cine-subtitle, .cine-subtitle-sec, .cine-subtext {
    display: none;
  }
}

/* --- LAYER 2: BULLETIN BOARD --- */
#bulletin-board-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 20;
  pointer-events: none;
}

#hud-hint {
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-family: sans-serif;
  opacity: 0;
  transition: opacity 0.3s ease;
  will-change: opacity;
}

/* Board Anchor matches physical space roughly */
.board-anchor {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
  transform: translate(-50%, -50%);
}

.paper-card {
  position: absolute;
  background-color: #dcb37b;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(139, 69, 19, 0.05) 0%, transparent 20%),
    radial-gradient(circle at 80% 90%, rgba(139, 69, 19, 0.08) 0%, transparent 30%);
  box-shadow: 
    2px 4px 15px rgba(0,0,0,0.4), 
    inset 0 0 40px rgba(139, 69, 19, 0.2);
  border-radius: 4px 6px 3px 5px;
  padding: 30px;
  color: #3b2a1a;
  opacity: 0; /* Hidden by default */
  will-change: transform, opacity;
}

.paper-card::after {
  content: "";
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: #2a2a2a;
  border-radius: 50%;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.3);
}

.paper-title {
  font-size: 1.5rem;
  font-weight: bold;`;

const output = [];
for(let i = 0; i <= 250; i++) {
  output.push(lines[i]);
}
newContent.split('\n').forEach(line => output.push(line));
for(let i = 256; i < lines.length; i++) {
  output.push(lines[i]);
}

fs.writeFileSync('style.css', output.join('\n'), 'utf-8');
