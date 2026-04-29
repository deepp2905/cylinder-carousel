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
let config = {
    count: 4,
    height: 2.2,
    aspect: 16/9,
    radius: 4.8,
    cameraZ: 12
};

let items = [
    { type: 'image', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1200' },
    { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=1200' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200' },
    { type: 'image', url: 'https://images.unsplash.com/photo-150062786916c-7012c0a25961?q=80&w=1200' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1200' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?q=80&w=1200' }
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
    uniform float uBend;
    uniform float uRadius;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        float angle = position.x / uRadius;
        vec3 curved = vec3(sin(angle) * uRadius, position.y, cos(angle) * uRadius - uRadius);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(position, curved, uBend), 1.0);
    }
`;
const fragmentShader = `
    uniform sampler2D uTex;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
        vec4 tex = texture2D(uTex, vUv);
        gl_FragColor = vec4(tex.rgb, uOpacity * tex.a);
    }
`;

const meshes = [];
const textureLoader = new THREE.TextureLoader();

// --- Engine Logic ---
function createVideoTexture(url) {
    const vid = document.createElement('video');
    vid.src = url;
    vid.crossOrigin = 'Anonymous';
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.autoplay = true;
    vid.play().catch(e => console.warn("Video autoplay blocked", e));

    const tex = new THREE.VideoTexture(vid);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
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
                uBend: { value: 0 },
                uRadius: { value: config.radius },
                uTex: { value: texture },
                uOpacity: { value: i === 0 ? 1 : 0 }
            },
            vertexShader, fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
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

    rotationY = 0;
    currentTargetIndex = 0;
    carouselGroup.rotation.y = 0;
    updateUI();
}

// --- Controllers ---
let rotationY = 0;
let lastTriggeredTick = 0;
let isDragging = false;
let isMoving = false;
let lastX = 0;
let currentTargetIndex = 0;

function getActiveIndex() {
    const step = (Math.PI * 2) / config.count;
    const normalized = Math.round(rotationY / step);
    const activeIdx = ((normalized % config.count) + config.count) % config.count;
    return (config.count - activeIdx) % config.count;
}

function updateUI() {
    const visualIdx = getActiveIndex();
    document.querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('active', i === visualIdx));

    const step = (Math.PI * 2) / config.count;
    const currentTick = Math.round(rotationY / step);
    if (currentTick !== lastTriggeredTick) {
        playClick();
        lastTriggeredTick = currentTick;
    }
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
            if (i !== activeIdx) {
                gsap.to(m.material.uniforms.uOpacity, { value: 0, duration: 0.45, ease: "power2.inOut", overwrite: true });
            }
        });
    }
}

function animateTo(targetIdx) {
    currentTargetIndex = targetIdx;
    const step = (Math.PI * 2) / config.count;
    const targetRotation = currentTargetIndex * step;
    setVisualState(true);

    gsap.to(carouselGroup.rotation, {
        y: targetRotation,
        duration: 0.8,
        ease: "expo.out",
        overwrite: true,
        onUpdate: () => { rotationY = carouselGroup.rotation.y; updateUI(); },
        onComplete: () => { setVisualState(false); }
    });
}

// --- UI & Interaction Events ---
document.getElementById('settings-toggle').onclick = () => {
    document.getElementById('settings-panel').classList.toggle('open');
};

const onDown = (x) => {
    if (isMoving) return;
    isDragging = true;
    lastX = x;
    gsap.killTweensOf(carouselGroup.rotation);
    setVisualState(true);
};

const onMove = (x) => {
    if (!isDragging) return;
    const delta = (x - lastX) * 0.006;
    rotationY += delta;
    carouselGroup.rotation.y = rotationY;
    lastX = x;
    updateUI();
};

const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    const step = (Math.PI * 2) / config.count;
    animateTo(Math.round(rotationY / step));
};

window.addEventListener('mousedown', e => { if (e.target.tagName === 'CANVAS') onDown(e.clientX); });
window.addEventListener('mousemove', e => onMove(e.clientX));
window.addEventListener('mouseup', onUp);
window.addEventListener('touchstart', e => { if (e.target.tagName === 'CANVAS') onDown(e.touches[0].clientX); });
window.addEventListener('touchmove', e => onMove(e.touches[0].clientX));
window.addEventListener('touchend', onUp);

document.getElementById('next-btn').onclick = () => animateTo(currentTargetIndex - 1);
document.getElementById('prev-btn').onclick = () => animateTo(currentTargetIndex + 1);

document.getElementById('pill').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetIdx = Math.floor((clickX / rect.width) * config.count);
    let diff = targetIdx - getActiveIndex();
    if (diff > config.count/2) diff -= config.count;
    if (diff < -config.count/2) diff += config.count;
    animateTo(currentTargetIndex - diff);
};

// --- Parameter Listeners & DOM Gen ---
const inputs = ['count', 'cameraZ', 'radius', 'height'];
inputs.forEach(id => {
    document.getElementById('param-' + id).oninput = (e) => {
        let val = parseFloat(e.target.value);
        document.getElementById('val-' + id).innerText = val;

        if (id === 'count') {
            config.count = val;
            const optimalRadius = (val * (config.height * config.aspect)) / (2 * Math.PI) + 0.5;
            config.radius = optimalRadius;
            document.getElementById('param-radius').value = optimalRadius.toFixed(1);
            document.getElementById('val-radius').innerText = optimalRadius.toFixed(1);
            renderContentList();
            rebuildCarousel();
        } else if (id === 'cameraZ') {
            config.cameraZ = val;
            camera.position.z = val;
        } else {
            config[id] = val;
            rebuildCarousel();
        }
    };
});

function renderContentList() {
    const list = document.getElementById('content-list');
    list.innerHTML = '';
    for (let i = 0; i < config.count; i++) {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            Slot ${i+1}:
            <select id="type-${i}">
                <option value="image" ${items[i].type === 'image' ? 'selected' : ''}>Image</option>
                <option value="video" ${items[i].type === 'video' ? 'selected' : ''}>Video</option>
            </select>
            <input type="file" id="file-${i}" accept="image/*,video/*">
        `;
        list.appendChild(row);

        document.getElementById(`type-${i}`).onchange = (e) => {
            items[i].type = e.target.value;
            rebuildCarousel();
        };

        document.getElementById(`file-${i}`).onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                items[i].url = URL.createObjectURL(file);
                if (file.type.startsWith('video/')) {
                    items[i].type = 'video';
                    document.getElementById(`type-${i}`).value = 'video';
                } else {
                    items[i].type = 'image';
                    document.getElementById(`type-${i}`).value = 'image';
                }
                rebuildCarousel();
            }
        };
    }
}

// --- Init ---
renderContentList();
rebuildCarousel();

function animate() { renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
