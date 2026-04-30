import * as THREE from 'three';
import { animate } from 'framer-motion';

// --- Config Engine ---
let config = {
    count: 8, height: 2.2, aspect: 16/9, radius: 4.0, padding: 0.3, cameraZ: 12,
    cornerRadius: 0.05, audioHigh: 140, audioLow: 40, audioDur: 0.04,
    autoDur: 3.0
};

const defaultTemplates = [
    { type: 'image', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200', isLocal: false }
];

let items = [...defaultTemplates];
let isUsingDefaults = true;

// --- Animation References ---
let rotAnim = null;
let autoplayAnim = null;

// --- Autoplay State ---
let isAutoplayPaused = false;

const svgPlay = `<svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>`;
const svgPause = `<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>`;

document.getElementById('autoplay-toggle').onclick = () => {
    isAutoplayPaused = !isAutoplayPaused;
    document.getElementById('autoplay-toggle').innerHTML = isAutoplayPaused ? svgPlay : svgPause;
    if (isAutoplayPaused) {
        if (autoplayAnim) autoplayAnim.stop();
        const activeProgress = document.querySelector('.dot.active .progress');
        if (activeProgress) activeProgress.style.width = '100%';
    } else {
        if (!isMoving && !isDragging) startAutoplay();
    }
};

function stopAutoplay() {
    if (autoplayAnim) autoplayAnim.stop();
    document.querySelectorAll('.dot .progress').forEach(p => p.style.width = '0%');
}

function startAutoplay() {
    stopAutoplay();
    if (config.count <= 1 || isAutoplayPaused) return;

    const activeProgress = document.querySelector('.dot.active .progress');
    if (!activeProgress) return;

    autoplayAnim = animate(0, 100, {
        duration: config.autoDur,
        ease: [0.4, 0.0, 0.2, 1],
        onUpdate: (v) => { activeProgress.style.width = `${v}%`; },
        onComplete: () => { animateTo(currentTargetIndex - 1); }
    });
}

// --- Audio Engine (Arrows & Keyboard Only) ---
let audioCtx = null;
function playClick() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;

    const noise = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.01, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < buf.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.setValueAtTime(1800, t);
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.04, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
    noise.connect(nf); nf.connect(ng); ng.connect(audioCtx.destination);
    noise.start(t);

    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(config.audioHigh, t);
    osc.frequency.exponentialRampToValueAtTime(config.audioLow, t + config.audioDur);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + config.audioDur);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + config.audioDur);
}

// --- WebGL Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.z = config.cameraZ;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const carouselGroup = new THREE.Group();
scene.add(carouselGroup);

const vertexShader = `
    uniform float uBend; uniform float uRadius; varying vec2 vUv;
    void main() {
        vUv = uv; float angle = position.x / uRadius;
        vec3 curved = vec3(sin(angle) * uRadius, position.y, cos(angle) * uRadius - uRadius);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(position, curved, uBend), 1.0);
    }
`;

const fragmentShader = `
    uniform sampler2D uTex; uniform float uOpacity; uniform float uPlaneAspect;
    uniform float uTexAspect; uniform float uCornerRadius; varying vec2 vUv;
    float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + vec2(r);
        return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
    }
    void main() {
        vec2 fitUv = vUv - 0.5;
        if (uPlaneAspect > uTexAspect) fitUv.y *= uTexAspect / uPlaneAspect;
        else fitUv.x *= uPlaneAspect / uTexAspect;
        fitUv += 0.5;

        vec4 texColor = texture2D(uTex, clamp(fitUv, 0.0, 1.0));

        vec2 p = (vUv - 0.5) * vec2(uPlaneAspect, 1.0);
        vec2 b = vec2(uPlaneAspect, 1.0) * 0.5;
        float d = sdRoundedBox(p, b, uCornerRadius);
        float aa = fwidth(d) * 1.5;
        float edgeAlpha = 1.0 - smoothstep(-aa, aa, d);

        gl_FragColor = vec4(texColor.rgb, texColor.a * edgeAlpha * uOpacity);
    }
`;

const meshes = [];
const textureLoader = new THREE.TextureLoader();

function createVideoTexture(url, meshUniforms) {
    const vid = document.createElement('video');
    vid.src = url; vid.crossOrigin = 'Anonymous'; vid.loop = true;
    vid.muted = true; vid.playsInline = true; vid.autoplay = true;
    vid.addEventListener('loadedmetadata', () => { meshUniforms.uTexAspect.value = vid.videoWidth / vid.videoHeight; });
    vid.play().catch(() => {});
    const tex = new THREE.VideoTexture(vid);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    return tex;
}

function updateRadiusForCount() {
    const width = config.height * config.aspect;
    config.radius = (config.count * (width + config.padding)) / (2 * Math.PI);
}

function stopAllMeshAnimations() {
    meshes.forEach(m => {
        if (m.userData.opAnim) m.userData.opAnim.stop();
        if (m.userData.bendAnim) m.userData.bendAnim.stop();
    });
}

function rebuildCarousel() {
    stopAutoplay();
    if (rotAnim) rotAnim.stop();
    stopAllMeshAnimations();

    while (carouselGroup.children.length > 0) {
        const child = carouselGroup.children[0];
        child.geometry.dispose();
        if (child.material.uniforms.uTex.value) child.material.uniforms.uTex.value.dispose();
        child.material.dispose(); carouselGroup.remove(child);
    }
    meshes.length = 0;

    const width = config.height * config.aspect;

    for (let i = 0; i < config.count; i++) {
        const item = items[i];
        const uniforms = {
            uBend: { value: 1 }, uRadius: { value: config.radius }, uTex: { value: null },
            uOpacity: { value: 1 }, uPlaneAspect: { value: config.aspect },
            uTexAspect: { value: 1.0 }, uCornerRadius: { value: config.cornerRadius }
        };

        if (item.type === 'video') uniforms.uTex.value = createVideoTexture(item.url, uniforms);
        else {
            uniforms.uTex.value = textureLoader.load(item.url, (tex) => {
                uniforms.uTexAspect.value = tex.image.width / tex.image.height;
            });
        }

        const mat = new THREE.ShaderMaterial({
            uniforms: uniforms, vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide, depthWrite: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, config.height, 80, 1), mat);
        const theta = (i / config.count) * Math.PI * 2;
        mesh.position.set(Math.sin(theta) * config.radius, 0, Math.cos(theta) * config.radius);
        mesh.rotation.y = theta;
        carouselGroup.add(mesh); meshes.push(mesh);
    }

    const pill = document.getElementById('pill');
    pill.innerHTML = '';
    for (let i = 0; i < config.count; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        const p = document.createElement('div');
        p.className = 'progress';
        d.appendChild(p);
        pill.appendChild(d);
    }

    rotationY = 0; currentTargetIndex = 0; carouselGroup.rotation.y = 0; updateUI();
    setVisualState(false);
}

// --- Content Manager ---
function renderGrid() {
    const grid = document.getElementById('media-grid'); grid.innerHTML = '';
    items.forEach((item, idx) => {
        const div = document.createElement('div'); div.className = 'grid-item';
        div.innerHTML = `
            ${item.type === 'video' ? `<video src="${item.url}" muted playsinline></video>` : `<img src="${item.url}">`}
            <div class="del-btn" data-idx="${idx}">×</div>
        `;
        grid.appendChild(div);
    });

    grid.querySelectorAll('.del-btn').forEach(btn => {
        btn.onclick = () => deleteItem(parseInt(btn.dataset.idx, 10));
    });
}

document.getElementById('global-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    if (isUsingDefaults) { items = []; isUsingDefaults = false; }
    files.forEach(f => items.push({ type: f.type.startsWith('video/') ? 'video' : 'image', url: URL.createObjectURL(f), isLocal: true }));
    config.count = items.length; updateRadiusForCount(); renderGrid(); rebuildCarousel(); e.target.value = '';
});

function deleteItem(idx) {
    if (items[idx].isLocal) URL.revokeObjectURL(items[idx].url);
    items.splice(idx, 1);
    if (items.length === 0) { isUsingDefaults = true; items = [...defaultTemplates]; }
    config.count = items.length; updateRadiusForCount(); renderGrid(); rebuildCarousel();
}

// --- Core Motion Logic ---
let rotationY = 0, isDragging = false, isMoving = false, lastX = 0, currentTargetIndex = 0;
const step = (Math.PI * 2) / config.count;

function getActiveIndex() {
    return ((Math.round(-rotationY / step) % config.count) + config.count) % config.count;
}

function updateUI() {
    const visualIdx = getActiveIndex();
    document.querySelectorAll('.dot').forEach((dot, i) => {
        if (i === visualIdx) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
            dot.querySelector('.progress').style.width = '0%';
        }
    });
}

function setVisualState(moving) {
    isMoving = moving;
    if (moving) {
        stopAutoplay();
    } else {
        startAutoplay();
    }
}

function animateTo(targetIdx) {
    currentTargetIndex = targetIdx;
    setVisualState(true);
    if (rotAnim) rotAnim.stop();

    rotAnim = animate(carouselGroup.rotation.y, currentTargetIndex * step, {
        type: 'spring', stiffness: 180, damping: 26, mass: 1, restDelta: 0.0005,
        onUpdate: v => { rotationY = v; carouselGroup.rotation.y = rotationY; updateUI(); },
        onComplete: () => setVisualState(false)
    });
}

const onDown = (x, y) => {
    if (isMoving) return;
    isDragging = true; lastX = x;
    if (rotAnim) rotAnim.stop();
    setVisualState(true);
};

const onMove = (x, y, target) => {
    if (!isDragging) {
        document.body.style.cursor = target && target.tagName === 'CANVAS' ? 'grab' : 'default';
    } else {
        document.body.style.cursor = 'grabbing';
        rotationY += (lastX - x) * 0.006; carouselGroup.rotation.y = rotationY; lastX = x; updateUI();
    }
};

const onUp = () => {
    if (!isDragging) return;
    isDragging = false; animateTo(Math.round(rotationY / step));
};

// --- Interaction Listeners ---
window.addEventListener('mousedown', e => {
    const p = document.getElementById('settings-panel'), t = document.getElementById('settings-toggle');
    if (p.classList.contains('open') && !p.contains(e.target) && !t.contains(e.target)) p.classList.remove('open');
    if (e.target.tagName === 'CANVAS') onDown(e.clientX, e.clientY);
});
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY, e.target));
window.addEventListener('mouseup', onUp);

window.addEventListener('touchstart', e => {
    const p = document.getElementById('settings-panel'), t = document.getElementById('settings-toggle');
    if (p.classList.contains('open') && !p.contains(e.target) && !t.contains(e.target)) p.classList.remove('open');
    if (e.target.tagName === 'CANVAS') onDown(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchmove', e => onMove(e.touches[0].clientX, e.touches[0].clientY, e.target));
window.addEventListener('touchend', onUp);

// Arrows & Keyboard Triggers Audio & Move
document.getElementById('next-btn').onclick = () => { if (config.count > 1) { playClick(); animateTo(currentTargetIndex - 1); } };
document.getElementById('prev-btn').onclick = () => { if (config.count > 1) { playClick(); animateTo(currentTargetIndex + 1); } };

window.addEventListener('keydown', (e) => {
    if (config.count > 1) {
        if (e.key === 'ArrowRight') { playClick(); animateTo(currentTargetIndex - 1); }
        if (e.key === 'ArrowLeft') { playClick(); animateTo(currentTargetIndex + 1); }
    }
});

document.getElementById('pill').onclick = (e) => {
    if (config.count <= 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const targetIdx = Math.floor(((e.clientX - r.left) / r.width) * config.count);
    let diff = targetIdx - getActiveIndex();
    if (diff > config.count/2) diff -= config.count;
    if (diff < -config.count/2) diff += config.count;
    if (diff !== 0) animateTo(currentTargetIndex - diff);
};

// --- Parameter Control UI ---
const panel = document.getElementById('settings-panel');
document.getElementById('settings-toggle').onclick = () => panel.classList.toggle('open');

const inputs = ['cameraZ', 'height', 'padding', 'cornerRadius', 'autoDur', 'arrowPad', 'pillBottom', 'audioHigh', 'audioLow', 'audioDur'];
inputs.forEach(id => {
    document.getElementById('param-' + id).oninput = (e) => {
        let val = parseFloat(e.target.value);
        document.getElementById('val-' + id).innerText = id.includes('audio') || id.includes('Pad') || id.includes('Bottom')
            ? val + (id.includes('Dur') ? 'ms' : (id.includes('Pad') || id.includes('Bottom') ? 'px' : 'Hz'))
            : (id === 'autoDur' ? val.toFixed(1) + 's' : val.toFixed(2));

        if (id === 'cameraZ') { config.cameraZ = val; camera.position.z = val; }
        else if (id === 'height') {
            config.height = val;
            updateRadiusForCount();
            const width = config.height * config.aspect;
            meshes.forEach((m, i) => {
                m.geometry.dispose();
                m.geometry = new THREE.PlaneGeometry(width, config.height, 80, 1);
                const theta = (i / config.count) * Math.PI * 2;
                m.position.set(Math.sin(theta) * config.radius, 0, Math.cos(theta) * config.radius);
                m.material.uniforms.uRadius.value = config.radius;
            });
        }
        else if (id === 'padding') {
            config.padding = val;
            updateRadiusForCount();
            meshes.forEach((m, i) => {
                const theta = (i / config.count) * Math.PI * 2;
                m.position.set(Math.sin(theta) * config.radius, 0, Math.cos(theta) * config.radius);
                m.material.uniforms.uRadius.value = config.radius;
            });
        }
        else if (id === 'cornerRadius') { config.cornerRadius = val; meshes.forEach(m => m.material.uniforms.uCornerRadius.value = val); }
        else if (id === 'arrowPad') { document.documentElement.style.setProperty('--arrow-pad', val + 'px'); }
        else if (id === 'pillBottom') { document.documentElement.style.setProperty('--pill-bottom', val + 'px'); }
        else if (id === 'autoDur') { config.autoDur = val; if (!isMoving) startAutoplay(); }
        else { config[id] = id === 'audioDur' ? val / 1000 : val; }
    };
});
document.getElementById('val-audioDur').innerText = (config.audioDur * 1000) + 'ms';

// --- Init ---
renderGrid();
updateRadiusForCount();
rebuildCarousel();

function animateFrame() { renderer.render(scene, camera); requestAnimationFrame(animateFrame); }
animateFrame();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
