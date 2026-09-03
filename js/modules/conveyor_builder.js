/**
 * conveyor_builder.js
 * ProposalApp - Akıllı Polyline'dan 2D CAD Taslağı, BOM Maliyet Hesaplayıcı & 3D Konveyör İnşa Motoru
 */

let active2DConveyorGroup = null;

/**
 * AutoCAD Teknik Çizim Stili Metin Sprite Üretici (Arkaplansız, Saf Siyah İnce Yazı, İkonsuz)
 */
export function createCADTechnicalTextSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 512, 100);
    ctx.font = '500 32px "ISOCPEUR", "simplex", "Segoe UI", "Arial", sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

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

/**
 * 1. 2D AutoCAD Tipi Parametrik Konveyör Gövde Geometrisini Doldur / Yenile
 * - Zemin Kotu: Referans zemin kotunun hemen 20mm üzerinde (zPos = floorZ + 0.02)
 * - Başlangıç: Tamamen düz Avare uç çizgisi (radius ve daire yok)
 * - Virajlar: 200mm giriş düzlüğü + R kavisli yay + 200mm çıkış düzlüğü (büzülmesiz, teğet)
 * - Bitiş: Detaylı XHEB Motor Tahrik dış sınır çizgileri (kademeli redüktör, kollar, motor, pahlı fan kapağı)
 */
export function populate2DConveyorCADGeometry(group, pathData, widthM = 0.105, assyName = null, floorElev = null) {
    if (!group || !pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    if (!assyName) {
        assyName = group.name || `Conveyor_${String(Date.now()).slice(-4)}`;
    }
    group.name = assyName;

    // Güvenli çocuk temizliği (Kopya dizi üzerinde döngü)
    const existing = [...group.children];
    for (const c of existing) {
        group.remove(c);
        if (c.geometry) c.geometry.dispose?.();
        if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
            else c.material.dispose?.();
        }
    }

    const nodes = pathData.nodes;
    const halfW = widthM / 2;

    const floorZ = (typeof floorElev === 'number') ? floorElev :
                   (typeof group.parent?.userData?.floorElevation === 'number' ? group.parent.userData.floorElevation :
                   ((nodes[0] && typeof nodes[0].z === 'number') ? nodes[0].z :
                   (typeof getActiveLevelElevation === 'function' ? getActiveLevelElevation() : 0)));
    const zPos = floorZ + 0.02;

    const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.95,
        depthTest: false
    });

    const axisMat = new THREE.LineDashedMaterial({
        color: 0x000000,
        linewidth: 1,
        dashSize: 0.25,
        gapSize: 0.15,
        depthTest: false
    });

    const boundaryLinePts = [];
    const axisLinePts = [];

    // 2. Her bir viraj (Bend) için matematiksel eğri ve 200mm giriş/çıkış teğetlerini hesapla
    const bendDataMap = new Map();

    for (let i = 0; i < nodes.length - 2; i++) {
        const pPrev = nodes[i].clone(); pPrev.z = zPos;
        const v = nodes[i + 1].clone(); v.z = zPos;
        const pNext = nodes[i + 2].clone(); pNext.z = zPos;

        const u1 = v.clone().sub(pPrev).normalize();
        const u2 = pNext.clone().sub(v).normalize();

        const cosTheta = THREE.MathUtils.clamp(u1.dot(u2), -1.0, 1.0);
        const theta = Math.acos(cosTheta);

        if (theta > 0.03) {
            const crossZ = u1.x * u2.y - u1.y * u2.x;
            const isLeft = crossZ > 0;

            const turnInfo = (pathData.turns || []).find(t => t.nodeIndex === i + 1);
            let R = (turnInfo && turnInfo.suggestedRadius) ? turnInfo.suggestedRadius : 0.7;
            let L_tan = 0.2;

            let T_arc = R * Math.tan(theta / 2.0);
            let T_total = T_arc + L_tan;

            const len1 = pPrev.distanceTo(v);
            const len2 = v.distanceTo(pNext);
            const maxAllowedT = Math.min(len1 * 0.45, len2 * 0.45);
            if (T_total > maxAllowedT && maxAllowedT > 0.05) {
                const ratio = maxAllowedT / T_total;
                R *= ratio;
                L_tan *= ratio;
                T_arc = R * Math.tan(theta / 2.0);
                T_total = T_arc + L_tan;
            }

            const pBendStart = v.clone().addScaledVector(u1, -T_total);
            const pArcStart = pBendStart.clone().addScaledVector(u1, L_tan);

            const norm1 = isLeft ? new THREE.Vector3(-u1.y, u1.x, 0) : new THREE.Vector3(u1.y, -u1.x, 0);
            const cArc = pArcStart.clone().addScaledVector(norm1, R);

            const pArcEnd = v.clone().addScaledVector(u2, T_arc);
            const pBendEnd = pArcEnd.clone().addScaledVector(u2, L_tan);

            bendDataMap.set(i + 1, {
                isLeft,
                R,
                theta,
                u1,
                u2,
                cArc,
                pBendStart,
                pArcStart,
                pArcEnd,
                pBendEnd
            });
        }
    }

    // 3. Düz Segmentleri (Straight Beams) Çiz
    const lastSegIdx = nodes.length - 2;
    const lastDir = pathData.segments[pathData.segments.length - 1].direction.clone().normalize();
    const lastNodePt = nodes[nodes.length - 1].clone(); lastNodePt.z = zPos;
    const lastNodePrevPt = nodes[nodes.length - 2].clone(); lastNodePrevPt.z = zPos;
    const lastSegTotalLen = lastNodePrevPt.distanceTo(lastNodePt);
    const L_drive = Math.min(0.40, lastSegTotalLen * 0.45);
    const driveScale = L_drive / 0.40;
    const pDriveStart = lastNodePt.clone().addScaledVector(lastDir, -L_drive);

    for (let i = 0; i < nodes.length - 1; i++) {
        let pStart = nodes[i].clone(); pStart.z = zPos;
        let pEnd = nodes[i + 1].clone(); pEnd.z = zPos;

        if (bendDataMap.has(i)) {
            pStart = bendDataMap.get(i).pBendEnd.clone();
        }
        if (bendDataMap.has(i + 1)) {
            pEnd = bendDataMap.get(i + 1).pBendStart.clone();
        } else if (i === lastSegIdx) {
            pEnd = pDriveStart.clone();
        }

        const segDir = pEnd.clone().sub(pStart).normalize();
        const segNorm = new THREE.Vector3(-segDir.y, segDir.x, 0).normalize();

        const left1 = pStart.clone().addScaledVector(segNorm, halfW);
        const right1 = pStart.clone().addScaledVector(segNorm, -halfW);
        const left2 = pEnd.clone().addScaledVector(segNorm, halfW);
        const right2 = pEnd.clone().addScaledVector(segNorm, -halfW);

        boundaryLinePts.push(left1, left2);
        boundaryLinePts.push(right1, right2);

        axisLinePts.push(pStart, pEnd);
    }

    // 4. Viraj Parçalarını (Bend Modules) Çiz: 200mm düzlük + R kavisli yay + 200mm düzlük
    bendDataMap.forEach((bend) => {
        const { isLeft, R, cArc, pBendStart, pArcStart, pArcEnd, pBendEnd, u1, u2 } = bend;

        const n1Left = new THREE.Vector3(-u1.y, u1.x, 0).normalize();
        const n2Left = new THREE.Vector3(-u2.y, u2.x, 0).normalize();

        const R_left = isLeft ? Math.max(0.01, R - halfW) : (R + halfW);
        const R_right = isLeft ? (R + halfW) : Math.max(0.01, R - halfW);

        // A. Giriş Flanşı
        const inLeft1 = pBendStart.clone().addScaledVector(n1Left, halfW);
        const inRight1 = pBendStart.clone().addScaledVector(n1Left, -halfW);
        boundaryLinePts.push(inLeft1, inRight1);

        // B. 200mm Giriş Düzlüğü
        const inLeft2 = pArcStart.clone().addScaledVector(n1Left, halfW);
        const inRight2 = pArcStart.clone().addScaledVector(n1Left, -halfW);
        boundaryLinePts.push(inLeft1, inLeft2);
        boundaryLinePts.push(inRight1, inRight2);
        axisLinePts.push(pBendStart, pArcStart);

        // C. Kavisli Yay (Radius Arc)
        const aStart = Math.atan2(pArcStart.y - cArc.y, pArcStart.x - cArc.x);
        const aEnd = Math.atan2(pArcEnd.y - cArc.y, pArcEnd.x - cArc.x);

        let diff = aEnd - aStart;
        if (isLeft) {
            while (diff < 0) diff += 2 * Math.PI;
            while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
        } else {
            while (diff > 0) diff -= 2 * Math.PI;
            while (diff < -2 * Math.PI) diff += 2 * Math.PI;
        }

        const arcSteps = 24;
        let prevLeft = inLeft2;
        let prevRight = inRight2;
        let prevCenter = pArcStart;

        for (let s = 1; s <= arcSteps; s++) {
            const frac = s / arcSteps;
            const angle = aStart + diff * frac;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            const currCenter = new THREE.Vector3(cArc.x + cosA * R, cArc.y + sinA * R, zPos);
            const currLeft = new THREE.Vector3(cArc.x + cosA * R_left, cArc.y + sinA * R_left, zPos);
            const currRight = new THREE.Vector3(cArc.x + cosA * R_right, cArc.y + sinA * R_right, zPos);

            boundaryLinePts.push(prevLeft, currLeft);
            boundaryLinePts.push(prevRight, currRight);
            axisLinePts.push(prevCenter, currCenter);

            prevLeft = currLeft;
            prevRight = currRight;
            prevCenter = currCenter;
        }

        // D. 200mm Çıkış Düzlüğü
        const outLeft2 = pBendEnd.clone().addScaledVector(n2Left, halfW);
        const outRight2 = pBendEnd.clone().addScaledVector(n2Left, -halfW);

        boundaryLinePts.push(prevLeft, outLeft2);
        boundaryLinePts.push(prevRight, outRight2);
        axisLinePts.push(pArcEnd, pBendEnd);

        // E. Çıkış Flanşı
        boundaryLinePts.push(outLeft2, outRight2);
    });

    if (boundaryLinePts.length > 0) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(boundaryLinePts);
        const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
        lineSegments.name = 'Conveyor2DBoundaryLines';
        group.add(lineSegments);
    }

    if (axisLinePts.length > 0) {
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisLinePts);
        const axisLine = new THREE.LineSegments(axisGeo, axisMat);
        axisLine.computeLineDistances();
        axisLine.name = 'Conveyor2DCenterline';
        group.add(axisLine);
    }

    // 5. Başlangıç Sembolü: HER ZAMAN AVARE UÇ (Idler End) - Tamamen Düz Sınır Çizgisi
    const startNode = nodes[0];
    const firstDir = pathData.segments[0].direction;
    const firstNorm = new THREE.Vector3(-firstDir.y, firstDir.x, 0).normalize();
    const idlerLeft = startNode.clone().addScaledVector(firstNorm, halfW);
    const idlerRight = startNode.clone().addScaledVector(firstNorm, -halfW);
    idlerLeft.z = zPos;
    idlerRight.z = zPos;

    const idlerGeo = new THREE.BufferGeometry().setFromPoints([idlerLeft, idlerRight]);
    const idlerLine = new THREE.LineSegments(idlerGeo, lineMat);
    idlerLine.name = 'Conveyor2DIdlerEnd';
    group.add(idlerLine);

    // 6. Bitiş Sembolü: HER ZAMAN MOTORLU TAHRİK (Drive Unit) - AutoCAD DXF Dış Sınır Çizgileri
    const lastNode = nodes[nodes.length - 1].clone(); lastNode.z = zPos;
    const lastNorm = new THREE.Vector3(-lastDir.y, lastDir.x, 0).normalize();
    const mSide = lastNorm.clone().negate();

    const pt = (x_rel, y_out) => {
        return lastNode.clone()
            .addScaledVector(lastDir, x_rel * driveScale)
            .addScaledVector(mSide, halfW + y_out * driveScale);
    };

    const ptLeft = (x_rel) => {
        return lastNode.clone()
            .addScaledVector(lastDir, x_rel * driveScale)
            .addScaledVector(lastNorm, halfW);
    };

    const driveUnitPts = [];

    // A. Ana Tahrik Kafası Şasi Kutusu
    driveUnitPts.push(ptLeft(-0.40), pt(-0.40, 0.0));
    driveUnitPts.push(ptLeft(-0.40), ptLeft(0.0));
    driveUnitPts.push(pt(-0.40, 0.0), pt(0.0, 0.0));
    driveUnitPts.push(ptLeft(0.0), pt(0.0, 0.0));

    axisLinePts.push(lastNode.clone().addScaledVector(lastDir, -L_drive), lastNode.clone());

    // B. Redüktör Bağlantı Kolları
    driveUnitPts.push(pt(-0.06, 0.0), pt(-0.06, 0.04));
    driveUnitPts.push(pt(-0.09, 0.0), pt(-0.09, 0.04));
    driveUnitPts.push(pt(-0.17, 0.0), pt(-0.17, 0.04));
    driveUnitPts.push(pt(-0.20, 0.0), pt(-0.20, 0.04));

    // C. Redüktör Gövdesi
    driveUnitPts.push(pt(-0.06, 0.07), pt(-0.02, 0.07));
    driveUnitPts.push(pt(-0.02, 0.07), pt(-0.02, 0.19));
    driveUnitPts.push(pt(-0.02, 0.19), pt(-0.06, 0.19));
    driveUnitPts.push(pt(-0.06, 0.04), pt(-0.06, 0.07));
    driveUnitPts.push(pt(-0.06, 0.19), pt(-0.06, 0.22));
    driveUnitPts.push(pt(-0.06, 0.22), pt(-0.22, 0.22));
    driveUnitPts.push(pt(-0.22, 0.22), pt(-0.22, 0.04));
    driveUnitPts.push(pt(-0.22, 0.04), pt(-0.06, 0.04));

    // D. Elektrik Motoru
    driveUnitPts.push(pt(-0.22, 0.06), pt(-0.39, 0.06));
    driveUnitPts.push(pt(-0.39, 0.06), pt(-0.42, 0.08));
    driveUnitPts.push(pt(-0.42, 0.08), pt(-0.42, 0.18));
    driveUnitPts.push(pt(-0.42, 0.18), pt(-0.39, 0.20));
    driveUnitPts.push(pt(-0.39, 0.20), pt(-0.31, 0.20));
    driveUnitPts.push(pt(-0.31, 0.20), pt(-0.31, 0.235));
    driveUnitPts.push(pt(-0.31, 0.235), pt(-0.25, 0.235));
    driveUnitPts.push(pt(-0.25, 0.235), pt(-0.25, 0.20));
    driveUnitPts.push(pt(-0.25, 0.20), pt(-0.22, 0.20));
    driveUnitPts.push(pt(-0.22, 0.20), pt(-0.22, 0.06));

    if (driveUnitPts.length > 0) {
        const driveUnitGeo = new THREE.BufferGeometry().setFromPoints(driveUnitPts);
        const driveUnitMesh = new THREE.LineSegments(driveUnitGeo, lineMat);
        driveUnitMesh.name = 'Conveyor2DDriveUnit';
        group.add(driveUnitMesh);
    }
}

/**
 * 2. Yeni 2D/3D Entegre Konveyör Montaj Grubu Oluştur (Root Assembly)
 */
export function generate2DConveyorCADGroup(pathData, widthM = 0.105, assyName = null, floorElev = null) {
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return null;
    const group = new THREE.Group();
    if (!assyName) {
        assyName = `Conveyor_${String(Date.now()).slice(-4)}`;
    }
    group.name = assyName;

    const floorZ = (typeof floorElev === 'number') ? floorElev :
                   ((pathData.nodes[0] && typeof pathData.nodes[0].z === 'number') ? pathData.nodes[0].z :
                   (typeof getActiveLevelElevation === 'function' ? getActiveLevelElevation() : 0));

    // Kapsayıcı Root userData
    group.userData = {
        type: 'xml-product',
        isParametric: true,
        parametricKind: 'conveyor-2d',
        is2DConveyorSketch: true,
        isConveyorAssemblyRoot: true,
        assemblyName: assyName,
        displayMode: '2D', // '2D' | '3D' | 'BOTH'
        floorElevation: floorZ,
        topOfChainMM: 850,
        platformType: 'XH',
        parametric: {
            width: widthM,
            pathData: pathData,
            assemblyName: assyName
        },
        product: {
            name: `${assyName} (${pathData.totalLength.toFixed(1)}m)`,
            type: 'conveyor-assembly',
            group: 'Conveyors',
            assemblyName: assyName,
            position: { x: pathData.nodes[0].x, y: pathData.nodes[0].y, z: floorZ }
        }
    };

    // 1. 2D Çizim Katmanı (sketch2DGroup)
    let sketch2DGroup = new THREE.Group();
    sketch2DGroup.name = 'Conveyor2DSketch';
    group.add(sketch2DGroup);
    group.userData.sketch2DGroup = sketch2DGroup;

    // 2. 3D Katı Model Katmanı (model3DGroup)
    let model3DGroup = new THREE.Group();
    model3DGroup.name = 'Conveyor3DModel';
    model3DGroup.visible = false;
    group.add(model3DGroup);
    group.userData.model3DGroup = model3DGroup;

    // 2D Çizimi oluştur
    populate2DConveyorCADGeometry(sketch2DGroup, pathData, widthM, assyName, floorZ);

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
    turns.forEach(turn => {
        const rad = (turn.standardAngle * Math.PI) / 180;
        totalBendLength += (bendRadiusM * rad) + 0.4;
    });

    const straightLength = Math.max(0, totalLength - totalBendLength);
    const beamProfilesCount = Math.ceil(straightLength / 3.0);
    const supportLegsCount = Math.max(2, Math.ceil(totalLength / 2.0));

    const costBeams = beamProfilesCount * 140;
    const costBends = turns.length * 480;
    const costDrive = 750;
    const costIdler = 220;
    const costChain = Math.round(totalLength * 85);
    const costGuides = Math.round(totalLength * 2 * 45);
    const costLegs = supportLegsCount * 110;

    const totalEstCost = Math.round(costBeams + costBends + costDrive + costIdler + costChain + costGuides + costLegs);

    const costEl = document.getElementById('conveyor-bom-total-cost');
    if (costEl) {
        costEl.innerText = `${totalEstCost.toLocaleString('tr-TR')} €`;
    }

    const tableBody = document.getElementById('conveyor-bom-table-body');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>⚡</span> Motorlu Tahrik Ünitesi (Direct Drive)</td>
                <td class="py-2 px-3 text-cyan-400">XHEB 0 HNRP</td>
                <td class="py-2 px-3 text-gray-400">0.37 kW SEW Motor & Redüktör Paketi</td>
                <td class="py-2 px-3 text-right text-emerald-400 font-bold">1 Adet</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>🟢</span> Avare Dönüş Uç Ünitesi (Idler End)</td>
                <td class="py-2 px-3 text-cyan-400">XHEJ 325</td>
                <td class="py-2 px-3 text-gray-400">Kompakt Bilyalı Rulmanlı Başlangıç Modülü</td>
                <td class="py-2 px-3 text-right text-emerald-400 font-bold">1 Adet</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>📏</span> Alüminyum Gövde Profil Kirişleri</td>
                <td class="py-2 px-3 text-cyan-400">XBCB L (3 Metre)</td>
                <td class="py-2 px-3 text-gray-400">Eloksallı Alüminyum Konveyör Gövdesi</td>
                <td class="py-2 px-3 text-right text-cyan-400 font-bold">${beamProfilesCount} Boy (${straightLength.toFixed(1)}m)</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>↪️</span> Yatay Viraj Modülleri (Wheel Bends)</td>
                <td class="py-2 px-3 text-cyan-400">XHBP R700</td>
                <td class="py-2 px-3 text-gray-400">Düşük Sürtünmeli Tekerlekli Kavisler</td>
                <td class="py-2 px-3 text-right text-amber-400 font-bold">${turns.length} Adet</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>🔗</span> Plastik Baklalı Düz Zincir</td>
                <td class="py-2 px-3 text-cyan-400">XKTP 5A</td>
                <td class="py-2 px-3 text-gray-400">Asetal (POM) Beyaz Konveyör Zinciri</td>
                <td class="py-2 px-3 text-right text-yellow-400 font-bold">${totalLength.toFixed(1)} Metre</td>
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
    if (!groupObj) return;
    let root = groupObj;
    if (!root.userData?.isConveyorAssemblyRoot && root.parent?.userData?.isConveyorAssemblyRoot) {
        root = root.parent;
    }
    if (!root.userData?.is2DConveyorSketch && !root.userData?.isConveyorAssemblyRoot) return;
    active2DConveyorGroup = root;

    const data = root.userData.parametric || {};
    const pathData = data.pathData || root.userData.pathData || {};
    const assyName = data.assemblyName || root.userData.assemblyName || root.name || 'Conveyor';
    const floorZ = typeof root.userData.floorElevation === 'number' ? root.userData.floorElevation : 0;
    const topOfChainMM = root.userData.topOfChainMM || 850;
    const curMode = root.userData.displayMode || '2D';

    const nameEl = document.getElementById('conveyor-2d-name');
    if (nameEl) nameEl.innerText = assyName;

    const lenEl = document.getElementById('conveyor-2d-total-len');
    if (lenEl) lenEl.innerText = `${(pathData.totalLength || 0).toFixed(2)} m`;

    const widthSelect = document.getElementById('conveyor-2d-width-select');
    if (widthSelect) {
        const widthMM = Math.round((data.width || 0.105) * 1000);
        widthSelect.value = String(widthMM);
    }

    const floorElevInput = document.getElementById('conveyor-floor-elev-input');
    if (floorElevInput) {
        floorElevInput.value = floorZ.toFixed(2);
    }

    const tocInput = document.getElementById('conveyor-top-of-chain-input');
    if (tocInput) {
        tocInput.value = String(topOfChainMM);
    }

    // Görünüm butonlarını güncelle
    const btn2d = document.getElementById('btn-mode-2d');
    const btn3d = document.getElementById('btn-mode-3d');
    const btnBoth = document.getElementById('btn-mode-both');

    const activeClass = 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/50';
    const inactiveClass = 'bg-gray-900 text-gray-400 hover:text-gray-200 border-transparent';

    if (btn2d) btn2d.className = `py-1 rounded font-medium transition cursor-pointer text-center ${curMode === '2D' ? activeClass : inactiveClass}`;
    if (btn3d) btn3d.className = `py-1 rounded font-medium transition cursor-pointer text-center ${curMode === '3D' ? activeClass : inactiveClass}`;
    if (btnBoth) btnBoth.className = `py-1 rounded font-medium transition cursor-pointer text-center ${curMode === 'BOTH' ? activeClass : inactiveClass}`;

    // Segmentler ve Açıları Listele
    const listEl = document.getElementById('conveyor-2d-segments-list');
    if (listEl && Array.isArray(pathData.segments)) {
        listEl.innerHTML = pathData.segments.map((seg, idx) => {
            const turn = (pathData.turns || []).find(t => t.nodeIndex === idx + 1);
            let turnHtml = '';
            if (turn) {
                const curRadius = turn.suggestedRadius || 0.7;
                turnHtml = '<div class="flex flex-col gap-1 pt-1.5 border-t border-gray-800/80">' +
                    '<div class="flex items-center justify-between text-[10px]">' +
                    '<span class="text-cyan-400 font-semibold">Viraj #' + (idx + 1) + ' (' + (turn.direction === 'left' ? 'SOL' : 'SAG') + '):</span>' +
                    '<div class="flex items-center gap-1.5">' +
                    '<select id="turn-angle-input-' + idx + '" onchange="applySelected2DConveyorParameters()"' +
                    ' class="bg-black border border-gray-700 rounded px-1 py-0.5 text-cyan-300 font-mono text-[10px] outline-none">' +
                    '<option value="90"' + (turn.standardAngle === 90 ? ' selected' : '') + '>90°</option>' +
                    '<option value="45"' + (turn.standardAngle === 45 ? ' selected' : '') + '>45°</option>' +
                    '<option value="30"' + (turn.standardAngle === 30 ? ' selected' : '') + '>30°</option>' +
                    '<option value="60"' + (turn.standardAngle === 60 ? ' selected' : '') + '>60°</option>' +
                    '<option value="180"' + (turn.standardAngle === 180 ? ' selected' : '') + '>180°</option>' +
                    '</select>' +
                    '<select id="turn-radius-input-' + idx + '" onchange="applySelected2DConveyorParameters()"' +
                    ' class="bg-black border border-gray-700 rounded px-1 py-0.5 text-amber-300 font-mono text-[10px] outline-none">' +
                    '<option value="0.7"' + (Math.abs(curRadius - 0.7) < 0.05 ? ' selected' : '') + '>R: 700mm</option>' +
                    '<option value="0.5"' + (Math.abs(curRadius - 0.5) < 0.05 ? ' selected' : '') + '>R: 500mm</option>' +
                    '<option value="1.0"' + (Math.abs(curRadius - 1.0) < 0.05 ? ' selected' : '') + '>R: 1000mm</option>' +
                    '</select>' +
                    '</div></div>' +
                    '<div class="text-[9px] text-gray-500 font-mono">200mm giriş + R' + Math.round(curRadius * 1000) + ' yay + 200mm çıkış</div>' +
                    '</div>';
            }

            return '<div class="bg-gray-900 border border-gray-800 p-2 rounded space-y-1.5">' +
                '<div class="flex items-center justify-between">' +
                '<span class="font-medium text-gray-200 text-xs">Kol #' + (idx + 1) + ' Uzunluğu:</span>' +
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
 * 5. Parametre Değiştiğinde 2D Çizimi ve 3D Modelleri Anında Senkronize Güncelle
 */
export function applySelected2DConveyorParameters() {
    if (!active2DConveyorGroup) return;
    let root = active2DConveyorGroup;
    if (!root.userData?.isConveyorAssemblyRoot && root.parent?.userData?.isConveyorAssemblyRoot) {
        root = root.parent;
    }

    const data = root.userData.parametric;
    const pathData = data.pathData;
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    const widthSelect = document.getElementById('conveyor-2d-width-select');
    const newWidthM = widthSelect ? (parseFloat(widthSelect.value) || 105) / 1000 : (data.width || 0.105);

    // Segment boylarını ve açıları oku
    const newNodes = [pathData.nodes[0].clone()];
    let currentDir = pathData.segments[0].direction.clone();

    for (let i = 0; i < pathData.segments.length; i++) {
        const lenInput = document.getElementById(`seg-len-input-${i}`);
        const targetLen = lenInput ? (parseFloat(lenInput.value) || pathData.segments[i].length) : pathData.segments[i].length;

        const lastNode = newNodes[newNodes.length - 1];
        const nextNode = lastNode.clone().addScaledVector(currentDir, targetLen);
        newNodes.push(nextNode);

        const turn = (pathData.turns || []).find(t => t.nodeIndex === i + 1);
        if (turn) {
            const angleSelect = document.getElementById(`turn-angle-input-${i}`);
            const targetAngleDeg = angleSelect ? (parseFloat(angleSelect.value) || turn.standardAngle) : turn.standardAngle;
            const sign = turn.direction === 'left' ? 1 : -1;
            const angleRad = THREE.MathUtils.degToRad(targetAngleDeg * sign);

            const radSelect = document.getElementById(`turn-radius-input-${i}`);
            if (radSelect) {
                turn.suggestedRadius = parseFloat(radSelect.value) || 0.7;
            }

            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
            currentDir = new THREE.Vector3(
                currentDir.x * cosA - currentDir.y * sinA,
                currentDir.x * sinA + currentDir.y * cosA,
                0
            ).normalize();
        }
    }

    const newPathData = typeof window.analyzeConveyorPolyline === 'function' ? window.analyzeConveyorPolyline(newNodes) : pathData;

    if (Array.isArray(newPathData.turns) && Array.isArray(pathData.turns)) {
        newPathData.turns.forEach(nt => {
            const ot = pathData.turns.find(t => t.nodeIndex === nt.nodeIndex);
            if (ot && ot.suggestedRadius) {
                nt.suggestedRadius = ot.suggestedRadius;
            } else {
                nt.suggestedRadius = 0.7;
            }
        });
    }

    root.userData.parametric.width = newWidthM;
    root.userData.parametric.pathData = newPathData;

    const floorZ = typeof root.userData.floorElevation === 'number' ? root.userData.floorElevation : 0;
    const sketch2D = root.userData?.sketch2DGroup || root.getObjectByName('Conveyor2DSketch');
    if (sketch2D) {
        populate2DConveyorCADGeometry(sketch2D, newPathData, newWidthM, root.name, floorZ);
    }

    // Eğer 3D modeller zaten mevcutsa, anlık olarak 3D'yi de yeni geometriye uyarla!
    const model3D = root.userData?.model3DGroup || root.getObjectByName('Conveyor3DModel');
    if (model3D && model3D.children.length > 0) {
        convertConveyorTo3D(root);
    }

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
 * 6. Zemin Kotu Değiştiğinde 2D ve 3D'yi Aynı Anda Yeni Kota Taşı
 */
export function applyConveyorFloorElevation() {
    if (!active2DConveyorGroup) return;
    let root = active2DConveyorGroup;
    if (!root.userData?.isConveyorAssemblyRoot && root.parent?.userData?.isConveyorAssemblyRoot) {
        root = root.parent;
    }

    const elevInput = document.getElementById('conveyor-floor-elev-input');
    const newFloorZ = elevInput ? parseFloat(elevInput.value) || 0 : (root.userData.floorElevation || 0);
    root.userData.floorElevation = newFloorZ;

    const sketch2D = root.userData?.sketch2DGroup || root.getObjectByName('Conveyor2DSketch');
    const pathData = root.userData?.parametric?.pathData;
    const widthM = root.userData?.parametric?.width || 0.105;

    if (sketch2D && pathData) {
        populate2DConveyorCADGeometry(sketch2D, pathData, widthM, root.name, newFloorZ);
    }

    const model3D = root.userData?.model3DGroup || root.getObjectByName('Conveyor3DModel');
    if (model3D && model3D.children.length > 0) {
        convertConveyorTo3D(root);
    }

    if (typeof showNotice === 'function') {
        showNotice(`📍 Referans Zemin Kotu Güncellendi: +${newFloorZ.toFixed(2)} m`);
    }
}

/**
 * 7. Taşıma Yüksekliği (Top of Chain) Değiştiğinde 3D Modelleri Güncelle
 */
export function applyConveyorTopOfChain() {
    if (!active2DConveyorGroup) return;
    let root = active2DConveyorGroup;
    if (!root.userData?.isConveyorAssemblyRoot && root.parent?.userData?.isConveyorAssemblyRoot) {
        root = root.parent;
    }

    const tocInput = document.getElementById('conveyor-top-of-chain-input');
    const newTocMM = tocInput ? parseFloat(tocInput.value) || 850 : (root.userData.topOfChainMM || 850);
    root.userData.topOfChainMM = newTocMM;

    const model3D = root.userData?.model3DGroup || root.getObjectByName('Conveyor3DModel');
    if (model3D && model3D.children.length > 0) {
        convertConveyorTo3D(root);
    }

    if (typeof showNotice === 'function') {
        showNotice(`📏 Taşıma Kotu (Top of Chain): ${newTocMM} mm (+${(newTocMM / 1000).toFixed(2)} m)`);
    }
}

/**
 * 8. Görünüm Modunu Değiştir ('2D' | '3D' | 'BOTH')
 */
export function setConveyorDisplayMode(conveyorGroup, mode) {
    if (!conveyorGroup) return;
    let root = conveyorGroup;
    if (!root.userData?.isConveyorAssemblyRoot && root.parent?.userData?.isConveyorAssemblyRoot) {
        root = root.parent;
    }

    const sketch2D = root.userData?.sketch2DGroup || root.getObjectByName('Conveyor2DSketch');
    const model3D = root.userData?.model3DGroup || root.getObjectByName('Conveyor3DModel');

    // Eğer 3D model isteniyor ama henüz üretilmemişse, otomatik üret
    if ((mode === '3D' || mode === 'BOTH') && (!model3D || model3D.children.length === 0)) {
        convertConveyorTo3D(root).then(() => {
            applyModeVisibility(root, mode);
        });
        return;
    }

    applyModeVisibility(root, mode);
}

function applyModeVisibility(root, mode) {
    const sketch2D = root.userData?.sketch2DGroup || root.getObjectByName('Conveyor2DSketch');
    const model3D = root.userData?.model3DGroup || root.getObjectByName('Conveyor3DModel');

    root.userData.displayMode = mode;

    if (mode === '2D') {
        if (sketch2D) sketch2D.visible = true;
        if (model3D) model3D.visible = false;
    } else if (mode === '3D') {
        if (sketch2D) sketch2D.visible = false;
        if (model3D) model3D.visible = true;
    } else if (mode === 'BOTH') {
        if (sketch2D) sketch2D.visible = true;
        if (model3D) model3D.visible = true;
    }

    if (typeof showNotice === 'function') {
        const modeLabel = mode === '2D' ? 'Yalnızca 2D Taslak' :
                          mode === '3D' ? 'Yalnızca 3D Model' : '2D Taslak + 3D Model Birlikte';
        showNotice(`👁️ Görünüm: ${modeLabel}`);
    }

    update2DConveyorParametricEditor(root);
}

/**
 * 9. 2D Taslağı 3D Gerçek Katı Modellerine Dönüştür
 */
export async function convertConveyorTo3D(conveyorRoot) {
    if (!conveyorRoot) return;
    let root = conveyorRoot;
    if (!root.userData?.isConveyorAssemblyRoot && root.parent?.userData?.isConveyorAssemblyRoot) {
        root = root.parent;
    }

    let model3DGroup = root.userData?.model3DGroup || root.getObjectByName('Conveyor3DModel');
    if (!model3DGroup) {
        model3DGroup = new THREE.Group();
        model3DGroup.name = 'Conveyor3DModel';
        root.add(model3DGroup);
        root.userData.model3DGroup = model3DGroup;
    }

    let sketch2DGroup = root.userData?.sketch2DGroup || root.getObjectByName('Conveyor2DSketch');

    const data = root.userData?.parametric || {};
    const pathData = data.pathData || root.userData?.pathData;
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    const floorZ = typeof root.userData?.floorElevation === 'number' ? root.userData.floorElevation : 0;
    const topOfChainMM = root.userData?.topOfChainMM || 850;
    const platformType = root.userData?.platformType || 'XH';
    const assyName = root.userData?.assemblyName || root.name;

    if (typeof showNotice === 'function') {
        showNotice(`⏳ "${assyName}" için 3D katı modeller oluşturuluyor...`);
    }

    // Önceki 3D parçaları temizle
    while (model3DGroup.children.length > 0) {
        const c = model3DGroup.children[0];
        model3DGroup.remove(c);
        if (c.geometry) c.geometry.dispose?.();
        if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
            else c.material.dispose?.();
        }
    }

    // Parça listesi oluştur (FloorZ ve TopOfChain hesabı ile)
    const products = generateConveyorProductsFromPath(pathData, {
        assemblyName: assyName,
        platformType: platformType,
        bendRadiusMM: (pathData.turns && pathData.turns[0]?.suggestedRadius) ? Math.round(pathData.turns[0].suggestedRadius * 1000) : 700,
        topOfChainMM: topOfChainMM,
        floorElev: floorZ
    });

    if (typeof ensureAllXLCTModelsPreloaded === 'function') {
        await ensureAllXLCTModelsPreloaded();
    }

    for (const product of products) {
        if (typeof createProductMesh === 'function') {
            const mesh = await createProductMesh(product);
            if (mesh) {
                mesh.userData.assemblyName = assyName;
                model3DGroup.add(mesh);
            }
        }
    }

    // 3D katmanı görünür yap, 2D katmanı gizle
    model3DGroup.visible = true;
    root.userData.displayMode = '3D';
    if (sketch2DGroup) {
        sketch2DGroup.visible = false;
    }

    if (typeof rebuildModelTreeFromScene === 'function') {
        rebuildModelTreeFromScene();
    }

    if (typeof showNotice === 'function') {
        showNotice(`✅ "${assyName}" 3D Modeli Hazır: Zemin Kotu: +${floorZ.toFixed(2)}m, Taşıma: +${(topOfChainMM / 1000).toFixed(2)}m`);
    }

    update2DConveyorParametricEditor(root);
}

export async function convertActive2DConveyorTo3D() {
    if (!active2DConveyorGroup) return;
    await convertConveyorTo3D(active2DConveyorGroup);
}

export function toggleActive2DConveyorVisibility() {
    if (!active2DConveyorGroup) return;
    const cur = active2DConveyorGroup.userData.displayMode || '2D';
    const next = cur === '2D' ? '3D' : (cur === '3D' ? 'BOTH' : '2D');
    setConveyorDisplayMode(active2DConveyorGroup, next);
}

/**
 * 10. Polyline Geometrisinden Sıralı Ürün Listesi Türet
 * BAŞLANGIÇ: HER ZAMAN AVARE (XHEJ), BİTİŞ: HER ZAMAN MOTOR (XHEB)
 */
function generateConveyorProductsFromPath(pathData, config) {
    const products = [];
    const nodes = pathData.nodes;
    const segments = pathData.segments;
    const turns = pathData.turns || [];
    const floorElev = typeof config.floorElev === 'number' ? config.floorElev : 0;
    const elevationZ = floorElev + (config.topOfChainMM / 1000);

    let seq = 0;

    const isXB = config.platformType === 'XB' || config.platformType === 'X180';
    const idlerType = isXB ? 'XBEJ' : 'XHEJ';
    const driveType = isXB ? 'XBEB' : 'XHEB';
    const bendType = isXB ? 'XBBP' : 'XHBP';
    const beamType = isXB ? 'XBCB' : 'XBCB';

    // BAŞLANGIÇ: Her zaman AVARE UÇ (Idler End)
    const startNode = nodes[0];
    const firstSeg = segments[0];
    const firstAngleZ = Math.atan2(firstSeg.direction.y, firstSeg.direction.x);

    products.push({
        guid: `conv-idler-start-${Date.now()}-${seq}`,
        name: `${idlerType} Idler End (Avare)`,
        productno: idlerType,
        type: idlerType,
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
            productno: beamType,
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
                productno: bendType,
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

    // BİTİŞ: Her zaman MOTOR / TAHRİK ÜNİTESİ (Drive Unit)
    const lastNode = nodes[nodes.length - 1];
    const lastSeg = segments[segments.length - 1];
    const lastAngleZ = Math.atan2(lastSeg.direction.y, lastSeg.direction.x);

    products.push({
        guid: `conv-drive-end-${Date.now()}-${seq}`,
        name: `${driveType} Drive Unit (Motor)`,
        productno: `${driveType}HNRP`,
        type: driveType,
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
    window.createCADTechnicalTextSprite = createCADTechnicalTextSprite;
    window.populate2DConveyorCADGeometry = populate2DConveyorCADGeometry;
    window.generate2DConveyorCADGroup = generate2DConveyorCADGroup;
    window.calculateAndRenderConveyorBOM = calculateAndRenderConveyorBOM;
    window.update2DConveyorParametricEditor = update2DConveyorParametricEditor;
    window.applySelected2DConveyorParameters = applySelected2DConveyorParameters;
    window.convertConveyorTo3D = convertConveyorTo3D;
    window.convertActive2DConveyorTo3D = convertActive2DConveyorTo3D;
    window.setConveyorDisplayMode = setConveyorDisplayMode;
    window.applyConveyorFloorElevation = applyConveyorFloorElevation;
    window.applyConveyorTopOfChain = applyConveyorTopOfChain;
    window.toggleActive2DConveyorVisibility = toggleActive2DConveyorVisibility;
}
