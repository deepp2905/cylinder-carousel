import * as THREE from 'three';
import gsap from 'gsap';

// --- Audio Context ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClick() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.04);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.04);
}

// --- Global State & Defaults ---
let config = { count: 2, height: 2.2, aspect: 16/9, radius: 3.5, cameraZ: 12 };

const defaultTemplates = [
    { type: 'image', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200', isLocal: false },
    { type: 'image', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1200', isLocal: false }
];

let items = [...defaultTemplates];
let isUsingDefaults = true;

// --- Three.js Setup ---
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
    uniform sampler2D uTex; uniform float uOpacity; varying vec2 vUv;
    void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb, uOpacity); }
`;

const meshes = [];
const textureLoader = new THREE.TextureLoader();

function createVideoTexture(url) {
    const vid = document.createElement('video');
    vid.src = url; vid.crossOrigin = 'Anonymous'; vid.loop = true;
    vid.muted = true; vid.playsInline = true; vid.autoplay = true;
    vid.play().catch(() => {});
    const tex = new THREE.VideoTexture(vid);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    return tex;
}

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
        let texture = item.type === 'video' ? createVideoTexture(item.url) : textureLoader.load(item.url);

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uBend: { value: 0 }, uRadius: { value: config.radius },
                uTex: { value: texture }, uOpacity: { value: i === 0 ? 1 : 0 }
            },
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

// --- Dynamic Grid Manager ---
function renderGrid() {
    const grid = document.getElementById('media-grid');
    grid.innerHTML = '';

    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'grid-item';

        let mediaHTML = item.type === 'video'
            ? `<video src="${item.url}" muted playsinline></video>`
            : `<img src="${item.url}">`;

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

    if (isUsingDefaults) {
        items = [];
        isUsingDefaults = false;
    }

    files.forEach(file => {
        items.push({
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: URL.createObjectURL(file),
            isLocal: true
        });
    });

    config.count = items.length;
    updateRadiusForCount();
    renderGrid();
    rebuildCarousel();
    e.target.value = '';
});

function deleteItem(idx) {
    if (items[idx].isLocal) URL.revokeObjectURL(items[idx].url);

    items.splice(idx, 1);

    if (items.length === 0) {
        isUsingDefaults = true;
        items = [...defaultTemplates];
    }

    config.count = items.length;
    updateRadiusForCount();
    renderGrid();
    rebuildCarousel();
}

// --- Core Interaction Logic ---
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
    setVisualState(true);
    gsap.to(carouselGroup.rotation, {
        y: currentTargetIndex * ((Math.PI * 2) / config.count),
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

window.addEventListener('mousedown', e => { if (e.target.tagName === 'CANVAS') onDown(e.clientX, e.clientY); });
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', onUp);
window.addEventListener('touchstart', e => { if (e.target.tagName === 'CANVAS') onDown(e.touches[0].clientX, e.touches[0].clientY); });
window.addEventListener('touchmove', e => onMove(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchend', onUp);

document.getElementById('next-btn').onclick = () => { if (config.count > 1) animateTo(currentTargetIndex - 1); };
document.getElementById('prev-btn').onclick = () => { if (config.count > 1) animateTo(currentTargetIndex + 1); };
document.getElementById('pill').onclick = (e) => {
    if (config.count <= 1) return;
    const r = e.currentTarget.getBoundingClientRect();
    const targetIdx = Math.floor(((e.clientX - r.left) / r.width) * config.count);
    let diff = targetIdx - getActiveIndex();
    if (diff > config.count/2) diff -= config.count;
    if (diff < -config.count/2) diff += config.count;
    animateTo(currentTargetIndex - diff);
};

// --- UI Modal & Sliders ---
const panel = document.getElementById('settings-panel');
document.getElementById('settings-toggle').onclick = () => panel.classList.toggle('open');

const inputs = ['cameraZ', 'radius', 'height'];
inputs.forEach(id => {
    document.getElementById('param-' + id).oninput = (e) => {
        let val = parseFloat(e.target.value);
        document.getElementById('val-' + id).innerText = val.toFixed(1);
        if (id === 'cameraZ') { config.cameraZ = val; camera.position.z = val; }
        else { config[id] = val; rebuildCarousel(); }
    };
});

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
