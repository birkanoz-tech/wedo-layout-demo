/**
 * ProposalApp - 3D Scene Engine Core
 * Handles Three.js initialization, rendering loop, cameras, lights, grid, and resize handlers.
 */

export let scene, camera, renderer, controls, transformControls;
export let perspectiveCamera, orthographicCamera;
export let isOrthographic = false;
export let axisGizmoScene, axisGizmoCamera, axisGizmoRenderer, axisGizmoRoot;
export const axisGizmoFrustumSize = 2.4;

export function init3D() {
    const container = document.getElementById('canvas-container');
    if (container) {
        container.innerHTML = '';
    }
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f4);
    scene.fog = new THREE.FogExp2(0xf4f4f4, 0.0028);

    const w = container ? (container.clientWidth || container.parentElement?.clientWidth || window.innerWidth || 1200) : 1200;
    const h = container ? (container.clientHeight || container.parentElement?.clientHeight || (window.innerHeight - 120) || 800) : 800;
    const aspect = (w > 0 && h > 0) ? (w / h) : (16 / 9);
    const orthoFrustumSize = 120;

    perspectiveCamera = new THREE.PerspectiveCamera(39.6, aspect, 0.05, 3000); // 50mm DSLR Prime Lens
    perspectiveCamera.up.set(0, 0, 1);
    perspectiveCamera.position.set(70, 100, 60);

    orthographicCamera = new THREE.OrthographicCamera(
        -orthoFrustumSize * aspect / 2,
        orthoFrustumSize * aspect / 2,
        orthoFrustumSize / 2,
        -orthoFrustumSize / 2,
        -1000,
        3000
    );
    orthographicCamera.up.set(0, 0, 1);
    orthographicCamera.position.set(70, 100, 60);

    camera = isOrthographic ? orthographicCamera : perspectiveCamera;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0xf4f4f4, 1);
    renderer.physicallyCorrectLights = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    if (container) {
        container.appendChild(renderer.domElement);
    }

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(65, 10, 0);
    controls.update();

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.setSize(0.45);
    transformControls.userData.persistent = true;
    transformControls.userData.transformHelper = true;
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value;
    });

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd1d5db, 0.78);
    hemiLight.userData.persistent = true;
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
    ambientLight.userData.persistent = true;
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
    dirLight.position.set(90, 120, 160);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 500;
    dirLight.userData.persistent = true;
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(200, 50, 0x334155, 0x94a3b8);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -0.01;
    gridHelper.userData.persistent = true;
    scene.add(gridHelper);

    window.addEventListener('resize', onWindowResize);
    animate();
}

export function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    const w = container.clientWidth || container.parentElement?.clientWidth || window.innerWidth || 1200;
    const h = container.clientHeight || container.parentElement?.clientHeight || (window.innerHeight - 120) || 800;
    const aspect = (w > 0 && h > 0) ? (w / h) : (16 / 9);

    if (camera && camera.isOrthographicCamera) {
        const frustumHeight = (camera.top - camera.bottom);
        camera.left = -frustumHeight * aspect / 2;
        camera.right = frustumHeight * aspect / 2;
        camera.top = frustumHeight / 2;
        camera.bottom = -frustumHeight / 2;
        camera.updateProjectionMatrix();
    } else if (camera) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
    }
    if (renderer) {
        renderer.setSize(w, h);
    }
}

export function animate() {
    requestAnimationFrame(animate);
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

if (typeof window !== 'undefined') {
    window.init3D = init3D;
    window.onWindowResize = onWindowResize;
    window.animate = animate;
}
