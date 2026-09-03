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

// Canlı Önizleme (Rubber-band line & cursor) Nesneleri
let livePreviewLine = null;
let cursorMarker = null;
let liveDistSprite = null;

/**
 * 1. Çizim Modunu Başlat
 */
export function startConveyorPathDrawing() {
    isConveyorPathDrawingActive = true;
    conveyorDrawNodes3D = [];
    typedDistBuffer = '';

    cleanupLivePreview();

    const hud = document.getElementById('conveyor-draw-hud');
    if (hud) hud.classList.remove('hidden');

    const hudInfo = document.getElementById('conveyor-draw-hud-info');
    if (hudInfo) hudInfo.innerText = '🟢 Başlangıç noktasını tıklayın (DXF veya zemin)';

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

    cleanupLivePreview();

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

    cleanupLivePreview();

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

    // 2D AutoCAD Tipi Parametrik Konveyör Gövdesini Oluştur
    const nextAssyIndex = (Array.isArray(window.importedProject) ? window.importedProject.length : 0) + (Array.isArray(window.addedManualModels) ? window.addedManualModels.filter(m => m.path === 'parametric:conveyor-2d').length : 0) + 1;
    const nextAssyName = `Conveyor_${String(nextAssyIndex).padStart(2, '0')}`;

    let conv2D = null;
    if (typeof window.generate2DConveyorCADGroup === 'function') {
        conv2D = window.generate2DConveyorCADGroup(pathData, 0.105, nextAssyName);
    }

    if (conv2D && typeof scene !== 'undefined') {
        scene.add(conv2D);
        if (Array.isArray(window.addedManualModels)) {
            window.addedManualModels.push({
                path: 'parametric:conveyor-2d',
                label: conv2D.userData.product?.name || nextAssyName,
                point: conv2D.position ? conv2D.position.clone() : new THREE.Vector3(),
                ref: conv2D,
                assemblyName: nextAssyName
            });
        }
        if (typeof window.rebuildModelTreeFromScene === 'function') {
            window.rebuildModelTreeFromScene();
        }
        if (typeof window.selectMesh === 'function') {
            window.selectMesh(conv2D);
        }
    } else {
        renderPersistentConveyorGuide(pathData);
    }

    if (typeof window.setActiveConveyorPathData === 'function') {
        window.setActiveConveyorPathData(pathData);
    }

    if (typeof showNotice === 'function') {
        showNotice(`✅ ${nextAssyName} 2D Taslağı Oluşturuldu: Toplam ${pathData.totalLength.toFixed(2)}m (${pathData.turns.length} Dönüş). Sağ panelden genişlik, kol boyları ve viraj açılarını parametrik olarak düzenleyebilirsiniz!`);
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

    // İnce Siyah Teknik Çizgi (AutoCAD DXF Stili)
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.95,
        depthTest: false
    });
    const line = new THREE.Line(lineGeo, lineMat);
    persistentConveyorPathGroup.add(line);

    // Küçük Siyah Nokta Düğümleri
    points.forEach((pt, idx) => {
        const sphereGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.copy(pt);
        persistentConveyorPathGroup.add(sphere);
    });

    // Metinler tamamen kaldırıldı: Hat üzerinde etiket/metin yer almaz.

    scene.add(persistentConveyorPathGroup);
}

/**
 * 6. AutoCAD Teknik Çizim Stili Metin Sprite Üretici (Arkaplansız, Saf Siyah İnce Yazı, İkonsuz)
 */
export function createCADTechnicalTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // 1. Arkaplanı olmayan (Tamamen şeffaf canvas)
    ctx.clearRect(0, 0, 512, 100);

    // 2. İnce siyah teknik çizim yazısı (AutoCAD fontu)
    ctx.font = '500 32px "ISOCPEUR", "simplex", "Segoe UI", "Arial", sans-serif';
    ctx.fillStyle = '#000000'; // Saf siyah ince çizgi ile yazılmış metin
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3. Herhangi bir ikon/emoji içermeyen temiz teknik metin
    const cleanText = String(text).replace(/[📏↪️🟢🔴⚡#]/g, '').trim();
    ctx.fillText(cleanText, 256, 50);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.0, 0.4, 1);
    sprite.renderOrder = 1000;
    return sprite;
}

export const createGuideTextSprite = createCADTechnicalTextSprite;

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
    if (!scene) return;

    // 1. İmleç / Cursor halka göstergesi (İnce siyah CAD hedefleme halkası)
    if (!cursorMarker) {
        const ringGeo = new THREE.RingGeometry(0.12, 0.16, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            depthTest: false
        });
        cursorMarker = new THREE.Mesh(ringGeo, ringMat);
        cursorMarker.renderOrder = 1000;
        scene.add(cursorMarker);
    }
    cursorMarker.position.set(mousePt.x, mousePt.y, mousePt.z + 0.08);
    cursorMarker.visible = true;

    // Henüz ilk nokta seçilmemişse önizleme çizgisi çizilmez
    if (conveyorDrawNodes3D.length === 0) {
        if (livePreviewLine) livePreviewLine.visible = false;
        if (liveDistSprite) liveDistSprite.visible = false;
        return;
    }

    const lastNode = conveyorDrawNodes3D[conveyorDrawNodes3D.length - 1];
    const dist = lastNode.distanceTo(mousePt);

    // 2. Dinamik Önizleme Çizgisi (İnce Siyah Kesikli CAD Kılavuzu)
    const p1 = new THREE.Vector3(lastNode.x, lastNode.y, lastNode.z + 0.06);
    const p2 = new THREE.Vector3(mousePt.x, mousePt.y, mousePt.z + 0.06);

    if (!livePreviewLine) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const lineMat = new THREE.LineDashedMaterial({
            color: 0x000000, // Saf siyah ince çizgi
            linewidth: 1.5,
            dashSize: 0.3,
            gapSize: 0.15,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        livePreviewLine = new THREE.Line(lineGeo, lineMat);
        livePreviewLine.computeLineDistances();
        livePreviewLine.renderOrder = 999;
        scene.add(livePreviewLine);
    } else {
        const posAttr = livePreviewLine.geometry.attributes.position;
        posAttr.setXYZ(0, p1.x, p1.y, p1.z);
        posAttr.setXYZ(1, p2.x, p2.y, p2.z);
        posAttr.needsUpdate = true;
        livePreviewLine.computeLineDistances();
        livePreviewLine.visible = true;
    }

    // 3. Çizgi Üzerinde Canlı Mesafe Etiketi (Floating Sprite)
    const midPoint = p1.clone().add(p2).multiplyScalar(0.5);
    midPoint.z += 0.25;

    let totalLen = 0;
    for (let i = 0; i < conveyorDrawNodes3D.length - 1; i++) {
        totalLen += conveyorDrawNodes3D[i].distanceTo(conveyorDrawNodes3D[i + 1]);
    }
    totalLen += dist;

    // Açı tespiti: Yaklaşan viraj açısı (İkonsuz, saf CAD metni)
    let angleInfo = '';
    if (conveyorDrawNodes3D.length >= 1) {
        if (conveyorDrawNodes3D.length >= 2) {
            const prevNode = conveyorDrawNodes3D[conveyorDrawNodes3D.length - 2];
            const v1 = lastNode.clone().sub(prevNode).normalize();
            const v2 = mousePt.clone().sub(lastNode).normalize();
            v1.z = 0; v2.z = 0;
            if (v1.lengthSq() > 0.01 && v2.lengthSq() > 0.01) {
                const dot = Math.max(-1, Math.min(1, v1.dot(v2)));
                const deg = Math.round(THREE.MathUtils.radToDeg(Math.acos(dot)));
                const crossZ = v1.x * v2.y - v1.y * v2.x;
                const dir = crossZ >= 0 ? 'SOL' : 'SAG';
                if (deg > 10) {
                    angleInfo = ` | ${deg}° ${dir}`;
                }
            }
        }
    }

    const tagText = `L = ${dist.toFixed(2)} m${angleInfo}`;
    updateLiveDistSprite(tagText, midPoint);

    const hudLen = document.getElementById('conveyor-draw-hud-len');
    if (hudLen && typedDistBuffer.length === 0) {
        hudLen.innerText = `${totalLen.toFixed(2)} m (Bu kol: ${dist.toFixed(2)}m)`;
    }
}

function updateLiveDistSprite(text, position) {
    if (!scene) return;
    const cleanText = String(text).replace(/[📏↪️🟢🔴⚡]/g, '').trim();

    if (!liveDistSprite) {
        liveDistSprite = createCADTechnicalTextSprite(cleanText);
        scene.add(liveDistSprite);
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 100);

        ctx.font = '500 32px "ISOCPEUR", "simplex", "Segoe UI", "Arial", sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cleanText, 256, 50);

        if (liveDistSprite.material.map) {
            liveDistSprite.material.map.dispose();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        liveDistSprite.material.map = texture;
        liveDistSprite.material.needsUpdate = true;
    }
    liveDistSprite.position.copy(position);
    liveDistSprite.visible = true;
}

function cleanupLivePreview() {
    if (livePreviewLine) {
        if (livePreviewLine.parent) livePreviewLine.parent.remove(livePreviewLine);
        if (livePreviewLine.geometry) livePreviewLine.geometry.dispose();
        if (livePreviewLine.material) livePreviewLine.material.dispose();
        livePreviewLine = null;
    }
    if (cursorMarker) {
        if (cursorMarker.parent) cursorMarker.parent.remove(cursorMarker);
        if (cursorMarker.geometry) cursorMarker.geometry.dispose();
        if (cursorMarker.material) cursorMarker.material.dispose();
        cursorMarker = null;
    }
    if (liveDistSprite) {
        if (liveDistSprite.parent) liveDistSprite.parent.remove(liveDistSprite);
        if (liveDistSprite.material.map) liveDistSprite.material.map.dispose();
        if (liveDistSprite.material) liveDistSprite.material.dispose();
        liveDistSprite = null;
    }
    if (osnapMarker) {
        osnapMarker.visible = false;
    }
}

/**
 * 8. AutoCAD Tarzı OSnap Gizmo Göstergesi (Endpoint: Kare, Midpoint: Üçgen, Nearest: Kum Saati)
 */
function ensureOSnapMarker() {
    if (osnapMarker) return osnapMarker;

    osnapMarker = new THREE.Group();
    osnapMarker.name = 'ConveyorOSnapMarkerGroup';

    // 1. Endpoint Square Marker (Yeşil Kare)
    const sqSize = 0.16;
    const halfSq = sqSize / 2;
    const sqPts = [
        new THREE.Vector3(-halfSq, -halfSq, 0), new THREE.Vector3(halfSq, -halfSq, 0),
        new THREE.Vector3(halfSq, -halfSq, 0), new THREE.Vector3(halfSq, halfSq, 0),
        new THREE.Vector3(halfSq, halfSq, 0), new THREE.Vector3(-halfSq, halfSq, 0),
        new THREE.Vector3(-halfSq, halfSq, 0), new THREE.Vector3(-halfSq, -halfSq, 0)
    ];
    const sqGeo = new THREE.BufferGeometry().setFromPoints(sqPts);
    const sqMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false });
    const sqMesh = new THREE.LineSegments(sqGeo, sqMat);
    sqMesh.name = 'snapSquare';
    sqMesh.renderOrder = 2000;
    osnapMarker.add(sqMesh);

    // 2. Midpoint Triangle Marker (Camgöbeği Üçgen)
    const triH = sqSize * 0.95;
    const triW = sqSize * 1.1;
    const triPts = [
        new THREE.Vector3(0, triH * 0.6, 0), new THREE.Vector3(-triW * 0.5, -triH * 0.4, 0),
        new THREE.Vector3(-triW * 0.5, -triH * 0.4, 0), new THREE.Vector3(triW * 0.5, -triH * 0.4, 0),
        new THREE.Vector3(triW * 0.5, -triH * 0.4, 0), new THREE.Vector3(0, triH * 0.6, 0)
    ];
    const triGeo = new THREE.BufferGeometry().setFromPoints(triPts);
    const triMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2, depthTest: false });
    const triMesh = new THREE.LineSegments(triGeo, triMat);
    triMesh.name = 'snapTriangle';
    triMesh.renderOrder = 2000;
    osnapMarker.add(triMesh);

    // 3. Nearest on Line Hourglass Marker (Sarı Kum Saati)
    const hgPts = [
        new THREE.Vector3(-halfSq, -halfSq, 0), new THREE.Vector3(halfSq, halfSq, 0),
        new THREE.Vector3(-halfSq, halfSq, 0), new THREE.Vector3(halfSq, -halfSq, 0),
        new THREE.Vector3(-halfSq, halfSq, 0), new THREE.Vector3(halfSq, halfSq, 0),
        new THREE.Vector3(-halfSq, -halfSq, 0), new THREE.Vector3(halfSq, -halfSq, 0)
    ];
    const hgGeo = new THREE.BufferGeometry().setFromPoints(hgPts);
    const hgMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2, depthTest: false });
    const hgMesh = new THREE.LineSegments(hgGeo, hgMat);
    hgMesh.name = 'snapHourglass';
    hgMesh.renderOrder = 2000;
    osnapMarker.add(hgMesh);

    osnapMarker.visible = false;
    scene.add(osnapMarker);
    return osnapMarker;
}

function updateOSnapMarker(snapInfo) {
    if (!scene) return;
    const marker = ensureOSnapMarker();
    if (!snapInfo) {
        marker.visible = false;
        return;
    }

    marker.position.set(snapInfo.point.x, snapInfo.point.y, snapInfo.point.z + 0.08);
    marker.visible = true;

    const sq = marker.getObjectByName('snapSquare');
    const tri = marker.getObjectByName('snapTriangle');
    const hg = marker.getObjectByName('snapHourglass');

    if (sq) sq.visible = (snapInfo.type === 'endpoint');
    if (tri) tri.visible = (snapInfo.type === 'midpoint');
    if (hg) hg.visible = (snapInfo.type === 'line');
}

/**
 * Yardımcı: THREE.Line veya THREE.LineSegments nesnesinden 3D dünya segmentlerini ayıkla
 */
function extractSegmentsFromLineObject(lineObj, outList, sourceLabel, activeZ) {
    if (!lineObj.geometry || !lineObj.geometry.attributes || !lineObj.geometry.attributes.position) return;
    const pos = lineObj.geometry.attributes.position;
    const isSegments = lineObj.isLineSegments;
    const step = isSegments ? 2 : 1;
    const count = isSegments ? pos.count : (pos.count - 1);
    lineObj.updateWorldMatrix(true, false);
    const m = lineObj.matrixWorld;

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();

    for (let i = 0; i < count; i += step) {
        pA.fromBufferAttribute(pos, i).applyMatrix4(m);
        pB.fromBufferAttribute(pos, i + 1).applyMatrix4(m);

        pA.z = activeZ;
        pB.z = activeZ;

        outList.push({
            pA: pA.clone(),
            pB: pB.clone(),
            mid: pA.clone().add(pB).multiplyScalar(0.5),
            source: sourceLabel
        });
    }
}

/**
 * 9. Raycast ile 2D Konveyör Çizgileri, DXF ve Zemin Üzerinde Akıllı OSnap Yakalama
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

    const activeZ = typeof getActiveLevelElevation === 'function' ? getActiveLevelElevation() : 0;
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -activeZ);
    let rawHitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, rawHitPoint)) {
        rawHitPoint = new THREE.Vector3(0, 0, activeZ);
    }

    // 1. Sahnedeki Tüm 2D Konveyör Taslaklarını ve DXF Çizgilerini Topla
    const lineSegmentsList = [];
    const keyVerticesList = [];

    if (scene) {
        scene.traverse(obj => {
            // A. Sahnede Çizilmiş 2D Konveyör Taslakları
            if (obj.userData?.is2DConveyorSketch || obj.userData?.parametricKind === 'conveyor-2d') {
                const convLabel = obj.userData?.assemblyName || obj.name || '2D Konveyör';

                // Eksen düğüm noktaları (Idler başlangıç, motor tahrik ekseni, viraj düğümleri)
                if (obj.userData?.pathData?.nodes && Array.isArray(obj.userData.pathData.nodes)) {
                    obj.updateWorldMatrix(true, false);
                    obj.userData.pathData.nodes.forEach((n, nIdx) => {
                        const wp = n.clone().applyMatrix4(obj.matrixWorld);
                        wp.z = activeZ;
                        const role = nIdx === 0 ? 'Avare Başlangıç (Idler)' :
                                     nIdx === obj.userData.pathData.nodes.length - 1 ? 'Motor Tahrik (Drive Axle)' : `Köşe ${nIdx + 1}`;
                        keyVerticesList.push({ point: wp, source: `${convLabel} ${role}` });
                    });
                }

                // Konveyörün tüm çizgilerini (Sınır rayları, eksen kesikli çizgisi, avare ucu, motor hatları) tara
                obj.traverse(child => {
                    if (child.isLine || child.isLineSegments) {
                        extractSegmentsFromLineObject(child, lineSegmentsList, convLabel, activeZ);
                    }
                });
            }

            // B. DXF Çizim Modelleri
            if (obj.userData?.isDXFModel || obj.userData?.type === 'dxf-drawing') {
                const dxfLabel = obj.name || 'DXF Referansı';
                obj.traverse(child => {
                    if (child.isLine || child.isLineSegments) {
                        extractSegmentsFromLineObject(child, lineSegmentsList, dxfLabel, activeZ);
                    }
                });
            }
        });
    }

    // C. Çizilmekte Olan Mevcut Konveyörün Önceki Noktaları
    conveyorDrawNodes3D.forEach((n, idx) => {
        keyVerticesList.push({ point: n.clone(), source: `Çizim Noktası ${idx + 1}` });
    });

    // 2. Snap Mesafeleri (Uç Nokta, Orta Nokta, Çizgi İzdüşümü)
    let bestEndpoint = null;
    let minEndDist = 0.38; // 380 mm çekim yarıçapı

    let bestMidpoint = null;
    let minMidDist = 0.30; // 300 mm çekim yarıçapı

    let bestLineProj = null;
    let minLineDist = 0.22; // 220 mm çizgi çekim yarıçapı

    // A. Özel Anahtar Noktalar (Key Vertices / Centerline nodes)
    keyVerticesList.forEach(item => {
        const d = rawHitPoint.distanceTo(item.point);
        if (d < minEndDist) {
            minEndDist = d;
            bestEndpoint = { point: item.point.clone(), type: 'endpoint', source: item.source };
        }
    });

    // B. Çizgi Segmentlerinin Uçları, Orta Noktaları ve Doğru Parçası İzdüşümleri
    lineSegmentsList.forEach(seg => {
        // Uç Noktalar
        const dA = rawHitPoint.distanceTo(seg.pA);
        if (dA < minEndDist) {
            minEndDist = dA;
            bestEndpoint = { point: seg.pA.clone(), type: 'endpoint', source: `${seg.source} Ucu` };
        }
        const dB = rawHitPoint.distanceTo(seg.pB);
        if (dB < minEndDist) {
            minEndDist = dB;
            bestEndpoint = { point: seg.pB.clone(), type: 'endpoint', source: `${seg.source} Ucu` };
        }

        // Orta Noktalar
        const dMid = rawHitPoint.distanceTo(seg.mid);
        if (dMid < minMidDist) {
            minMidDist = dMid;
            bestMidpoint = { point: seg.mid.clone(), type: 'midpoint', source: `${seg.source} Orta Nokta` };
        }

        // Çizgi Boyunca Dik İzdüşüm (Nearest on Line)
        const AB = seg.pB.clone().sub(seg.pA);
        const lenSq = AB.lengthSq();
        if (lenSq > 1e-6) {
            const t = Math.max(0.0, Math.min(1.0, rawHitPoint.clone().sub(seg.pA).dot(AB) / lenSq));
            const proj = seg.pA.clone().addScaledVector(AB, t);
            proj.z = activeZ;
            const dLine = rawHitPoint.distanceTo(proj);
            if (dLine < minLineDist) {
                minLineDist = dLine;
                bestLineProj = { point: proj, type: 'line', source: `${seg.source} Çizgisi` };
            }
        }
    });

    // 3. Öncelik Sıralaması: Uç Nokta > Orta Nokta > Çizgi Üzeri
    let finalSnap = null;
    if (bestEndpoint) {
        finalSnap = bestEndpoint;
    } else if (bestMidpoint) {
        finalSnap = bestMidpoint;
    } else if (bestLineProj) {
        finalSnap = bestLineProj;
    }

    updateOSnapMarker(finalSnap);

    let resultPoint = finalSnap ? finalSnap.point.clone() : rawHitPoint.clone();

    // HUD snap bilgilendirmesi
    const hudInfo = document.getElementById('conveyor-draw-hud-info');
    if (hudInfo && isConveyorPathDrawingActive) {
        if (finalSnap) {
            const typeLabel = finalSnap.type === 'endpoint' ? '🟩 UÇ NOKTA' :
                              finalSnap.type === 'midpoint' ? '🔷 ORTA NOKTA' : '⏳ ÇİZGİ ÜZERİ';
            hudInfo.innerText = `🎯 OSNAP: ${finalSnap.source} (${typeLabel})`;
        }
    }

    // Shift basılıysa veya Ortho modundaysa dik açı kilidi yap (Eğer serbest çiziliyorsa)
    if (!finalSnap && conveyorDrawNodes3D.length > 0 && event.shiftKey) {
        const last = conveyorDrawNodes3D[conveyorDrawNodes3D.length - 1];
        const dx = Math.abs(resultPoint.x - last.x);
        const dy = Math.abs(resultPoint.y - last.y);
        if (dx > dy) {
            resultPoint.y = last.y;
        } else {
            resultPoint.x = last.x;
        }
    }

    return resultPoint;
}

// Global Exports
if (typeof window !== 'undefined') {
    window.startConveyorPathDrawing = startConveyorPathDrawing;
    window.cancelConveyorPathDrawing = cancelConveyorPathDrawing;
    window.finishConveyorPathDrawing = finishConveyorPathDrawing;
    window.analyzeConveyorPolyline = analyzeConveyorPolyline;
}
