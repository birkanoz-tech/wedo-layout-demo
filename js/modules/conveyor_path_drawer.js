/**
 * conveyor_path_drawer.js
 * ProposalApp - 3D DXF / Zemin Üzerinde Akıllı Polyline Güzergah Çizim Motoru
 */

export let isConveyorPathDrawingActive = false;
export let conveyorDrawNodes3D = [];
export let persistentConveyorPathGroup = null;

let tempLineMesh = null;
let tempNodesGroup = null;
let osnapMarker = null;
let latestMousePoint = null;
let typedDistBuffer = '';

/**
 * 1. Çizim Modunu Başlat
 */
export function startConveyorPathDrawing() {
    isConveyorPathDrawingActive = true;
    conveyorDrawNodes3D = [];
    typedDistBuffer = '';

    const hud = document.getElementById('conveyor-draw-hud');
    if (hud) hud.classList.remove('hidden');

    const hudInfo = document.getElementById('conveyor-draw-hud-info');
    if (hudInfo) hudInfo.innerText = 'Başlangıç noktasını tıklayın (DXF veya zemin)';

    const hudLen = document.getElementById('conveyor-draw-hud-len');
    if (hudLen) hudLen.innerText = '0.00 m';

    // Geçici çizim grubu
    if (tempNodesGroup && tempNodesGroup.parent) {
        tempNodesGroup.parent.remove(tempNodesGroup);
    }
    tempNodesGroup = new THREE.Group();
    tempNodesGroup.name = 'TempConveyorDrawGroup';
    if (typeof scene !== 'undefined') {
        scene.add(tempNodesGroup);
    }

    if (typeof showNotice === 'function') {
        showNotice('📐 Konveyör Güzergah Çizimi Başladı: Sol tık ile köşe ekleyin, klavye ile ölçü yazabilirsiniz. (Enter: Tamamla, Esc: İptal)');
    }

    initPathDrawingListeners();
}

/**
 * 2. Çizim Modunu İptal Et
 */
export function cancelConveyorPathDrawing() {
    isConveyorPathDrawingActive = false;
    conveyorDrawNodes3D = [];
    typedDistBuffer = '';

    if (tempNodesGroup && tempNodesGroup.parent) {
        tempNodesGroup.parent.remove(tempNodesGroup);
        tempNodesGroup = null;
    }
    if (tempLineMesh && tempLineMesh.parent) {
        tempLineMesh.parent.remove(tempLineMesh);
        tempLineMesh = null;
    }

    const hud = document.getElementById('conveyor-draw-hud');
    if (hud) hud.classList.add('hidden');

    if (typeof showNotice === 'function') {
        showNotice('✕ Konveyör çizimi iptal edildi.');
    }
}

/**
 * 3. Çizimi Tamamla ve Veriyi Paketle
 */
export function finishConveyorPathDrawing() {
    if (!isConveyorPathDrawingActive) return;

    if (conveyorDrawNodes3D.length < 2) {
        if (typeof showNotice === 'function') {
            showNotice('⚠️ Bir güzergah oluşturmak için en az 2 nokta (başlangıç ve bitiş) belirlemelisiniz.');
        }
        return;
    }

    isConveyorPathDrawingActive = false;

    const hud = document.getElementById('conveyor-draw-hud');
    if (hud) hud.classList.add('hidden');

    // Analiz et
    const pathData = analyzeConveyorPolyline(conveyorDrawNodes3D);

    // Geçici çizgiyi kaldırıp sahneye kalıcı şık kılavuz nesnesi ekle
    if (tempNodesGroup && tempNodesGroup.parent) {
        tempNodesGroup.parent.remove(tempNodesGroup);
        tempNodesGroup = null;
    }
    if (tempLineMesh && tempLineMesh.parent) {
        tempLineMesh.parent.remove(tempLineMesh);
        tempLineMesh = null;
    }

    renderPersistentConveyorGuide(pathData);

    if (typeof window.setActiveConveyorPathData === 'function') {
        window.setActiveConveyorPathData(pathData);
    }

    if (typeof showNotice === 'function') {
        showNotice(`✅ Güzergah Tamamlandı: Toplam ${pathData.totalLength.toFixed(2)}m (${pathData.turns.length} Dönüş). Şimdi "Hat BOM" veya "3D Konveyör İnşa Et" butonlarına basabilirsiniz!`);
    }
}

/**
 * 4. Polyline Noktalarını Matematiksel Olarak Analiz Et
 */
export function analyzeConveyorPolyline(nodes) {
    let totalLength = 0;
    const segments = [];
    const turns = [];

    for (let i = 0; i < nodes.length - 1; i++) {
        const from = nodes[i].clone();
        const to = nodes[i + 1].clone();
        const vec = to.clone().sub(from);
        vec.z = 0; // Düzlemsel hat
        const len = vec.length();
        totalLength += len;

        const dir = vec.clone().normalize();
        segments.push({
            index: i,
            from,
            to,
            length: len,
            direction: dir
        });
    }

    // Dönüş açılarını ve yönlerini (Sağ / Sol) tespit et
    for (let i = 0; i < segments.length - 1; i++) {
        const seg1 = segments[i];
        const seg2 = segments[i + 1];

        const dot = Math.max(-1, Math.min(1, seg1.direction.dot(seg2.direction)));
        let angleRad = Math.acos(dot);
        let angleDeg = THREE.MathUtils.radToDeg(angleRad);

        // Z-cross product ile yön tespiti
        const crossZ = seg1.direction.x * seg2.direction.y - seg1.direction.y * seg2.direction.x;
        const turnDirection = crossZ >= 0 ? 'left' : 'right';

        // Standart FlexLink açısına yuvarlama (90°, 45°, 30°, 180° vb.)
        let standardAngle = 90;
        if (Math.abs(angleDeg - 45) <= 15) standardAngle = 45;
        else if (Math.abs(angleDeg - 30) <= 10) standardAngle = 30;
        else if (Math.abs(angleDeg - 60) <= 10) standardAngle = 60;
        else if (Math.abs(angleDeg - 90) <= 20) standardAngle = 90;
        else if (Math.abs(angleDeg - 180) <= 15) standardAngle = 180;
        else standardAngle = Math.round(angleDeg);

        turns.push({
            nodeIndex: i + 1,
            point: seg1.to.clone(),
            actualAngle: angleDeg,
            standardAngle: standardAngle,
            direction: turnDirection,
            suggestedRadius: 0.7 // Varsayılan 700mm
        });
    }

    return {
        id: `conveyor_path_${Date.now()}`,
        nodes: nodes.map(n => n.clone()),
        segments,
        turns,
        totalLength
    };
}

/**
 * 5. Sahnede Kalıcı 3D Neon Kılavuz Polyline'ı Çiz
 */
function renderPersistentConveyorGuide(pathData) {
    if (!pathData || !pathData.nodes || !scene) return;

    if (persistentConveyorPathGroup && persistentConveyorPathGroup.parent) {
        persistentConveyorPathGroup.parent.remove(persistentConveyorPathGroup);
    }

    persistentConveyorPathGroup = new THREE.Group();
    persistentConveyorPathGroup.name = 'PersistentConveyorGuideLine';
    persistentConveyorPathGroup.userData = { isConveyorGuide: true, pathData };

    const points = pathData.nodes.map(n => new THREE.Vector3(n.x, n.y, (n.z || 0) + 0.05));

    // Kalın Parlak Neon Çizgi
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x06b6d4, // Cyan
        linewidth: 3,
        transparent: true,
        opacity: 0.95
    });
    const line = new THREE.Line(lineGeo, lineMat);
    persistentConveyorPathGroup.add(line);

    // Nokta Düğümleri (Sphere markers)
    points.forEach((pt, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === points.length - 1;

        const sphereGeo = new THREE.SphereGeometry(0.18, 16, 16);
        const color = isStart ? 0x10b981 : (isEnd ? 0xef4444 : 0x06b6d4);
        const sphereMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.6,
            roughness: 0.2
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(pt);
        persistentConveyorPathGroup.add(sphere);

        // 3D Bilgi Etiketi Sprite'ı
        let tagText = `#${idx + 1}`;
        if (isStart) tagText = '🟢 BAŞLANGIÇ (Motor/Tahrik)';
        else if (isEnd) tagText = '🔴 BİTİŞ (Avare Uç)';
        else {
            const turn = pathData.turns.find(t => t.nodeIndex === idx);
            if (turn) {
                const dirLabel = turn.direction === 'left' ? 'Sol' : 'Sağ';
                tagText = `⚡ ${turn.standardAngle}° ${dirLabel} Dönüş`;
            }
        }

        const sprite = createGuideTextSprite(tagText, isStart ? '#10b981' : (isEnd ? '#ef4444' : '#06b6d4'));
        if (sprite) {
            sprite.position.set(pt.x, pt.y, pt.z + 0.45);
            persistentConveyorPathGroup.add(sprite);
        }
    });

    // Düz Segment Metraj Etiketleri (Orta Noktada)
    pathData.segments.forEach(seg => {
        const mid = seg.from.clone().add(seg.to).multiplyScalar(0.5);
        mid.z += 0.25;
        const lenText = `${seg.length.toFixed(2)}m`;
        const lenSprite = createGuideTextSprite(`📏 ${lenText}`, '#eab308');
        if (lenSprite) {
            lenSprite.position.copy(mid);
            persistentConveyorPathGroup.add(lenSprite);
        }
    });

    scene.add(persistentConveyorPathGroup);
}

/**
 * 6. Şık 3D Canvas Text Sprite Üretici
 */
function createGuideTextSprite(text, bgColor = '#0f172a') {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 70;
    const ctx = canvas.getContext('2d');

    // Yuvarlak Kutu Arka Planı
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(4, 4, 312, 62, 10);
    ctx.fill();
    ctx.stroke();

    // Metin
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 160, 35);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.4, 0.32, 1);
    sprite.renderOrder = 999;
    return sprite;
}

/**
 * 7. Fare ve Klavye Dinleyicilerini Kur
 */
let listenersInitialized = false;

function initPathDrawingListeners() {
    if (listenersInitialized) return;
    listenersInitialized = true;

    const canvas = renderer ? renderer.domElement : document.querySelector('canvas');
    if (!canvas) return;

    canvas.addEventListener('pointerdown', (e) => {
        if (!isConveyorPathDrawingActive) return;
        if (e.button === 2) {
            // Sağ tık: son noktayı sil veya çizimi bitir
            e.preventDefault();
            if (conveyorDrawNodes3D.length > 2) {
                finishConveyorPathDrawing();
            } else {
                cancelConveyorPathDrawing();
            }
            return;
        }

        if (e.button === 0 && latestMousePoint) {
            addConveyorPathNode(latestMousePoint);
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isConveyorPathDrawingActive) return;
        const pt = getSnapedWorldPointFromEvent(e);
        if (pt) {
            latestMousePoint = pt;
            updateLivePreview(pt);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (!isConveyorPathDrawingActive) return;

        if (e.key === 'Escape') {
            cancelConveyorPathDrawing();
        } else if (e.key === 'Enter') {
            if (typedDistBuffer.trim().length > 0) {
                const targetLen = parseFloat(typedDistBuffer.trim());
                if (!isNaN(targetLen) && targetLen > 0) {
                    addNodeByTypedDistance(targetLen);
                    return;
                }
            }
            finishConveyorPathDrawing();
        } else if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
            typedDistBuffer += e.key;
            const hudLen = document.getElementById('conveyor-draw-hud-len');
            if (hudLen) hudLen.innerText = `${typedDistBuffer} m (Enter)`;
        } else if (e.key === 'Backspace') {
            typedDistBuffer = typedDistBuffer.slice(0, -1);
            const hudLen = document.getElementById('conveyor-draw-hud-len');
            if (hudLen) hudLen.innerText = typedDistBuffer.length > 0 ? `${typedDistBuffer} m` : '0.00 m';
        }
    });
}

function addConveyorPathNode(point) {
    const activeZ = typeof getActiveLevelElevation === 'function' ? getActiveLevelElevation() : 0;
    const node = new THREE.Vector3(point.x, point.y, activeZ);

    conveyorDrawNodes3D.push(node);
    typedDistBuffer = '';

    const hudInfo = document.getElementById('conveyor-draw-hud-info');
    if (hudInfo) {
        hudInfo.innerText = `${conveyorDrawNodes3D.length}. Köşe Noktası Eklendi. Sonraki noktaya tıklayın veya Enter ile bitirin.`;
    }

    renderTempNodes();
}

function addNodeByTypedDistance(targetLen) {
    if (conveyorDrawNodes3D.length === 0) return;
    const lastNode = conveyorDrawNodes3D[conveyorDrawNodes3D.length - 1];

    let dirUnit = new THREE.Vector3(1, 0, 0);
    if (latestMousePoint) {
        dirUnit = latestMousePoint.clone().sub(lastNode);
        dirUnit.z = 0;
        if (dirUnit.lengthSq() > 0.001) {
            dirUnit.normalize();
        } else {
            dirUnit.set(1, 0, 0);
        }
    }

    const nextPt = lastNode.clone().add(dirUnit.multiplyScalar(targetLen));
    addConveyorPathNode(nextPt);
}

function renderTempNodes() {
    if (!tempNodesGroup) return;

    // Temizle
    while (tempNodesGroup.children.length > 0) {
        const c = tempNodesGroup.children[0];
        tempNodesGroup.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
    }

    const pts = conveyorDrawNodes3D.map(p => new THREE.Vector3(p.x, p.y, p.z + 0.04));
    if (pts.length > 1) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 });
        const line = new THREE.Line(lineGeo, lineMat);
        tempNodesGroup.add(line);
    }

    pts.forEach((pt, i) => {
        const sphereGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0x10b981 : 0x06b6d4 });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(pt);
        tempNodesGroup.add(sphere);
    });
}

function updateLivePreview(mousePt) {
    if (conveyorDrawNodes3D.length === 0) return;
    const lastNode = conveyorDrawNodes3D[conveyorDrawNodes3D.length - 1];

    let dist = lastNode.distanceTo(mousePt);
    let totalLen = 0;
    for (let i = 0; i < conveyorDrawNodes3D.length - 1; i++) {
        totalLen += conveyorDrawNodes3D[i].distanceTo(conveyorDrawNodes3D[i + 1]);
    }
    totalLen += dist;

    const hudLen = document.getElementById('conveyor-draw-hud-len');
    if (hudLen && typedDistBuffer.length === 0) {
        hudLen.innerText = `${totalLen.toFixed(2)} m`;
    }
}

/**
 * 8. Raycast ile DXF ve Zemin Üzerinde OSnap Noktası Yakalama
 */
function getSnapedWorldPointFromEvent(event) {
    if (!camera || !renderer) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // DXF veya 3D zemin nesnelerini ara
    const intersectableObjects = [];
    if (scene) {
        scene.traverse(obj => {
            if (obj.userData?.isDXFModel || obj.userData?.type === 'dxf-drawing' || obj.userData?.isBuildingLevelFloor) {
                intersectableObjects.push(obj);
            }
        });
    }

    let hitPoint = null;
    if (intersectableObjects.length > 0) {
        const hits = raycaster.intersectObjects(intersectableObjects, true);
        if (hits && hits.length > 0) {
            hitPoint = hits[0].point;
        }
    }

    if (!hitPoint) {
        // Z=0 veya aktif kat zeminine raycast yap
        const activeZ = typeof getActiveLevelElevation === 'function' ? getActiveLevelElevation() : 0;
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -activeZ);
        hitPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, hitPoint);
    }

    if (!hitPoint) return null;

    // Shift basılıysa veya Ortho modundaysa dik açı kilidi yap
    if (conveyorDrawNodes3D.length > 0 && event.shiftKey) {
        const last = conveyorDrawNodes3D[conveyorDrawNodes3D.length - 1];
        const dx = Math.abs(hitPoint.x - last.x);
        const dy = Math.abs(hitPoint.y - last.y);
        if (dx > dy) {
            hitPoint.y = last.y;
        } else {
            hitPoint.x = last.x;
        }
    }

    return hitPoint;
}

// Global Exports
if (typeof window !== 'undefined') {
    window.startConveyorPathDrawing = startConveyorPathDrawing;
    window.cancelConveyorPathDrawing = cancelConveyorPathDrawing;
    window.finishConveyorPathDrawing = finishConveyorPathDrawing;
    window.analyzeConveyorPolyline = analyzeConveyorPolyline;
}
