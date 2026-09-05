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

/**
 * 1. 2D AutoCAD Tipi Parametrik Konveyör Gövde Geometrisini Doldur / Yenile
 * - Metinler tamamen kaldırıldı (Temiz CAD çizgileri).
 * - Virajlar: 200mm düzlük + R kavisli yay + 200mm çıkış düzlüğü.
 * - Radius konveyörün orta ekseninden ölçülür.
 */
export function populate2DConveyorCADGeometry(group, pathData, widthM = 0.105, assyName = null) {
    if (!group || !pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    if (!assyName) {
        assyName = group.name || `Conveyor_${String(Date.now()).slice(-4)}`;
    }
    group.name = assyName;

    // 1. Güvenli çocuk temizliği (Kopya dizi üzerinde döngü)
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
    const halfW = widthM / 2;
    const zPos = (nodes[0].z || 0) + 0.05;

    const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000, // Saf siyah ince çizgi (DXF stili)
        linewidth: 1.5,
        transparent: true,
        opacity: 0.95,
        depthTest: false
    });

    const axisMat = new THREE.LineDashedMaterial({
        color: 0x000000, // Siyah kesikli AutoCAD eksen çizgisi
        linewidth: 1,
        dashSize: 0.25,
        gapSize: 0.15,
        depthTest: false
    });

    const boundaryLinePts = [];
    const axisLinePts = [];

    // 2. Her bir viraj (Bend) için matematiksel eğri ve 200mm giriş/çıkış teğetlerini hesapla
    const bendDataMap = new Map(); // nodeIndex -> bend geometry info

    for (let i = 0; i < nodes.length - 2; i++) {
        const pPrev = nodes[i].clone(); pPrev.z = zPos;
        const v = nodes[i + 1].clone(); v.z = zPos;
        const pNext = nodes[i + 2].clone(); pNext.z = zPos;

        const u1 = v.clone().sub(pPrev).normalize();
        const u2 = pNext.clone().sub(v).normalize();

        const cosTheta = Math.max(-1, Math.min(1, u1.dot(u2)));
        const theta = Math.acos(cosTheta);

        if (theta > 0.01) {
            const crossZ = u1.x * u2.y - u1.y * u2.x;
            const isLeft = crossZ > 0;

            const turnInfo = (pathData.turns || []).find(t => t.nodeIndex === i + 1);
            let R = (turnInfo && turnInfo.suggestedRadius) ? turnInfo.suggestedRadius : 0.7; // Varsayılan R = 700mm
            let L_tan = 0.2; // 200 mm düzlük

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
                nodeIndex: i + 1,
                isLeft,
                R,
                L_tan,
                theta,
                u1,
                u2,
                norm1,
                cArc,
                pBendStart,
                pArcStart,
                pArcEnd,
                pBendEnd
            });
        }
    }

    // 3. Düz Segmentleri (Straight Beams) Çiz
    // Idler (Avare Uç) Kutusu: 300 mm (0.30m)
    const firstDir = pathData.segments[0].direction.clone().normalize();
    const firstNorm = new THREE.Vector3(-firstDir.y, firstDir.x, 0).normalize();
    const firstNodePt = nodes[0].clone(); firstNodePt.z = zPos;
    const firstNodeNextPt = nodes[1].clone(); firstNodeNextPt.z = zPos;
    const firstSegTotalLen = firstNodePt.distanceTo(firstNodeNextPt);
    const maxAvailableFirst = (nodes.length === 2) ? firstSegTotalLen * 0.45 : firstSegTotalLen * 0.85;
    const L_idler = Math.min(0.30, maxAvailableFirst); // 300 mm (0.30m)
    const pIdlerEnd = firstNodePt.clone().addScaledVector(firstDir, L_idler);

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

        // Önceki düğüm bir bend bitişi ise başlangıcı oraya bağla
        if (bendDataMap.has(i)) {
            pStart = bendDataMap.get(i).pBendEnd.clone();
        } else if (i === 0) {
            // İlk segment ise Idler (300mm) kutusunun bitişinden başla (içinde kesikli çizgi olmasın)
            pStart = pIdlerEnd.clone();
        }

        // Sonraki düğüm bir bend başlangıcı ise bitişi oraya bağla
        if (bendDataMap.has(i + 1)) {
            pEnd = bendDataMap.get(i + 1).pBendStart.clone();
        } else if (i === lastSegIdx) {
            // Son segment ise tahrik kafasının başlangıcına bağla
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

        // Sol normal birim vektörler (Track coordinate system: daima sola bakan dik vektör)
        const n1Left = new THREE.Vector3(-u1.y, u1.x, 0).normalize();
        const n2Left = new THREE.Vector3(-u2.y, u2.x, 0).normalize();

        // Sol ray ve sağ ray yarıçapları (Kavis merkezine göre):
        // Sol dönüşte kavis merkezi sol tarafta -> Sol ray içte (R - halfW), Sağ ray dışta (R + halfW)
        // Sağ dönüşte kavis merkezi sağ tarafta -> Sağ ray içte (R - halfW), Sol ray dışta (R + halfW)
        const R_left = isLeft ? Math.max(0.01, R - halfW) : (R + halfW);
        const R_right = isLeft ? (R + halfW) : Math.max(0.01, R - halfW);

        // A. Giriş Flanşı / Birleşim Çizgisi (Seam line across conveyor at pBendStart)
        const inLeft1 = pBendStart.clone().addScaledVector(n1Left, halfW);
        const inRight1 = pBendStart.clone().addScaledVector(n1Left, -halfW);
        boundaryLinePts.push(inLeft1, inRight1);

        // B. 200mm Giriş Düzlüğü (Sol ve Sağ Raylar)
        const inLeft2 = pArcStart.clone().addScaledVector(n1Left, halfW);
        const inRight2 = pArcStart.clone().addScaledVector(n1Left, -halfW);
        boundaryLinePts.push(inLeft1, inLeft2);
        boundaryLinePts.push(inRight1, inRight2);
        axisLinePts.push(pBendStart, pArcStart);

        // C. Kavisli Yay (Radius Arc): Sol ray daima sol raya, sağ ray daima sağ raya bağlanır
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

        // D. 200mm Çıkış Düzlüğü (Sol ve Sağ Raylar)
        const outLeft2 = pBendEnd.clone().addScaledVector(n2Left, halfW);
        const outRight2 = pBendEnd.clone().addScaledVector(n2Left, -halfW);

        boundaryLinePts.push(prevLeft, outLeft2);
        boundaryLinePts.push(prevRight, outRight2);
        axisLinePts.push(pArcEnd, pBendEnd);

        // E. Çıkış Flanşı / Birleşim Çizgisi (Seam line across conveyor at pBendEnd)
        boundaryLinePts.push(outLeft2, outRight2);
    });

    // Çift kenar sınır çizgilerini sahneye ekle
    if (boundaryLinePts.length > 0) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(boundaryLinePts);
        const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
        lineSegments.name = 'Conveyor2DBoundaryLines';
        group.add(lineSegments);
    }

    // Eksen çizgisini (Dashed line) sahneye ekle
    if (axisLinePts.length > 0) {
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisLinePts);
        const axisLine = new THREE.LineSegments(axisGeo, axisMat);
        axisLine.computeLineDistances();
        axisLine.name = 'Conveyor2DCenterline';
        group.add(axisLine);
    }

    // 5. Başlangıç Sembolü: HER ZAMAN AVARE UÇ (Idler End) - 300 mm Dikdörtgen Kutu
    // İçinde kesikli çizgi bulunmaz, kesikli çizgi Idler kutusundan sonra başlar.
    const idlerBackLeft = firstNodePt.clone().addScaledVector(firstNorm, halfW);
    const idlerBackRight = firstNodePt.clone().addScaledVector(firstNorm, -halfW);
    const idlerFrontLeft = pIdlerEnd.clone().addScaledVector(firstNorm, halfW);
    const idlerFrontRight = pIdlerEnd.clone().addScaledVector(firstNorm, -halfW);

    const idlerPts = [
        // 1. Arka Uç Sınır Çizgisi (Kapak)
        idlerBackLeft, idlerBackRight,
        // 2. Sol Yan Kenar Sacı
        idlerBackLeft, idlerFrontLeft,
        // 3. Sağ Yan Kenar Sacı
        idlerBackRight, idlerFrontRight,
        // 4. Ön Flanş / Gövde Birleşim Çizgisi (Idler ile gövde arasındaki ek yeri)
        idlerFrontLeft, idlerFrontRight
    ];

    const idlerGeo = new THREE.BufferGeometry().setFromPoints(idlerPts);
    const idlerLine = new THREE.LineSegments(idlerGeo, lineMat);
    idlerLine.name = 'Conveyor2DIdlerEnd';
    group.add(idlerLine);

    // 6. Bitiş Sembolü: HER ZAMAN MOTORLU TAHRİK (Drive Unit) - AutoCAD DXF Dış Sınır Çizgileri
    const lastNode = nodes[nodes.length - 1].clone(); lastNode.z = zPos;
    const lastNorm = new THREE.Vector3(-lastDir.y, lastDir.x, 0).normalize();
    const mSide = lastNorm.clone().negate(); // Sağ tarafa monteli motor (Resimdeki yeşil kısım ile birebir uyumlu)

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

    // A. Ana Tahrik Kafası Şasi Kutusu (x: -0.40 -> 0.0)
    // Kiriş birleşim flanş çizgisi (Gövde ile birleşim ek yeri)
    driveUnitPts.push(ptLeft(-0.40), pt(-0.40, 0.0));
    // Sol ve sağ gövde sınır hatları
    driveUnitPts.push(ptLeft(-0.40), ptLeft(0.0));
    driveUnitPts.push(pt(-0.40, 0.0), pt(0.0, 0.0));
    // Ön kafa çizgisi (Tahrik mili ucu)
    driveUnitPts.push(ptLeft(0.0), pt(0.0, 0.0));

    // Eksen çizgisi (Tahrik kafası içi)
    axisLinePts.push(lastNode.clone().addScaledVector(lastDir, -L_drive), lastNode.clone());

    // B. Redüktör Bağlantı Kolları (Montaj Boyunları)
    // Ön kol:
    driveUnitPts.push(pt(-0.06, 0.0), pt(-0.06, 0.04));
    driveUnitPts.push(pt(-0.09, 0.0), pt(-0.09, 0.04));
    // Arka kol:
    driveUnitPts.push(pt(-0.17, 0.0), pt(-0.17, 0.04));
    driveUnitPts.push(pt(-0.20, 0.0), pt(-0.20, 0.04));

    // C. Redüktör Gövdesi (Gearbox Housing - Kademeli DXF Sınır Hatları)
    // Ön kademe çıkıntısı
    driveUnitPts.push(pt(-0.06, 0.07), pt(-0.02, 0.07));
    driveUnitPts.push(pt(-0.02, 0.07), pt(-0.02, 0.19));
    driveUnitPts.push(pt(-0.02, 0.19), pt(-0.06, 0.19));
    // Ana redüktör gövde çerçevesi
    driveUnitPts.push(pt(-0.06, 0.04), pt(-0.06, 0.07));
    driveUnitPts.push(pt(-0.06, 0.19), pt(-0.06, 0.22));
    driveUnitPts.push(pt(-0.06, 0.22), pt(-0.22, 0.22));
    driveUnitPts.push(pt(-0.22, 0.22), pt(-0.22, 0.04));
    driveUnitPts.push(pt(-0.22, 0.04), pt(-0.06, 0.04));

    // D. Elektrik Motoru (Gövde, Klemens Kutusu ve Pah Kırılmış Pervane Kapağı)
    // Motor iç kenarı
    driveUnitPts.push(pt(-0.22, 0.06), pt(-0.39, 0.06));
    // Arka fan kapağı (45° pah kırılmış köşeler)
    driveUnitPts.push(pt(-0.39, 0.06), pt(-0.42, 0.08));
    driveUnitPts.push(pt(-0.42, 0.08), pt(-0.42, 0.18));
    driveUnitPts.push(pt(-0.42, 0.18), pt(-0.39, 0.20));
    // Dış kenar ve Klemens Kutusu çıkıntısı
    driveUnitPts.push(pt(-0.39, 0.20), pt(-0.31, 0.20));
    driveUnitPts.push(pt(-0.31, 0.20), pt(-0.31, 0.235));
    driveUnitPts.push(pt(-0.31, 0.235), pt(-0.25, 0.235));
    driveUnitPts.push(pt(-0.25, 0.235), pt(-0.25, 0.20));
    driveUnitPts.push(pt(-0.25, 0.20), pt(-0.22, 0.20));
    // Motorun redüktöre flanş bağlantı çizgisi
    driveUnitPts.push(pt(-0.22, 0.20), pt(-0.22, 0.06));

    if (driveUnitPts.length > 0) {
        const driveUnitGeo = new THREE.BufferGeometry().setFromPoints(driveUnitPts);
        const driveUnitMesh = new THREE.LineSegments(driveUnitGeo, lineMat);
        driveUnitMesh.name = 'Conveyor2DDriveUnit';
        group.add(driveUnitMesh);
    }

    // METİNLER TAMAMEN KALDIRILDI: Konveyör çizimi üzerinde hiçbir etiket/metin yer almaz.

    // 7. UserData & Ürün Ağacı Entegrasyonu
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

        // Bir sonraki doğrultu için açıyı ve radiusu uygula
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

    // Yeni polyline analizi
    const newPathData = typeof window.analyzeConveyorPolyline === 'function' ? window.analyzeConveyorPolyline(newNodes) : pathData;

    // Radius bilgilerini newPathData.turns'e aktar
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
