import { certificates } from './data/certificates.js';
import { internships } from './data/internships.js';
import { projects } from './data/projects.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById('cinematic-canvas');
const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false optimizes rendering

// Handle canvas resizing
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class FrameManager {
  constructor(sequences) {
    this.sequences = sequences;
    this.cache = new Map(); // key: "seqIndex-frameIndex", value: HTMLImageElement
    this.loading = new Set();
    
    // Config
    this.maxCacheSize = 250; // Max frames in memory at once (~10 secs of 24fps)
    this.preloadForward = 90; // How many frames to preload ahead
    this.preloadBackward = 24; // How many frames to keep behind
  }

  getFrameKey(seqIndex, frameIndex) {
    return `${seqIndex}-${frameIndex}`;
  }

  // Gets an image if it's ready, otherwise queues it for loading
  getFrame(seqIndex, frameIndex) {
    const key = this.getFrameKey(seqIndex, frameIndex);
    if (this.cache.has(key)) {
      // Mark as recently used by re-inserting (LRU logic)
      const img = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, img);
      return img;
    }
    
    this.queueLoad(seqIndex, frameIndex);
    return null;
  }

  queueLoad(seqIndex, frameIndex) {
    if (seqIndex < 0 || seqIndex >= this.sequences.length) return;
    if (frameIndex < 1 || frameIndex > this.sequences[seqIndex].frameCount) return;

    const key = this.getFrameKey(seqIndex, frameIndex);
    if (this.cache.has(key) || this.loading.has(key)) return;

    this.loading.add(key);

    const img = new Image();
    // Path matches the extraction script: /frames/seq0/frame_0001.webp
    const frameStr = String(frameIndex).padStart(4, '0');
    img.src = `/frames/seq${seqIndex}/frame_${frameStr}.webp`;

    img.onload = () => {
      this.loading.delete(key);
      this.cache.set(key, img);
      this.enforceCacheLimit();
    };

    img.onerror = () => {
      this.loading.delete(key);
    };
  }

  enforceCacheLimit() {
    if (this.cache.size > this.maxCacheSize) {
      // Remove oldest entries (Map iterates in insertion order)
      let keysToDelete = this.cache.size - this.maxCacheSize;
      for (const [key] of this.cache) {
        this.cache.delete(key);
        keysToDelete--;
        if (keysToDelete <= 0) break;
      }
    }
  }

  // Call this every frame to ensure we have upcoming frames loading
  updatePreloadWindow(currentSeqIndex, currentFrameIndex) {
    let seq = currentSeqIndex;
    let frame = currentFrameIndex;

    // Queue forward
    for (let i = 0; i < this.preloadForward; i++) {
      this.queueLoad(seq, frame);
      frame++;
      // Cross boundary to next sequence
      if (frame > this.sequences[seq]?.frameCount) {
        seq++;
        frame = 1;
        if (seq >= this.sequences.length) break; // Reached the end
      }
    }

    // Queue backward
    seq = currentSeqIndex;
    frame = currentFrameIndex;
    for (let i = 0; i < this.preloadBackward; i++) {
      frame--;
      if (frame < 1) {
        seq--;
        if (seq < 0) break;
        frame = this.sequences[seq].frameCount;
      }
      this.queueLoad(seq, frame);
    }
  }
}

async function init() {
  // 1. Fetch Metadata
  let metadata;
  try {
    const response = await fetch('/frames/metadata.json');
    metadata = await response.json();
  } catch (err) {
    console.error("Failed to load metadata.json. Did the extraction script finish?", err);
    return;
  }

  const sequences = metadata.sequences;
  const frameManager = new FrameManager(sequences);
  let isPlaying = true;
  const segmentCount = 22; 
  const segmentSize = 1 / segmentCount;

  // 2. Setup Scroll space
  const scrollHeight = 20000; 
  document.getElementById('scroll-spacer').style.height = `${scrollHeight}px`;

  let scrollProgress = 0;

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      scrollProgress = self.progress;
    }
  });

  // DOM Elements for Bulletin Board and Book
  const hud = document.getElementById('hud-hint');
  const papers = [
    document.getElementById('paper-1'),
    document.getElementById('paper-2'),
    document.getElementById('paper-3'),
    document.getElementById('paper-4')
  ];

  const spreads = [
    document.getElementById('spread-1'),
    document.getElementById('spread-2'),
    document.getElementById('spread-3'),
    document.getElementById('spread-4')
  ];

  // Cinematic Typography DOM Elements
  const cineLayer = document.getElementById('cinematic-typography-layer');
  const cineScenes = [
    document.getElementById('cine-scene-1'),
    document.getElementById('cine-scene-2'),
    document.getElementById('cine-scene-3'),
    document.getElementById('cine-scene-4'),
    document.getElementById('cine-scene-5'),
    document.getElementById('cine-scene-6'),
    document.getElementById('cine-scene-7'),
    document.getElementById('cine-scene-attic-1'),
    document.getElementById('cine-scene-attic-2'),
    document.getElementById('cine-scene-attic-3')
  ];
  const cineCgpaNum = document.getElementById('cine-cgpa-num');
  const cineProbsNum = document.getElementById('cine-probs-num');
  const cineMaskReveal = document.querySelector('.cine-mask-reveal');

  // Wrap text in words for the typing effect
  function wrapWords(element) {
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim().length > 0) {
        textNodes.push(node);
      }
    }
    
    textNodes.forEach(textNode => {
      const parent = textNode.parentNode;
      if (parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT' || parent.classList.contains('word')) return;
      
      const words = textNode.nodeValue.split(/\s+/);
      const fragment = document.createDocumentFragment();
      
      words.forEach(word => {
        if (word.length === 0) return;
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word + ' ';
        fragment.appendChild(span);
      });
      
      parent.replaceChild(fragment, textNode);
    });
  }

  const spreadData = spreads.map(spread => {
    if (!spread) return null;
    wrapWords(spread.querySelector('.left-page'));
    wrapWords(spread.querySelector('.right-page'));
    return {
      el: spread,
      leftWords: spread.querySelector('.left-page').querySelectorAll('.word'),
      rightWords: spread.querySelector('.right-page').querySelectorAll('.word')
    };
  });

  // Helper for fast interpolation
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const smoothstep = (min, max, value) => {
    let x = clamp((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
  };

  // Helper for object-fit: cover drawing
  function drawImageCover(img) {
    let scaleX = canvas.width / img.width;
    let scaleY = canvas.height / img.height;
    // Use cover logic: take the max scale
    let scale = Math.max(scaleX, scaleY);
    
    // Zoom in by 15% to completely push the bottom-right corner out of the canvas bounds
    scale *= 1.15;

    let renderWidth = img.width * scale;
    let renderHeight = img.height * scale;
    
    // Center the image
    let offsetX = (canvas.width - renderWidth) / 2;
    let offsetY = (canvas.height - renderHeight) / 2;

    ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
  }

  let lastRenderedKey = null;

  // 3. Render Loop
  function render() {
    let globalProgress = scrollProgress;
    
    // Determine which sequence is active
    let targetSeqIndex = Math.floor(globalProgress / segmentSize);
    if (targetSeqIndex >= segmentCount) targetSeqIndex = segmentCount - 1;

    const segmentStart = targetSeqIndex * segmentSize;
    let segmentProgress = (globalProgress - segmentStart) / segmentSize;
    segmentProgress = Math.max(0, Math.min(1, segmentProgress));

    let videoSeqIndex;
    let videoProgress = 1.0;

    if (targetSeqIndex < 5) {
      videoSeqIndex = targetSeqIndex;
      videoProgress = segmentProgress;
    } else if (targetSeqIndex === 5) {
      videoSeqIndex = 5;
      videoProgress = Math.min(1, segmentProgress / 0.65);
    } else if (targetSeqIndex >= 6 && targetSeqIndex <= 9) {
      videoSeqIndex = 5;
      videoProgress = 1.0;
    } else if (targetSeqIndex >= 10 && targetSeqIndex <= 16) {
      videoSeqIndex = 6;
      // Map global progress for segments 10 to 16 to seq6 video progress
      const staircaseSegmentsStart = 10 * segmentSize;
      const staircaseSegmentsLength = 7 * segmentSize;
      let staircaseProgress = (globalProgress - staircaseSegmentsStart) / staircaseSegmentsLength;
      staircaseProgress = Math.max(0, Math.min(1, staircaseProgress));
      
      // The first 55% of seq 6 is the camera panning across the living room to the stairs.
      // To prevent sluggishness ("lag"), we compress this panning into a shorter scroll phase (1.5 segments).
      const panRatio = 1.5 / 7;
      if (staircaseProgress < panRatio) {
        let panProgress = staircaseProgress / panRatio;
        // Apply smoothstep for a cinematic ease-in-out pan
        let smoothPan = panProgress * panProgress * (3 - 2 * panProgress);
        videoProgress = smoothPan * 0.55;
      } else {
        // Map the remaining scroll space to the actual stair climb
        let climbProgress = (staircaseProgress - panRatio) / (1 - panRatio);
        videoProgress = 0.55 + (climbProgress * 0.45);
      }
    } else {
      videoSeqIndex = 7;
      // Map global progress for segments 17 to 21 to seq7 video progress
      const computerSegmentsStart = 17 * segmentSize;
      const computerSegmentsLength = 5 * segmentSize;
      let computerProgress = (globalProgress - computerSegmentsStart) / computerSegmentsLength;
      computerProgress = Math.max(0, Math.min(1, computerProgress));
      videoProgress = computerProgress;
    }

    // Calculate exact frame index (1-indexed based on FFmpeg %04d)
    const frameCount = sequences[videoSeqIndex].frameCount;
    
    // Map progress exactly to a frame integer. 
    let frameIndex = Math.floor(videoProgress * (frameCount - 1)) + 1;

    // Ask FrameManager to update preloading queues based on where we are
    frameManager.updatePreloadWindow(videoSeqIndex, frameIndex);

    // Try to get the exact current frame
    const img = frameManager.getFrame(videoSeqIndex, frameIndex);

    if (img && img.complete && img.naturalWidth > 0) {
      const currentKey = `${targetSeqIndex}-${frameIndex}`;
      // Only draw if the frame actually changed to save GPU
      if (currentKey !== lastRenderedKey) {
        drawImageCover(img);
        lastRenderedKey = currentKey;
      }
    } else {
      // Fallback: If the exact frame isn't loaded yet (scrolling too fast),
      // we do NOT clear the canvas. We just leave the last rendered frame visible
      // until the correct one finishes loading, which prevents black flashes.
    }

    // --- CINEMATIC TYPOGRAPHY LOGIC ---
    if (cineLayer) {
      cineLayer.style.pointerEvents = 'none'; // Ensure it's non-interactive
      
      const animateScene = (sceneIndex, startP, endP, enterExitRatio = 0.3) => {
        const scene = cineScenes[sceneIndex];
        if (!scene) return 0;
        
        if (globalProgress <= startP || globalProgress >= endP) {
          scene.style.opacity = 0;
          scene.style.visibility = 'hidden';
          return 0;
        }
        
        scene.style.visibility = 'visible';
        const duration = endP - startP;
        const enterEnd = startP + (duration * enterExitRatio);
        const exitStart = endP - (duration * enterExitRatio);
        
        let opacity = 1;
        let translateY = 0;
        let scale = 1;
        let blur = 0;
        let progress = 1; 
        
        if (globalProgress < enterEnd) {
          // Entering
          progress = smoothstep(startP, enterEnd, globalProgress);
          opacity = progress;
          translateY = lerp(18, 0, progress);
          scale = lerp(0.97, 1, progress);
          blur = lerp(4, 0, progress);
        } else if (globalProgress > exitStart) {
          // Exiting
          const p = smoothstep(exitStart, endP, globalProgress);
          progress = 1 - p;
          opacity = 1 - p;
          translateY = lerp(0, -15, p);
          scale = lerp(1, 0.985, p);
          blur = lerp(0, 3, p);
        }
        
        scene.style.opacity = opacity;
        scene.style.transform = `translateY(${translateY}px) scale(${scale})`;
        scene.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
        
        return progress; 
      };

      if (globalProgress <= 0.25) {
        animateScene(0, 0.000, 0.035);
        animateScene(1, 0.025, 0.065);
        animateScene(2, 0.055, 0.095);
        
        // Scene 4 (9.48 CGPA)
        animateScene(3, 0.085, 0.125);
        if (globalProgress >= 0.085 && globalProgress <= 0.125 && cineCgpaNum) {
          const p = clamp((globalProgress - 0.09) / 0.02, 0, 1);
          if (p < 0.25) cineCgpaNum.textContent = "9";
          else if (p < 0.5) cineCgpaNum.textContent = "9.";
          else if (p < 0.75) cineCgpaNum.textContent = "9.4";
          else cineCgpaNum.textContent = "9.48";
        }
        
        // Scene 5 (800+)
        const p5 = animateScene(4, 0.115, 0.150);
        if (p5 > 0) {
          const scene5 = cineScenes[4];
          if (scene5) {
            const labels = scene5.querySelectorAll('.cine-label, .cine-subtext');
            labels.forEach((el) => {
              // Fade them in a bit after the number, but fade out simultaneously
              let innerP = clamp((p5 - 0.3) / 0.7, 0, 1);
              el.style.opacity = globalProgress < 0.1325 ? innerP : p5; 
            });
          }
          if (cineProbsNum) {
            const pNum = clamp((globalProgress - 0.115) / 0.015, 0, 1);
            if (pNum < 0.8) cineProbsNum.textContent = "800";
            else cineProbsNum.textContent = "800+";
          }
        }
        
        // Scene 6 (Hackathon)
        const p6 = animateScene(5, 0.140, 0.175);
        if (p6 > 0 && cineMaskReveal) {
          // Reveal clip-path during the entrance
          const revealP = clamp((globalProgress - 0.145) / 0.012, 0, 1);
          const revealPct = lerp(100, 0, smoothstep(0, 1, revealP));
          cineMaskReveal.style.clipPath = `inset(0 ${revealPct}% 0 0)`;
          
          // Finspark line fades in after
          const finspark = cineScenes[5].querySelector('.cine-subtext');
          if (finspark) {
            let finP = clamp((p6 - 0.4) / 0.6, 0, 1);
            finspark.style.opacity = globalProgress < 0.1575 ? finP : p6;
          }
        }
        
        // Scene 7 (Final Statement)
        const p7 = animateScene(6, 0.165, 0.195, 0.20); 
        if (p7 > 0) {
          const line2 = cineScenes[6].querySelector('.cine-statement-2');
          if (line2) {
            let innerP = clamp((p7 - 0.4) / 0.6, 0, 1);
            line2.style.opacity = globalProgress < 0.180 ? innerP : p7;
            // Subtly move it up slightly as it reveals
            line2.style.transform = `translateY(${lerp(10, 0, innerP)}px)`;
          }
        }
      } else if (globalProgress >= 0.77) {
        // Attic approach sequence (targetSeqIndex 17 to 21)
        const startP = 17 * (1 / 22); // ~0.7727
        const length = 5 * (1 / 22);  // ~0.2272
        const localP = clamp((globalProgress - startP) / length, 0, 1);

        // Make sure the parent containers are visible so we can animate their children
        if (cineScenes[7]) { cineScenes[7].style.opacity = 1; cineScenes[7].style.visibility = 'visible'; }
        if (cineScenes[8]) { cineScenes[8].style.opacity = 1; cineScenes[8].style.visibility = 'visible'; }
        if (cineScenes[9]) { cineScenes[9].style.opacity = 1; cineScenes[9].style.visibility = 'visible'; }

        const animateAtticElement = (selector, enterStart, enterEnd, exitStart, exitEnd, startY = 25, startBlur = 6) => {
          const el = document.querySelector(selector);
          if (!el) return;
          
          if (localP <= enterStart || localP >= exitEnd) {
            el.style.opacity = 0;
            el.style.visibility = 'hidden';
            return;
          }
          
          el.style.visibility = 'visible';
          let opacity = 1;
          let translateY = 0;
          let blur = 0;
          
          if (localP < enterEnd) {
            const t = smoothstep(enterStart, enterEnd, localP);
            opacity = t;
            translateY = lerp(startY, 0, t);
            blur = lerp(startBlur, 0, t);
          } else if (localP > exitStart) {
            const t = smoothstep(exitStart, exitEnd, localP);
            opacity = 1 - t;
            translateY = lerp(0, -15, t);
            blur = lerp(0, startBlur, t);
          }
          
          el.style.opacity = opacity;
          el.style.transform = `translateY(${translateY}px)`;
          el.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
        };

        // 0%–35% First Group
        animateAtticElement('#attic-freelancer', 0.00, 0.10, 0.25, 0.35, 25, 6);
        animateAtticElement('#attic-webdev',     0.05, 0.20, 0.25, 0.35, 15, 4);
        
        // 25%–55% Second Group
        animateAtticElement('#attic-aidev',      0.25, 0.35, 0.45, 0.55, 25, 6);
        animateAtticElement('#attic-aibuild',    0.30, 0.40, 0.45, 0.55, 15, 4);
        
        // 45%–75% Third Group (Fully gone before reaching the PC)
        animateAtticElement('#attic-open',       0.45, 0.55, 0.65, 0.75, 25, 6);
        animateAtticElement('#attic-collab',     0.50, 0.60, 0.65, 0.75, 15, 4);
      } else {
        // Not in any active cinematic zones, hide all
        cineScenes.forEach(scene => {
          if (scene) {
            scene.style.opacity = 0;
            scene.style.visibility = 'hidden';
          }
        });
      }
    }

    // --- BULLETIN BOARD DOM INTERACTION ---
    const seq4Start = 4 / segmentCount;
    const seq4End = 5 / segmentCount;

    let seq4Progress = (globalProgress - seq4Start) / (seq4End - seq4Start);
    seq4Progress = Math.max(0, Math.min(1, seq4Progress));

    // The HUD hint is active during the first 40% of seq4
    if (seq4Progress > 0 && seq4Progress < 0.40) {
      if (hud && hud.style.opacity !== '1') hud.style.opacity = '1';
    } else {
      if (hud && hud.style.opacity !== '0') hud.style.opacity = '0';
    }

    // Bulletin cards appear between 40% and 95% of seq4
    let bulletinProgress = (seq4Progress - 0.40) / 0.55;
    bulletinProgress = Math.max(0, Math.min(1, bulletinProgress));

    if (papers[0] && papers[1] && papers[2] && papers[3]) {
      // Paper 1: 0.00 -> 0.20
      const p1 = Math.max(0, Math.min(1, (bulletinProgress - 0.0) / 0.20));
      papers[0].style.opacity = p1;
      papers[0].style.transform = `scale(${lerp(0.92, 1, p1)}) translateY(${lerp(-30, 0, p1)}px) rotate(${lerp(-4, -2, p1)}deg)`;

      // Paper 2: 0.20 -> 0.40
      const p2 = Math.max(0, Math.min(1, (bulletinProgress - 0.20) / 0.20));
      papers[1].style.opacity = p2;
      papers[1].style.transform = `scale(${lerp(0.94, 1, p2)}) translateY(${lerp(25, 0, p2)}px) rotate(${lerp(5, 3, p2)}deg)`;

      // Paper 3: 0.40 -> 0.60
      const p3 = Math.max(0, Math.min(1, (bulletinProgress - 0.40) / 0.20));
      papers[2].style.opacity = p3;
      papers[2].style.transform = `scale(${lerp(0.93, 1, p3)}) translateX(${lerp(25, 0, p3)}px) rotate(${lerp(-5, -3, p3)}deg)`;

      // Paper 4: 0.60 -> 0.80
      const p4 = Math.max(0, Math.min(1, (bulletinProgress - 0.60) / 0.20));
      papers[3].style.opacity = p4;
      papers[3].style.transform = `scale(${lerp(0.90, 1, p4)}) translateY(${lerp(-20, 0, p4)}px) rotate(${lerp(4, 2, p4)}deg)`;
    }

    // --- BOOK DOM INTERACTION ---
    const seq5Start = 5 * segmentSize;
    let seq5Progress = (globalProgress - seq5Start) / segmentSize;
    seq5Progress = Math.max(0, Math.min(1, seq5Progress));

    // Fade out bulletin board early in seq5
    if (seq5Progress > 0) {
      const fadeOut = Math.max(0, 1 - (seq5Progress * 5)); // Fade out quickly
      if (papers[0]) papers[0].style.opacity = Math.min(papers[0].style.opacity, fadeOut);
      if (papers[1]) papers[1].style.opacity = Math.min(papers[1].style.opacity, fadeOut);
      if (papers[2]) papers[2].style.opacity = Math.min(papers[2].style.opacity, fadeOut);
      if (papers[3]) papers[3].style.opacity = Math.min(papers[3].style.opacity, fadeOut);
    }

    // Transition to the flat, top-down book background image
    const bookTopBg = document.getElementById('book-top-bg');
    if (targetSeqIndex >= 5 && targetSeqIndex <= 9 && seq5Progress > 0.65) {
      let easeFade = 1;
      if (targetSeqIndex === 5) {
        const fadeProgress = Math.max(0, Math.min(1, (seq5Progress - 0.65) / 0.30));
        easeFade = 1 - Math.pow(1 - fadeProgress, 3);
      }
      if (targetSeqIndex === 9) {
        const seq9Start = 9 * segmentSize;
        const seq9Progress = Math.max(0, Math.min(1, (globalProgress - seq9Start) / segmentSize));
        // Fade out the book at the very end of segment 9 before segment 10 (staircase) starts
        const fadeOutProgress = Math.max(0, Math.min(1, (seq9Progress - 0.8) / 0.2));
        easeFade = 1 - fadeOutProgress;
      }
      if (bookTopBg) bookTopBg.style.opacity = easeFade;
    } else {
      if (bookTopBg) bookTopBg.style.opacity = 0;
    }

    if (spreadData && spreadData.length > 0) {
      // Helper to reveal words based on progress
      const applyTypingEffect = (words, progress) => {
        if (!words) return;
        const totalWords = words.length;
        const visibleWords = Math.floor(progress * totalWords);
        for(let i=0; i<totalWords; i++) {
          words[i].style.opacity = i < visibleWords ? 1 : 0;
        }
      };

      if (targetSeqIndex < 6) {
        spreadData.forEach(spread => { if(spread) spread.el.style.opacity = 0; });
      } else if (targetSeqIndex >= 6 && targetSeqIndex <= 9) {
        spreadData.forEach((spread, index) => {
          if (!spread) return;
          const activeSegment = 6 + index;
          
          if (targetSeqIndex === activeSegment) {
            spread.el.style.opacity = 1;
            
            const segStart = activeSegment * segmentSize;
            const segProgress = Math.max(0, Math.min(1, (globalProgress - segStart) / segmentSize));
            
            // If it's the last spread, fade it out at the end of its segment
            if (index === spreadData.length - 1 && segProgress > 0.8) {
              spread.el.style.opacity = 1 - ((segProgress - 0.8) / 0.2);
            }
            
            // Left page types from 10% to 40%
            const leftProgress = Math.max(0, Math.min(1, (segProgress - 0.10) / 0.30));
            applyTypingEffect(spread.leftWords, leftProgress);
            
            // Right page types from 40% to 70%
            const rightProgress = Math.max(0, Math.min(1, (segProgress - 0.40) / 0.30));
            applyTypingEffect(spread.rightWords, rightProgress);
            
          } else if (targetSeqIndex === activeSegment + 1) {
            // Fade out the previous spread in the first 20% of the next segment
            const nextSegStart = (activeSegment + 1) * segmentSize;
            const nextSegProgress = Math.max(0, Math.min(1, (globalProgress - nextSegStart) / segmentSize));
            
            if (nextSegProgress < 0.20) {
              spread.el.style.opacity = 1 - (nextSegProgress / 0.20);
            } else {
              spread.el.style.opacity = 0;
            }
            // Keep words fully visible while fading out
            applyTypingEffect(spread.leftWords, 1);
            applyTypingEffect(spread.rightWords, 1);
          } else {
            spread.el.style.opacity = 0;
          }
        });
      } else {
        spreadData.forEach(spread => { if(spread) spread.el.style.opacity = 0; });
      }
    }

    // --- STAIRCASE DOM INTERACTION ---
    const staircaseSteps = [
      document.getElementById('step-1'),
      document.getElementById('step-2'),
      document.getElementById('step-3'),
      document.getElementById('step-4'),
      document.getElementById('step-5')
    ];

    if (staircaseSteps[0]) {
      const animateStepByProgress = (stepEl, startP, endP, currentP) => {
        let opacity = 0;
        let transformY = 20;

        if (currentP >= startP && currentP <= endP) {
          const duration = endP - startP;
          // Fade in during first 20% of its slot
          const fadeInEnd = startP + (duration * 0.2);
          // Fade out during last 20% of its slot
          const fadeOutStart = endP - (duration * 0.2);

          if (currentP < fadeInEnd) {
            const p = (currentP - startP) / (duration * 0.2);
            opacity = p;
            transformY = 20 * (1 - p);
          } else if (currentP > fadeOutStart) {
            const p = (currentP - fadeOutStart) / (duration * 0.2);
            opacity = 1 - p;
            transformY = -20 * p;
          } else {
            opacity = 1;
            transformY = 0;
          }
        }
        
        stepEl.style.opacity = opacity;
        stepEl.style.transform = `translateY(${transformY}px)`;
      };

      if (videoSeqIndex === 6) {
        // The camera pans the living room first. 
        // We estimate the physical climbing starts at 55% of the video duration.
        const climbStartP = 0.55; 
        const stepDur = (1.0 - climbStartP) / 5;
        
        animateStepByProgress(staircaseSteps[0], climbStartP, climbStartP + stepDur, videoProgress);
        animateStepByProgress(staircaseSteps[1], climbStartP + stepDur, climbStartP + 2 * stepDur, videoProgress);
        animateStepByProgress(staircaseSteps[2], climbStartP + 2 * stepDur, climbStartP + 3 * stepDur, videoProgress);
        animateStepByProgress(staircaseSteps[3], climbStartP + 3 * stepDur, climbStartP + 4 * stepDur, videoProgress);
        animateStepByProgress(staircaseSteps[4], climbStartP + 4 * stepDur, 1.0, videoProgress);
      } else {
        staircaseSteps.forEach(el => {
          if (el) {
            el.style.opacity = 0;
            el.style.transform = `translateY(20px)`;
          }
        });
      }
    }

    // EXPLORE logic
    const exploreLayer = document.getElementById('computer-screen-layer');
    const exploreBtn = document.getElementById('explore-btn');
    if (videoSeqIndex === 7 && videoProgress > 0.98) {
      exploreLayer.style.opacity = 1;
      exploreLayer.style.pointerEvents = 'auto';
      exploreBtn.style.opacity = 1;
      exploreBtn.style.transform = 'scale(1)';
    } else {
      exploreLayer.style.opacity = 0;
      exploreLayer.style.pointerEvents = 'none';
      exploreBtn.style.opacity = 0;
      exploreBtn.style.transform = 'scale(0.98)';
    }

    requestAnimationFrame(render);
  }

  // Pre-fill the queue at the start position before kicking off render
  frameManager.updatePreloadWindow(0, 1);

  // Initial draw kick-off
  // We'll wait until the very first frame is loaded to avoid a blank screen on load
  const checkInitialLoad = setInterval(() => {
    const firstImg = frameManager.getFrame(0, 1);
    if (firstImg && firstImg.complete) {
      clearInterval(checkInitialLoad);
      requestAnimationFrame(render);
    }
  }, 10);
}

// Start everything
init();

// =========================================================
// DIGITAL ARCHIVE LOGIC
// =========================================================
const exploreBtn = document.getElementById('explore-btn');
const digitalArchiveLayer = document.getElementById('digital-archive-layer');
const archiveViews = document.querySelectorAll('.archive-view');
const navBtns = document.querySelectorAll('.nav-btn');
const doorCards = document.querySelectorAll('.door-card');
const backBtns = document.querySelectorAll('.back-btn');
const certGrid = document.getElementById('cert-grid');
const internshipGrid = document.getElementById('internship-grid');
const projectGrid = document.getElementById('project-grid');
const certCount = document.getElementById('cert-count');
const projectCount = document.getElementById('project-count');

const certViewer = document.getElementById('cert-viewer-overlay');
const closeViewerBtn = document.querySelector('.close-viewer-btn');
const viewerImg = document.getElementById('viewer-img');
const viewerTitle = document.getElementById('viewer-title');
const viewerOrg = document.getElementById('viewer-org');
const viewerDate = document.getElementById('viewer-date');
const viewerCat = document.getElementById('viewer-category');

function showArchiveView(targetId) {
  archiveViews.forEach(view => view.classList.remove('active'));
  navBtns.forEach(btn => btn.classList.remove('active'));
  
  const targetView = document.getElementById(`archive-${targetId}`);
  if (targetView) targetView.classList.add('active');
  
  const activeNavBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
  if (activeNavBtn) activeNavBtn.classList.add('active');
}

exploreBtn.addEventListener('click', () => {
  // Reveal the archive layer
  digitalArchiveLayer.style.opacity = 1;
  digitalArchiveLayer.style.pointerEvents = 'auto';
  // Disable scrolling to lock user in the archive
  document.body.style.overflow = 'hidden';
  showArchiveView('home');
});

const closeArchiveBtn = document.getElementById('close-archive-btn');
if (closeArchiveBtn) {
  closeArchiveBtn.addEventListener('click', () => {
    digitalArchiveLayer.style.opacity = 0;
    digitalArchiveLayer.style.pointerEvents = 'none';
    document.body.style.overflow = 'auto';
  });
}

// Navigation clicks
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    showArchiveView(btn.dataset.target);
  });
});
doorCards.forEach(card => {
  card.addEventListener('click', () => {
    showArchiveView(card.dataset.open);
  });
});
backBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    showArchiveView(btn.dataset.back);
  });
});

// Populate Certificates
if (certGrid) {
  certCount.textContent = `${certificates.length} CREDENTIALS`;
  certificates.forEach(cert => {
    const card = document.createElement('div');
    card.className = 'cert-card';
    card.innerHTML = `
      <div class="cert-image-wrap">
        <img src="${cert.image}" alt="${cert.title}" loading="lazy" />
        <div class="cert-overlay">VIEW CERTIFICATE &rarr;</div>
      </div>
      <div class="cert-meta">
        <div class="cert-title">${cert.title}</div>
        <div class="cert-org">${cert.organization}</div>
        <div class="cert-date">${cert.date}</div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      viewerImg.src = cert.image;
      viewerTitle.textContent = cert.title;
      viewerOrg.textContent = cert.organization;
      viewerDate.textContent = cert.date;
      viewerCat.textContent = cert.category;
      
      certViewer.classList.add('active');
    });
    
    certGrid.appendChild(card);
  });
}

// Populate Internships
if (internshipGrid) {
  internships.forEach(internship => {
    const card = document.createElement('div');
    card.className = 'cert-card';
    card.innerHTML = `
      <div class="cert-image-wrap">
        <img src="${internship.image}" alt="${internship.role}" loading="lazy" />
        <div class="cert-overlay">VIEW DOCUMENT &rarr;</div>
      </div>
      <div class="cert-meta">
        <div class="cert-title">${internship.role}</div>
        <div class="cert-org">${internship.organization}</div>
        <div class="cert-date">${internship.duration}</div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      viewerImg.src = internship.image;
      viewerTitle.textContent = internship.role;
      viewerOrg.textContent = internship.organization;
      viewerDate.textContent = internship.duration;
      viewerCat.textContent = "Internship";
      
      certViewer.classList.add('active');
    });
    
    internshipGrid.appendChild(card);
  });
}

// Populate Projects
if (projectGrid) {
  projectCount.textContent = `${projects.length} PROJECTS`;
  projects.forEach(project => {
    const card = document.createElement('a');
    card.className = 'project-card';
    card.href = project.url;
    card.target = "_blank"; // Open in new tab
    card.style.textDecoration = 'none'; // Ensure no underline
    card.innerHTML = `
      <div class="project-title">${project.name}</div>
      <div class="project-desc">${project.description}</div>
      <div class="project-meta">
        <span class="project-lang">● ${project.language}</span>
        <span class="project-stars">★ ${project.stars}</span>
      </div>
    `;
    projectGrid.appendChild(card);
  });
}

closeViewerBtn.addEventListener('click', () => {
  certViewer.classList.remove('active');
  setTimeout(() => {
    viewerImg.src = '';
  }, 400); // clear after fade out
});
