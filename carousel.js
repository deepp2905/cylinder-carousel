import * as THREE from 'three';
import gsap from 'gsap';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClick() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.04);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.04);
}

const config = { count: 4, height: 2.2, aspect: 16/9, radius: 4.8, cameraZ: 12 };
const width = config.height * config.aspect;
const step = (Math.PI * 2) / config.count;

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

const imgs = [
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1200',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?q=80&w=1200',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=1200'
];

const meshes = [];
const texLoader = new THREE.TextureLoader();

for (let i = 0; i < config.count; i++) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uBend: { value: 0 },
            uRadius: { value: config.radius },
            uTex: { value: texLoader.load(imgs[i]) },
            uOpacity: { value: i === 0 ? 1 : 0 }
        },
        vertexShader, fragmentShader, transparent: true, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, config.height, 80, 1), mat);
    const theta = (i / config.count) * Math.PI * 2;
    mesh.position.set(Math.sin(theta) * config.radius, 0, Math.cos(theta) * config.radius);
    mesh.rotation.y = theta;
    carouselGroup.add(mesh);
    meshes.push(mesh);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let rotationY = 0;
let lastTriggeredTick = 0;
let isDragging = false;
let lastX = 0;
let currentTargetIndex = 0;

function getActiveIndex() {
    const normalized = Math.round(rotationY / step);
    const activeIdx = ((normalized % config.count) + config.count) % config.count;
    return (config.count - activeIdx) % config.count;
}

function updateUI() {
    const visualIdx = getActiveIndex();
    document.querySelectorAll('.dot').forEach((dot, i) => dot.classList.toggle('active', i === visualIdx));

    const currentTick = Math.round(rotationY / step);
    if (currentTick !== lastTriggeredTick) {
        playClick();
        lastTriggeredTick = currentTick;
    }
}

function setVisualState(isMoving) {
    const activeIdx = getActiveIndex();
    const morphDuration = 0.45;

    if (isMoving) {
        meshes.forEach(m => {
            gsap.to(m.material.uniforms.uOpacity, { value: 1, duration: 0.3, overwrite: true });
            gsap.to(m.material.uniforms.uBend, { value: 1, duration: 0.3, ease: "power2.out", overwrite: true });
        });
    } else {
        meshes.forEach((m, i) => {
            gsap.to(m.material.uniforms.uBend, {
                value: 0,
                duration: morphDuration,
                ease: "power2.inOut",
                overwrite: true
            });

            if (i !== activeIdx) {
                gsap.to(m.material.uniforms.uOpacity, {
                    value: 0,
                    duration: morphDuration,
                    ease: "power2.inOut",
                    overwrite: true
                });
            }
        });
    }
}

function animateTo(targetIdx) {
    currentTargetIndex = targetIdx;
    const targetRotation = currentTargetIndex * step;

    setVisualState(true);

    gsap.to(carouselGroup.rotation, {
        y: targetRotation,
        duration: 0.8,
        ease: "expo.out",
        overwrite: true,
        onUpdate: () => {
            rotationY = carouselGroup.rotation.y;
            updateUI();
        },
        onComplete: () => {
            setVisualState(false);
        }
    });
}

const onDown = (x, y) => {
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(meshes[getActiveIndex()]);

    if (intersects.length > 0) {
        isDragging = true;
        lastX = x;
        gsap.killTweensOf(carouselGroup.rotation);
        setVisualState(true);
    }
};

const onMove = (x, y) => {
    if (!isDragging) {
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(meshes[getActiveIndex()]);
        document.body.style.cursor = intersects.length > 0 ? 'grab' : 'default';
    } else {
        document.body.style.cursor = 'grabbing';
        const delta = (x - lastX) * 0.006;
        rotationY += delta;
        carouselGroup.rotation.y = rotationY;
        lastX = x;
        updateUI();
    }
};

const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    animateTo(Math.round(rotationY / step));
};

window.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', onUp);
window.addEventListener('touchstart', e => onDown(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchmove', e => onMove(e.touches[0].clientX, e.touches[0].clientY));
window.addEventListener('touchend', onUp);

document.getElementById('next-btn').onclick = () => animateTo(currentTargetIndex - 1);
document.getElementById('prev-btn').onclick = () => animateTo(currentTargetIndex + 1);

document.getElementById('pill').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const targetIdx = Math.floor(((e.clientX - rect.left) / rect.width) * config.count);
    let diff = targetIdx - getActiveIndex();
    if (diff > config.count/2) diff -= config.count;
    if (diff < -config.count/2) diff += config.count;
    animateTo(currentTargetIndex - diff);
};

function animate() { renderer.render(scene, camera); requestAnimationFrame(animate); }
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
