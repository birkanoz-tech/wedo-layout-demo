/**
 * conveyor_builder.js
 * ProposalApp - Akıllı Polyline'dan 2D CAD Taslağı, BOM Maliyet Hesaplayıcı & 3D Konveyör İnşa Motoru
 */

let active2DConveyorGroup = null;

/**
 * 1. 2D AutoCAD Tipi Parametrik Konveyör Gövde Geometrisini Doldur / Yenile
 */
export function populate2DConveyorCADGeometry(group, pathData, widthM = 0.105, assyName = null) {
    if (!group || !pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    if (!assyName) {
        assyName = group.name || `Conveyor_${String(Date.now()).slice(-4)}`;
    }
    group.name = assyName;

    // Güvenli çocuk temizliği (Kopya dizi üzerinde döngü)
    const existing = [...group.children];
    for (const c of existing) {
        group.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
            else c.material.dispose?.();
        }
    }

    const nodes = pathData.nodes;
    const segments = pathData.segments;
    const turns = pathData.turns || [];
    const halfW = widthM / 2;
    const zPos = (nodes[0].z || 0) + 0.05;

    // 1. Düz Kolların Çift Cidar Çizgileri ve 2D Dolgu Yüzeyi
    const boundaryLinePts = [];
    const ribbonVertices = [];

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const dir = seg.direction.clone();
        const norm = new THREE.Vector3(-dir.y, dir.x, 0).normalize();

        const p1 = seg.from.clone(); p1.z = zPos;
        const p2 = seg.to.clone(); p2.z = zPos;

        const left1 = p1.clone().addScaledVector(norm, halfW);
        const right1 = p1.clone().addScaledVector(norm, -halfW);
        const left2 = p2.clone().addScaledVector(norm, halfW);
        const right2 = p2.clone().addScaledVector(norm, -halfW);

        boundaryLinePts.push(left1, left2);
        boundaryLinePts.push(right1, right2);

        ribbonVertices.push(
            left1.x, left1.y, left1.z,
            right1.x, right1.y, right1.z,
            right2.x, right2.y, right2.z,

            left1.x, left1.y, left1.z,
            right2.x, right2.y, right2.z,
            left2.x, left2.y, left2.z
        );
    }

    // Yarı saydam gövde dolgusu (Translucent blueprint ribbon)
    if (ribbonVertices.length > 0) {
        const ribbonGeo = new THREE.BufferGeometry();
        ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVertices, 3));
        const ribbonMat = new THREE.MeshBasicMaterial({
            color: 0x0284c7, // Sky Blue
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
        ribbonMesh.name = 'Conveyor2DRibbonBody';
        group.add(ribbonMesh);
    }

    // Çift kenar çizgileri (AutoCAD Style)
    if (boundaryLinePts.length > 0) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(boundaryLinePts);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8, // Açık cyan
            linewidth: 2,
            transparent: true,
            opacity: 0.95
        });
        const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
        lineSegments.name = 'Conveyor2DBoundaryLines';
        group.add(lineSegments);
    }

    // Eksen çizgisi (Dashed yellow)
    const axisPts = nodes.map(n => new THREE.Vector3(n.x, n.y, zPos + 0.01));
    const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPts);
    const axisMat = new THREE.LineDashedMaterial({
        color: 0xfacc15,
        linewidth: 1,
        dashSize: 0.4,
        gapSize: 0.2
    });
    const axisLine = new THREE.Line(axisGeo, axisMat);
    axisLine.computeLineDistances();
    axisLine.name = 'Conveyor2DCenterline';
    group.add(axisLine);

    // 2. Başlangıç Sembolü: HER ZAMAN AVARE UÇ (Idler End)
    const startNode = nodes[0];
    const firstDir = segments[0].direction;
    const firstNorm = new THREE.Vector3(-firstDir.y, firstDir.x, 0).normalize();
    const backDir = firstDir.clone().negate();

    const arcPts = [];
    const arcSteps = 16;
    for (let j = 0; j <= arcSteps; j++) {
        const angle = -Math.PI / 2 + (Math.PI * j) / arcSteps;
        const pt = startNode.clone()
            .addScaledVector(firstNorm, Math.sin(angle) * halfW)
            .addScaledVector(backDir, Math.cos(angle) * halfW);
        pt.z = zPos + 0.02;
        arcPts.push(pt);
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    group.add(arcLine);

    const idlerCoreGeo = new THREE.CircleGeometry(halfW * 0.45, 16);
    const idlerCoreMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
    const idlerCore = new THREE.Mesh(idlerCoreGeo, idlerCoreMat);
    idlerCore.position.set(startNode.x, startNode.y, zPos + 0.02);
    group.add(idlerCore);

    if (typeof createGuideTextSprite === 'function') {
        const startTag = createGuideTextSprite('🟢 AVARE UÇ (Başlangıç)', '#10b981');
        if (startTag) {
            startTag.position.set(startNode.x, startNode.y, zPos + 0.45);
            group.add(startTag);
        }
    }

    // 3. Bitiş Sembolü: HER ZAMAN MOTORLU TAHRİK (Drive Unit)
    const lastNode = nodes[nodes.length - 1];
    const lastDir = segments[segments.length - 1].direction;
    const lastNorm = new THREE.Vector3(-lastDir.y, lastDir.x, 0).normalize();

    const driveHeadLen = 0.4;
    const dLeft1 = lastNode.clone().addScaledVector(lastNorm, halfW * 1.1);
    const dRight1 = lastNode.clone().addScaledVector(lastNorm, -halfW * 1.1);
    const dLeft2 = dLeft1.clone().addScaledVector(lastDir, driveHeadLen);
    const dRight2 = dRight1.clone().addScaledVector(lastDir, driveHeadLen);

    const driveBoxGeo = new THREE.BufferGeometry().setFromPoints([
        dLeft1, dLeft2,
        dLeft2, dRight2,
        dRight2, dRight1,
        dRight1, dLeft1
    ]);
    const driveBoxMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3 });
    const driveBox = new THREE.LineSegments(driveBoxGeo, driveBoxMat);
    group.add(driveBox);

    // Motor / Redüktör yanal bloğu
    const mRight1 = dRight1.clone().addScaledVector(lastDir, 0.05);
    const mRight2 = dRight2.clone().addScaledVector(lastDir, -0.05);
    const mOuter1 = mRight1.clone().addScaledVector(lastNorm, -0.25);
    const mOuter2 = mRight2.clone().addScaledVector(lastNorm, -0.25);

    const motorBlockGeo = new THREE.BufferGeometry().setFromPoints([
        mRight1, mOuter1,
        mOuter1, mOuter2,
        mOuter2, mRight2
    ]);
    const motorBlock = new THREE.LineSegments(motorBlockGeo, driveBoxMat);
    group.add(motorBlock);

    if (typeof createGuideTextSprite === 'function') {
        const endTag = createGuideTextSprite('⚡ MOTOR (Bitiş)', '#f59e0b');
        if (endTag) {
            endTag.position.set(lastNode.x, lastNode.y, zPos + 0.45);
            group.add(endTag);
        }

        turns.forEach((turn) => {
            const turnLabel = createGuideTextSprite(`↪️ ${turn.standardAngle}° ${turn.direction === 'left' ? 'Sol' : 'Sağ'} Viraj`, '#06b6d4');
            if (turnLabel) {
                turnLabel.position.set(turn.point.x, turn.point.y, zPos + 0.4);
                group.add(turnLabel);
            }
        });

        segments.forEach((seg, idx) => {
            const mid = seg.from.clone().add(seg.to).multiplyScalar(0.5);
            const segLabel = createGuideTextSprite(`📏 Kol #${idx + 1}: ${seg.length.toFixed(2)}m`, '#eab308');
            if (segLabel) {
                segLabel.position.set(mid.x, mid.y, zPos + 0.35);
                group.add(segLabel);
            }
        });
    }

    // 4. UserData & Ürün Ağacı Entegrasyonu
    group.userData = {
        type: 'xml-product',
        isParametric: true,
        parametricKind: 'conveyor-2d',
        is2DConveyorSketch: true,
        assemblyName: assyName,
        parametric: {
            width: widthM,
            pathData: pathData,
            assemblyName: assyName
        },
        product: {
            name: `${assyName} (2D Taslak - ${pathData.totalLength.toFixed(1)}m)`,
            type: 'conveyor-2d-sketch',
            group: 'Conveyors',
            assemblyName: assyName,
            position: { x: startNode.x, y: startNode.y, z: zPos }
        }
    };
}

/**
 * 2. Yeni 2D AutoCAD Konveyör Grubu Oluştur
 */
export function generate2DConveyorCADGroup(pathData, widthM = 0.105, assyName = null) {
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return null;
    const group = new THREE.Group();
    populate2DConveyorCADGeometry(group, pathData, widthM, assyName);
    active2DConveyorGroup = group;
    return group;
}

/**
 * 3. 3D Model Yüklemeden Hızlı BOM (Malzeme & Maliyet) Listesi Hesapla
 */
export function calculateAndRenderConveyorBOM(pathData) {
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    const totalLength = pathData.totalLength || 0;
    const turns = pathData.turns || [];

    const bendRadiusM = 0.7;
    let totalBendLength = 0;
    turns.forEach(t => {
        const rad = THREE.MathUtils.degToRad(t.standardAngle || 90);
        totalBendLength += rad * bendRadiusM;
    });

    const netStraightLen = Math.max(0.5, totalLength - totalBendLength);
    const standard3mBeams = Math.floor(netStraightLen / 3.0);
    const remainderM = (netStraightLen % 3.0);

    const totalChainLen = (totalLength * 2) + 1.8;
    const supportLegsCount = Math.max(2, Math.ceil(totalLength / 2.5) + turns.length);

    const costBeams = (netStraightLen * 85);
    const costBends = (turns.length * 320);
    const costDrive = 750;
    const costIdler = 220;
    const costChain = (totalChainLen * 38);
    const costGuides = (totalLength * 2 * 18);
    const costLegs = (supportLegsCount * 65);

    const totalEstCost = Math.round(costBeams + costBends + costDrive + costIdler + costChain + costGuides + costLegs);

    const lenEl = document.getElementById('bom-total-length');
    if (lenEl) lenEl.innerText = `${totalLength.toFixed(2)} m`;

    const turnsEl = document.getElementById('bom-turns-count');
    if (turnsEl) turnsEl.innerText = `${turns.length} Adet`;

    const motorsEl = document.getElementById('bom-motors-count');
    if (motorsEl) motorsEl.innerText = `1 Adet`;

    const costEl = document.getElementById('bom-est-cost');
    if (costEl) costEl.innerText = `~${totalEstCost.toLocaleString('tr-TR')} €`;

    const tbody = document.getElementById('bom-table-body');
    if (tbody) {
        let remainderHtml = '';
        if (remainderM > 0.05) {
            remainderHtml = `
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>✂️</span> Özel Boy Ara Kiriş Kesimi</td>
                <td class="py-2 px-3 text-cyan-400">XCB-CUT</td>
                <td class="py-2 px-3 text-gray-400">Hatta Özel Net Ölçü Kesim Parçası</td>
                <td class="py-2 px-3 text-right text-amber-400 font-bold">1 Parça (${remainderM.toFixed(2)}m)</td>
            </tr>`;
        }

        let turnsHtml = '';
        turns.forEach((t, idx) => {
            turnsHtml += `
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>↪️</span> Yatay Dönüş Virajı #${idx + 1}</td>
                <td class="py-2 px-3 text-cyan-400">CE01 / XBEJ ${t.standardAngle}</td>
                <td class="py-2 px-3 text-gray-400">${t.standardAngle}° ${t.direction === 'left' ? 'Sol' : 'Sağ'} Dönüş (R: 700mm)</td>
                <td class="py-2 px-3 text-right text-cyan-400 font-bold">1 Adet</td>
            </tr>`;
        });

        tbody.innerHTML = `
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>🔄</span> Avare Dönüş Başlığı (Başlangıç)</td>
                <td class="py-2 px-3 text-cyan-400">XKEJ 160 / 200</td>
                <td class="py-2 px-3 text-gray-400">Rulmanlı, Yay Gergi Mekanizmalı</td>
                <td class="py-2 px-3 text-right text-emerald-400 font-bold">1 Adet</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>⚡</span> Tahrik Ünitesi (Motorlu Bitiş)</td>
                <td class="py-2 px-3 text-cyan-400">XHEB 0 / XHEJ</td>
                <td class="py-2 px-3 text-gray-400">0.37 kW Motor & Sonsuz Redüktörlü</td>
                <td class="py-2 px-3 text-right text-emerald-400 font-bold">1 Adet</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>📏</span> Standart Konveyör Gövde Kirişleri</td>
                <td class="py-2 px-3 text-cyan-400">XCB 3000</td>
                <td class="py-2 px-3 text-gray-400">3000 mm Eloksallı Alüminyum Gövde</td>
                <td class="py-2 px-3 text-right text-amber-400 font-bold">${standard3mBeams} Boy (3.0m)</td>
            </tr>
            ${remainderHtml}
            ${turnsHtml}
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>⛓️</span> Modüler Baklalı Plastik Zincir</td>
                <td class="py-2 px-3 text-cyan-400">XKP 85 / XTP</td>
                <td class="py-2 px-3 text-gray-400">Düşük Sürtünmeli Asetal (POM), Pim Bağlantılı</td>
                <td class="py-2 px-3 text-right text-purple-400 font-bold">${totalChainLen.toFixed(1)} Metre</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>🚧</span> Yan Kılavuz Korkuluklar (Guide Rails)</td>
                <td class="py-2 px-3 text-cyan-400">XRLP / Bracket</td>
                <td class="py-2 px-3 text-gray-400">Çift Taraflı Ürün Korkuluğu ve Braketler</td>
                <td class="py-2 px-3 text-right text-purple-400 font-bold">${(totalLength * 2).toFixed(1)} Metre</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>🏗️</span> Zemin Taşıyıcı Destek Ayakları</td>
                <td class="py-2 px-3 text-cyan-400">XCFS / Support</td>
                <td class="py-2 px-3 text-gray-400">Yüksekliği Ayarlanabilir Çift Kolonlu Ayak</td>
                <td class="py-2 px-3 text-right text-emerald-400 font-bold">${supportLegsCount} Takım</td>
            </tr>
        `;
    }
}

/**
 * 4. 2D Parametrik Özellikler Panelini Doldur (Sağ Panel)
 */
export function update2DConveyorParametricEditor(groupObj) {
    if (!groupObj || !groupObj.userData?.is2DConveyorSketch) return;
    active2DConveyorGroup = groupObj;

    const data = groupObj.userData.parametric || {};
    const pathData = data.pathData || {};
    const assyName = data.assemblyName || groupObj.name || 'Conveyor';

    const nameEl = document.getElementById('conveyor-2d-name');
    if (nameEl) nameEl.innerText = assyName;

    const lenEl = document.getElementById('conveyor-2d-total-len');
    if (lenEl) lenEl.innerText = `${(pathData.totalLength || 0).toFixed(2)} m`;

    const widthSelect = document.getElementById('conveyor-2d-width-select');
    if (widthSelect) {
        const widthMM = Math.round((data.width || 0.105) * 1000);
        widthSelect.value = String(widthMM);
    }

    // Segmentler ve Açıları Listele
    const listEl = document.getElementById('conveyor-2d-segments-list');
    if (listEl && Array.isArray(pathData.segments)) {
        listEl.innerHTML = pathData.segments.map((seg, idx) => {
            const turn = (pathData.turns || []).find(t => t.nodeIndex === idx + 1);
            let turnHtml = '';
            if (turn) {
                turnHtml = '<div class="flex items-center justify-between text-[10px] pt-1 border-t border-gray-800/60">' +
                    '<span class="text-cyan-300">↪️ Viraj #' + (idx + 1) + ':</span>' +
                    '<div class="flex items-center gap-1">' +
                    '<select id="turn-angle-input-' + idx + '" onchange="applySelected2DConveyorParameters()"' +
                    ' class="bg-black border border-gray-700 rounded px-1 py-0.5 text-cyan-300 font-mono text-[10px] outline-none">' +
                    '<option value="90"' + (turn.standardAngle === 90 ? ' selected' : '') + '>90°</option>' +
                    '<option value="45"' + (turn.standardAngle === 45 ? ' selected' : '') + '>45°</option>' +
                    '<option value="30"' + (turn.standardAngle === 30 ? ' selected' : '') + '>30°</option>' +
                    '<option value="60"' + (turn.standardAngle === 60 ? ' selected' : '') + '>60°</option>' +
                    '<option value="180"' + (turn.standardAngle === 180 ? ' selected' : '') + '>180°</option>' +
                    '</select>' +
                    '<span class="text-gray-400 font-mono">(' + (turn.direction === 'left' ? 'Sol' : 'Sağ') + ')</span>' +
                    '</div></div>';
            }

            return '<div class="bg-gray-900 border border-gray-800 p-2 rounded space-y-1">' +
                '<div class="flex items-center justify-between">' +
                '<span class="font-bold text-gray-200">Kol #' + (idx + 1) + ' Uzunluğu:</span>' +
                '<div class="flex items-center gap-1">' +
                '<input id="seg-len-input-' + idx + '" type="number" step="0.1" min="0.5" value="' + seg.length.toFixed(2) + '"' +
                ' onchange="applySelected2DConveyorParameters()"' +
                ' class="w-16 bg-black border border-gray-700 rounded px-1.5 py-0.5 text-right text-amber-300 font-mono text-xs focus:border-cyan-400 outline-none">' +
                '<span class="text-gray-400 text-[10px]">m</span>' +
                '</div></div>' +
                turnHtml +
                '</div>';
        }).join('');
    }
}

/**
 * 5. Parametre Değiştiğinde 2D Çizimi Anında Yeniden Hesapla (Forward Kinematics)
 */
export function applySelected2DConveyorParameters() {
    if (!active2DConveyorGroup || !active2DConveyorGroup.userData?.is2DConveyorSketch) return;

    const data = active2DConveyorGroup.userData.parametric;
    const pathData = data.pathData;
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    const widthSelect = document.getElementById('conveyor-2d-width-select');
    const newWidthM = widthSelect ? (parseFloat(widthSelect.value) || 105) / 1000 : (data.width || 0.105);

    // Segment boylarını ve açıları oku
    const newNodes = [pathData.nodes[0].clone()]; // Başlangıç Avare noktası sabit
    let currentDir = pathData.segments[0].direction.clone();

    for (let i = 0; i < pathData.segments.length; i++) {
        const lenInput = document.getElementById(`seg-len-input-${i}`);
        const targetLen = lenInput ? (parseFloat(lenInput.value) || pathData.segments[i].length) : pathData.segments[i].length;

        const lastNode = newNodes[newNodes.length - 1];
        const nextNode = lastNode.clone().addScaledVector(currentDir, targetLen);
        newNodes.push(nextNode);

        // Bir sonraki doğrultu için açıyı uygula
        const turn = (pathData.turns || []).find(t => t.nodeIndex === i + 1);
        if (turn) {
            const angleSelect = document.getElementById(`turn-angle-input-${i}`);
            const targetAngleDeg = angleSelect ? (parseFloat(angleSelect.value) || turn.standardAngle) : turn.standardAngle;
            const sign = turn.direction === 'left' ? 1 : -1;
            const angleRad = THREE.MathUtils.degToRad(targetAngleDeg * sign);

            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
            currentDir = new THREE.Vector3(
                currentDir.x * cosA - currentDir.y * sinA,
                currentDir.x * sinA + currentDir.y * cosA,
                0
            ).normalize();
        }
    }

    // Yeni polyline analizi
    const newPathData = typeof window.analyzeConveyorPolyline === 'function' ? window.analyzeConveyorPolyline(newNodes) : pathData;

    // active2DConveyorGroup nesnesinin çocuklarını güvenle doğrudan güncelle (Sonsuz döngü riski yok)
    populate2DConveyorCADGeometry(active2DConveyorGroup, newPathData, newWidthM, data.assemblyName);

    // Sağ panel metraj göstergesini güncelle
    const lenEl = document.getElementById('conveyor-2d-total-len');
    if (lenEl) lenEl.innerText = `${newPathData.totalLength.toFixed(2)} m`;

    if (typeof window.setActiveConveyorPathData === 'function') {
        window.setActiveConveyorPathData(newPathData);
    }

    if (typeof window.rebuildModelTreeFromScene === 'function') {
        window.rebuildModelTreeFromScene();
    }
}

/**
 * 6. 2D Taslağı Tam 3D Modele Dönüştür (2D Gizle)
 */
export async function convertActive2DConveyorTo3D() {
    if (!active2DConveyorGroup || !active2DConveyorGroup.userData?.is2DConveyorSketch) return;

    const data = active2DConveyorGroup.userData.parametric;
    const pathData = data.pathData;
    const assyName = data.assemblyName;

    if (typeof window.openConveyorBuilderModal === 'function') {
        window.setActiveConveyorPathData(pathData);
        window.openConveyorBuilderModal();

        const nameInput = document.getElementById('builder-assembly-name');
        if (nameInput) nameInput.value = assyName;

        // İnşa edildikten sonra 2D görünümü gizle
        setTimeout(() => {
            if (active2DConveyorGroup) {
                active2DConveyorGroup.visible = false;
            }
        }, 1000);
    }
}

/**
 * 7. 2D Taslak Görünürlüğünü Aç / Kapat
 */
export function toggleActive2DConveyorVisibility() {
    if (!active2DConveyorGroup) return;
    active2DConveyorGroup.visible = !active2DConveyorGroup.visible;
    if (typeof showNotice === 'function') {
        showNotice(`👁️ 2D Taslak Görünürlüğü: ${active2DConveyorGroup.visible ? 'Açık' : 'Gizli'}`);
    }
}

/**
 * 8. Polyline'dan 3D Konveyör Modellerini Sahneye İnşa Et (Start = Avare, End = Motor)
 */
export async function executeConveyorBuild() {
    const pathData = typeof window.activeConveyorPathData !== 'undefined' ? window.activeConveyorPathData : null;
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) {
        if (typeof showNotice === 'function') {
            showNotice('⚠️ İnşa edilecek geçerli bir güzergah polyline verisi bulunamadı.');
        }
        return;
    }

    const assyNameInput = document.getElementById('builder-assembly-name');
    const platformSelect = document.getElementById('builder-platform-type');
    const radiusSelect = document.getElementById('builder-bend-radius');
    const tocInput = document.getElementById('builder-top-of-chain');

    const assemblyName = assyNameInput ? assyNameInput.value.trim() || 'Conveyor_New' : 'Conveyor_New';
    const platformType = platformSelect ? platformSelect.value : 'XH';
    const bendRadiusMM = radiusSelect ? parseInt(radiusSelect.value, 10) || 700 : 700;
    const topOfChainMM = tocInput ? parseFloat(tocInput.value) || 850 : 850;

    if (typeof showNotice === 'function') {
        showNotice(`⏳ "${assemblyName}" konveyör hattı 3D sahnede inşa ediliyor...`);
    }

    if (typeof window.closeConveyorBuilderModal === 'function') {
        window.closeConveyorBuilderModal();
    }

    // Parça listesi oluştur (Başlangıç Avare, Bitiş Motor)
    const products = generateConveyorProductsFromPath(pathData, {
        assemblyName,
        platformType,
        bendRadiusMM,
        topOfChainMM
    });

    if (!products || products.length === 0) {
        if (typeof showNotice === 'function') {
            showNotice('❌ Konveyör parçaları türetilemedi.');
        }
        return;
    }

    if (!Array.isArray(importedProject)) {
        importedProject = [];
    }

    const newAssembly = {
        name: assemblyName,
        assemblyName: assemblyName,
        products: products
    };
    importedProject.push(newAssembly);

    const assemblyGroup = new THREE.Group();
    assemblyGroup.name = assemblyName;
    assemblyGroup.userData = { type: 'assembly', assemblyName: assemblyName };

    await ensureAllXLCTModelsPreloaded();

    for (const product of products) {
        const mesh = await createProductMesh(product);
        if (mesh) {
            mesh.userData.assemblyName = assemblyName;
            assemblyGroup.add(mesh);
        }
        modelTreeEntries.push({ assemblyName: assemblyName, product, mesh: mesh || null });
    }

    if (importedProjectRoot) {
        importedProjectRoot.add(assemblyGroup);
    } else {
        scene.add(assemblyGroup);
    }

    if (typeof rebuildModelTreeFromScene === 'function') {
        rebuildModelTreeFromScene();
    }

    if (typeof generateAllConveyorPathways === 'function') {
        setTimeout(() => { generateAllConveyorPathways(); }, 300);
    }

    if (typeof showNotice === 'function') {
        showNotice(`🚀 "${assemblyName}" konveyör hattı ${pathData.totalLength.toFixed(1)}m uzunluğunda 3D olarak başarıyla inşa edildi!`);
    }
}

/**
 * 9. Polyline Geometrisinden Sıralı Ürün Listesi Türet
 * BAŞLANGIÇ: HER ZAMAN AVARE (XKEJ), BİTİŞ: HER ZAMAN MOTOR (XHEB)
 */
function generateConveyorProductsFromPath(pathData, config) {
    const products = [];
    const nodes = pathData.nodes;
    const segments = pathData.segments;
    const turns = pathData.turns;
    const elevationZ = (config.topOfChainMM / 1000);

    let seq = 0;

    // BAŞLANGIÇ: Her zaman AVARE UÇ (Idler End - XKEJ)
    const startNode = nodes[0];
    const firstSeg = segments[0];
    const firstAngleZ = Math.atan2(firstSeg.direction.y, firstSeg.direction.x);

    products.push({
        guid: `conv-idler-start-${Date.now()}-${seq}`,
        name: `${config.platformType}EJ Idler End (Avare)`,
        type: 'XKEJ',
        group: 'IdlerEnds',
        assemblyName: config.assemblyName,
        sequence: seq++,
        topOfChain: config.topOfChainMM,
        bracketHeight: 100,
        platformType: config.platformType,
        position: { x: startNode.x, y: startNode.y, z: elevationZ },
        rotation: { x: 0, y: 0, z: firstAngleZ },
        customAttributes: {}
    });

    // Düz Hatlar ve Virajlar
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const angleZ = Math.atan2(seg.direction.y, seg.direction.x);

        products.push({
            guid: `conv-seg-${Date.now()}-${seq}`,
            name: `Straight Beam L:${seg.length.toFixed(1)}m`,
            type: 'SE01',
            group: 'StraightBeams',
            assemblyName: config.assemblyName,
            sequence: seq++,
            length: seg.length * 1000,
            topOfChain: config.topOfChainMM,
            platformType: config.platformType,
            position: { x: seg.from.x, y: seg.from.y, z: elevationZ },
            rotation: { x: 0, y: 0, z: angleZ },
            customAttributes: {}
        });

        const turn = turns.find(t => t.nodeIndex === i + 1);
        if (turn) {
            products.push({
                guid: `conv-bend-${Date.now()}-${seq}`,
                name: `Curve ${turn.standardAngle}° (${turn.direction === 'left' ? 'L' : 'R'})`,
                type: 'CE01',
                group: 'Bends',
                assemblyName: config.assemblyName,
                sequence: seq++,
                radius: config.bendRadiusMM,
                angle: turn.standardAngle,
                bendDirection: turn.direction === 'left' ? 'Left' : 'Right',
                topOfChain: config.topOfChainMM,
                platformType: config.platformType,
                position: { x: turn.point.x, y: turn.point.y, z: elevationZ },
                rotation: { x: 0, y: 0, z: angleZ },
                customAttributes: {}
            });
        }
    }

    // BİTİŞ: Her zaman MOTOR / TAHRİK ÜNİTESİ (Drive Unit - XHEB)
    const lastNode = nodes[nodes.length - 1];
    const lastSeg = segments[segments.length - 1];
    const lastAngleZ = Math.atan2(lastSeg.direction.y, lastSeg.direction.x);

    products.push({
        guid: `conv-drive-end-${Date.now()}-${seq}`,
        name: `${config.platformType}EB Drive Unit (Motor)`,
        type: 'XHEB',
        group: 'Motors',
        assemblyName: config.assemblyName,
        sequence: seq++,
        topOfChain: config.topOfChainMM,
        bracketHeight: 100,
        platformType: config.platformType,
        position: { x: lastNode.x, y: lastNode.y, z: elevationZ },
        rotation: { x: 0, y: 0, z: lastAngleZ },
        customAttributes: { motorKw: 0.37, gearRatio: '1:30' }
    });

    return products;
}

// Global Exports
if (typeof window !== 'undefined') {
    window.populate2DConveyorCADGeometry = populate2DConveyorCADGeometry;
    window.generate2DConveyorCADGroup = generate2DConveyorCADGroup;
    window.calculateAndRenderConveyorBOM = calculateAndRenderConveyorBOM;
    window.update2DConveyorParametricEditor = update2DConveyorParametricEditor;
    window.applySelected2DConveyorParameters = applySelected2DConveyorParameters;
    window.convertActive2DConveyorTo3D = convertActive2DConveyorTo3D;
    window.toggleActive2DConveyorVisibility = toggleActive2DConveyorVisibility;
    window.executeConveyorBuild = executeConveyorBuild;
}
