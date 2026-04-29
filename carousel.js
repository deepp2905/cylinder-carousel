import * as THREE from 'three';
import gsap from 'gsap';

// --- Config Engine ---
let config = {
    count: 4, height: 2.2, aspect: 16/9, radius: 4.0, cameraZ: 12,
    cornerRadius: 0.05, audioHigh: 140, audioLow: 40, audioDur: 0.04
};

// Zero-Dependency Defaults (4 Blank White Screens)
const defaultTemplates = [
    { type: 'blank' }, { type: 'blank' }, { type: 'blank' }, { type: 'blank' }
];

let items = [...defaultTemplates];
let isUsingDefaults = true;

// --- Procedural Textures ---
function createBlankTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 9;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 16, 9);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function createVideoTexture(url, meshUniforms) {
    const vid = document.createElement('video');
    vid.src = url; vid.crossOrigin = 'Anonymous'; vid.loop = true;
    vid.muted = true; vid.playsInline = true; vid.autoplay = true;
    vid.addEventListener('loadedmetadata', () => {
        meshUniforms.uTexAspect.value = vid.videoWidth / vid.videoHeight;
    });
    vid.play().catch(() => {});
    const tex = new THREE.VideoTexture(vid);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    return tex;
}

// --- Audio Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClick() {
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
const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);
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
    uniform sampler2D uTex;
    uniform float uOpacity;
    uniform float uPlaneAspect;
    uniform float uTexAspect;
    uniform float uCornerRadius;
    varying vec2 vUv;

    float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + vec2(r);
        return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
    }

    void main() {
        // Object Fit: Contain
        vec2 fitUv = vUv - 0.5;
        if (uPlaneAspect > uTexAspect) {
            fitUv.x *= uPlaneAspect / uTexAspect;
        } else {
            fitUv.y *= uTexAspect / uPlaneAspect;
        }
        fitUv += 0.5;

        vec4 texColor = texture2D(uTex, fitUv);

        float maskX = step(0.0, fitUv.x) * step(fitUv.x, 1.0);
        float maskY = step(0.0, fitUv.y) * step(fitUv.y, 1.0);
        texColor *= (maskX * maskY);

        // Corner Radius Mask
        vec2 p = (vUv - 0.5) * vec2(uPlaneAspect, 1.0);
        vec2 b = vec2(uPlaneAspect, 1.0) * 0.5;
        float d = sdRoundedBox(p, b, uCornerRadius);
        float edgeAlpha = 1.0 - smoothstep(0.0, 0.005, d);

        gl_FragColor = vec4(texColor.rgb, texColor.a * edgeAlpha * uOpacity);
    }
`;

const meshes = [];
const textureLoader = new THREE.TextureLoader();

function updateRadiusForCount() {
    const minRadius = config.height * config.aspect * 0.7;
    const calculated = (config.count * (config.height * config.aspect)) / (2 * Math.PI) + 0.3;
    config.radius = Math.max(minRadius, calculated);
    document.getElementById('param-radius').value = config.radius;
    document.getElementById('val-radius').innerText = config.radius.toFixed(1);
}

function rebuildCarousel() {
    while (carouselGroup.children.length > 0) {
        const child = carouselGroup.children[0];
        child.geometry.dispose();
        if (child.material.uniforms.uTex.value) child.material.uniforms.uTex.value.dispose();
        child.material.dispose();
        carouselGroup.remove(child);
    }
    meshes.length = 0;

    const width = config.height * config.aspect;

    for (let i = 0; i < config.count; i++) {
        const item = items[i];

        const uniforms = {
            uBend: { value: 0 },
            uRadius: { value: config.radius },
            uTex: { value: null },
            uOpacity: { value: i === 0 ? 1 : 0 },
            uPlaneAspect: { value: config.aspect },
            uTexAspect: { value: 16/9 },
            uCornerRadius: { value: config.cornerRadius }
        };

        if (item.type === 'video') {
            uniforms.uTex.value = createVideoTexture(item.url, uniforms);
        } else if (item.type === 'image') {
            uniforms.uTex.value = textureLoader.load(item.url, (tex) => {
                uniforms.uTexAspect.value = tex.image.width / tex.image.height;
            });
        } else {
            uniforms.uTex.value = createBlankTexture();
        }

        const mat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide, depthWrite: false
        });

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, config.height, 80, 1), mat);
        const theta = (i / config.count) * Math.PI * 2;
        mesh.position.set(Math.sin(theta) * config.radius, 0, Math.cos(theta) * config.radius);
        mesh.rotation.y = theta;
        carouselGroup.add(mesh);
        meshes.push(mesh);
    }

    const pill = document.getElementById('pill');
    pill.innerHTML = '';
    for (let i = 0; i < config.count; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        pill.appendChild(d);
    }

    rotationY = 0; currentTargetIndex = 0; carouselGroup.rotation.y = 0; updateUI();
}

// --- Grid Manager ---
function renderGrid() {
    const grid = document.getElementById('media-grid');
    grid.innerHTML = '';
    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'grid-item';

        let mediaHTML = '';
        if (item.type === 'video') mediaHTML = `<video src="${item.url}" muted playsinline></video>`;
        else if (item.type === 'image') mediaHTML = `<img src="${item.url}">`;
        else mediaHTML = `<div class="blank-preview"></div>`;

        div.innerHTML = `
            ${mediaHTML}
            <div class="del-btn" data-idx="${idx}">×</div>
        `;
        grid.appendChild(div);
    });

    grid.querySelectorAll('.del-btn').forEach(btn => {
        btn.onclick = () => deleteItem(parseInt(btn.dataset.idx, 10));
    });
}

document.getElementById('global-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (isUsingDefaults) { items = []; isUsingDefaults = false; }
    files.forEach(file => {
        items.push({ type: file.type.startsWith('video/') ? 'video' : 'image', url: URL.createObjectURL(file), isLocal: true });
    });
    config.count = items.length;
    updateRadiusForCount(); renderGrid(); rebuildCarousel(); e.target.value = '';
});

function deleteItem(idx) {
    if (items[idx].isLocal) URL.revokeObjectURL(items[idx].url);
    items.splice(idx, 1);
    if (items.length === 0) { isUsingDefaults = true; items = [...defaultTemplates]; }
    config.count = items.length;
    updateRadiusForCount(); renderGrid(); rebuildCarousel();
}

// --- Interaction Logic ---
let rotationY = 0, lastTriggeredTick = 0, isDragging = false, isMoving = false, lastX = 0, currentTargetIndex = 0;

function getActiveIndex() {
    const step = (Math.PI * 2) / config.count;
    return (config.count - (((Math.round(rotationY / step) % config.count) + config.count) % config.count)) % config.count;
}

function updateUI() {
    const visualIdx = getActiveIndex();
    document.querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('active', i === visualIdx));
    const currentTick = Math.round(rotationY / ((Math.PI * 2) / config.count));
    if (currentTick !== lastTriggeredTick) { playClick(); lastTriggeredTick = currentTick; }
}

function setVisualState(moving) {
    isMoving = moving;
    const activeIdx = getActiveIndex();
    if (moving) {
        meshes.forEach(m => {
            gsap.to(m.material.uniforms.uOpacity, { value: 1, duration: 0.3, overwrite: true });
            gsap.to(m.material.uniforms.uBend, { value: 1, duration: 0.3, ease: "power2.out", overwrite: true });
        });
    } else {
        meshes.forEach((m, i) => {
            gsap.to(m.material.uniforms.uBend, { value: 0, duration: 0.45, ease: "power2.inOut", overwrite: true });
            if (i !== activeIdx) gsap.to(m.material.uniforms.uOpacity, { value: 0, duration: 0.45, ease: "power2.inOut", overwrite: true });
        });
    }
}

function animateTo(targetIdx) {
    currentTargetIndex = targetIdx;
    const step = (Math.PI * 2) / config.count;
    setVisualState(true);
    gsap.to(carouselGroup.rotation, {
        y: currentTargetIndex * step,
        duration: 0.8, ease: "expo.out", overwrite: true,
        onUpdate: () => { rotationY = carouselGroup.rotation.y; updateUI(); },
        onComplete: () => setVisualState(false)
    });
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const onDown = (x, y) => {
    if (isMoving) return;
    mouse.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.intersectObject(meshes[getActiveIndex()]).length > 0) {
        isDragging = true; lastX = x; gsap.killTweensOf(carouselGroup.rotation); setVisualState(true);
    }
};
const onMove = (x, y) => {
    if (!isDragging) {
        mouse.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
        document.body.style.cursor = raycaster.intersectObject(meshes[getActiveIndex()]).length > 0 ? 'grab' : 'default';
    } else {
        document.body.style.cursor = 'grabbing';
        rotationY += (x - lastX) * 0.006; carouselGroup.rotation.y = rotationY; lastX = x; updateUI();
    }
};
const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    animateTo(Math.round(rotationY / ((Math.PI * 2) / config.count)));
};

// --- Event Listeners ---
window.addEventListener('mousedown', e => {
    const panel = document.getElementById('settings-panel');
    const toggle = document.getElementById('settings-toggle');
    if (panel.classList.contains('open') && !panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.classList.remove('open');
    }
    if (e.target.tagName === 'CANVAS') onDown(e.clientX, e.clientY);
});
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', onUp);

window.addEventListener('touchstart', e => {
    const panel = document.getElementById('settings-panel');
    const toggle = document.getElementById('settings-toggle');
    if (panel.classList.contains('open') && !panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.classList.remove('open');
    }
    if (e.target.tagName === 'CANVAS') onDown(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchmove', e => onMove(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchend', onUp);

// Buttons & Keyboard
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
    if (diff !== 0) playClick();
    animateTo(currentTargetIndex - diff);
};

// --- Parameter Settings UI ---
const panel = document.getElementById('settings-panel');
document.getElementById('settings-toggle').onclick = () => panel.classList.toggle('open');

const inputs = ['cameraZ', 'height', 'radius', 'cornerRadius', 'arrowPad', 'pillBottom', 'audioHigh', 'audioLow', 'audioDur'];
inputs.forEach(id => {
    document.getElementById('param-' + id).oninput = (e) => {
        let val = parseFloat(e.target.value);
        document.getElementById('val-' + id).innerText = id.includes('audio') || id.includes('Pad') || id.includes('Bottom')
            ? val + (id.includes('Dur') ? 'ms' : (id.includes('Pad') || id.includes('Bottom') ? 'px' : 'Hz'))
            : val.toFixed(2);

        if (id === 'cameraZ') { config.cameraZ = val; camera.position.z = val; }
        else if (id === 'height') { config.height = val; updateRadiusForCount(); rebuildCarousel(); }
        else if (id === 'radius') { config.radius = val; rebuildCarousel(); }
        else if (id === 'cornerRadius') { config.cornerRadius = val; meshes.forEach(m => m.material.uniforms.uCornerRadius.value = val); }
        else if (id === 'arrowPad') { document.documentElement.style.setProperty('--arrow-pad', val + 'px'); }
        else if (id === 'pillBottom') { document.documentElement.style.setProperty('--pill-bottom', val + 'px'); }
        else { config[id] = id === 'audioDur' ? val / 1000 : val; }
    };
});

document.getElementById('val-audioDur').innerText = (config.audioDur * 1000) + 'ms';

// --- Init ---
renderGrid();
updateRadiusForCount();
rebuildCarousel();

function animate() { renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
