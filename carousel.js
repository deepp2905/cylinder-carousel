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

// --- Configuration & Global State ---
let config = { count: 4, height: 2.2, aspect: 16/9, radius: 4.8, cameraZ: 12 };

// Pre-loaded Defaults (Images & Videos)
let items = [
    { type: 'image', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200', name: 'Default Image 1' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', name: 'Default Video 1' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1200', name: 'Default Image 2' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', name: 'Default Video 2' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=1200', name: 'Default Image 3' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200', name: 'Default Image 4' },
    { type: 'image', url: 'https://images.unsplash.com/photo-150062786916c-7012c0a25961?q=80&w=1200', name: 'Default Image 5' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1200', name: 'Default Image 6' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200', name: 'Default Image 7' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?q=80&w=1200', name: 'Default Image 8' }
];

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
        vUv = uv;
        float angle = position.x / uRadius;
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

// --- Engine Logic ---
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

function rebuildCarousel() {
    while (carouselGroup.children.length > 0) {
        const child = carouselGroup.children[0];
        child.geometry.dispose();
        child.material.uniforms.uTex.value.dispose();
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

    // Pagination Sync
    const pill = document.getElementById('pill');
    pill.innerHTML = '';
    for (let i = 0; i < config.count; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        pill.appendChild(d);
    }

    rotationY = 0; currentTargetIndex = 0; carouselGroup.rotation.y = 0; updateUI();
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

document.getElementById('next-btn').onclick = () => animateTo(currentTargetIndex - 1);
document.getElementById('prev-btn').onclick = () => animateTo(currentTargetIndex + 1);

document.getElementById('pill').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const targetIdx = Math.floor(((e.clientX - r.left) / r.width) * config.count);
    let diff = targetIdx - getActiveIndex();
    if (diff > config.count/2) diff -= config.count;
    if (diff < -config.count/2) diff += config.count;
    animateTo(currentTargetIndex - diff);
};

// --- UI Modal & Parameters ---
const panel = document.getElementById('settings-panel');
document.getElementById('settings-toggle').onclick = () => panel.classList.toggle('open');

const inputs = ['count', 'cameraZ', 'radius', 'height'];
inputs.forEach(id => {
    document.getElementById('param-' + id).oninput = (e) => {
        let val = parseFloat(e.target.value);
        document.getElementById('val-' + id).innerText = val.toFixed(id === 'count' ? 0 : 1);
        if (id === 'count') {
            config.count = val;
            const optimal = (val * (config.height * config.aspect)) / (2 * Math.PI) + 0.5;
            config.radius = optimal;
            document.getElementById('param-radius').value = optimal;
            document.getElementById('val-radius').innerText = optimal.toFixed(1);
            renderContentList(); rebuildCarousel();
        } else if (id === 'cameraZ') {
            config.cameraZ = val; camera.position.z = val;
        } else {
            config[id] = val; rebuildCarousel();
        }
    };
});

// Content Manager
function renderContentList() {
    const list = document.getElementById('content-list');
    list.innerHTML = '';
    for (let i = 0; i < config.count; i++) {
        const item = items[i];
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <div class="item-info">
                <span class="item-title">Slot ${i+1}</span>
                <span class="item-desc" id="desc-${i}">${item.name}</span>
            </div>
            <label class="upload-btn">
                Upload
                <input type="file" id="file-${i}" accept="image/*,video/*">
            </label>
        `;
        list.appendChild(row);

        document.getElementById(`file-${i}`).onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                items[i].url = URL.createObjectURL(file);
                items[i].type = file.type.startsWith('video/') ? 'video' : 'image';
                items[i].name = file.name;
                document.getElementById(`desc-${i}`).innerText = file.name;
                rebuildCarousel();
            }
        };
    }
}

renderContentList();
rebuildCarousel();

function animate() { renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
