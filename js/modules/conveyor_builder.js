/**
 * conveyor_builder.js
 * ProposalApp - Akıllı Polyline'dan Hızlı BOM Maliyet Hesaplayıcı & 3D Konveyör İnşa Motoru
 */

/**
 * 1. 3D Model Yüklemeden Hızlı BOM (Malzeme & Maliyet) Listesi Hesapla
 */
export function calculateAndRenderConveyorBOM(pathData) {
    if (!pathData || !pathData.nodes || pathData.nodes.length < 2) return;

    const totalLength = pathData.totalLength || 0;
    const turns = pathData.turns || [];

    // Metraj ve parça kırılımları
    const bendRadiusM = 0.7; // 700 mm standart yarıçap
    let totalBendLength = 0;
    turns.forEach(t => {
        const rad = THREE.MathUtils.degToRad(t.standardAngle || 90);
        totalBendLength += rad * bendRadiusM;
    });

    const netStraightLen = Math.max(0.5, totalLength - totalBendLength);
    const standard3mBeams = Math.floor(netStraightLen / 3.0);
    const remainderM = (netStraightLen % 3.0);

    const totalChainLen = (totalLength * 2) + 1.8; // Gidiş + Dönüş + Sarım payı
    const supportLegsCount = Math.max(2, Math.ceil(totalLength / 2.5) + turns.length);

    // Yaklaşık Maliyet Hesabı (Euro Göstergesi)
    const costBeams = (netStraightLen * 85);       // ~85 €/m alüminyum gövde profil
    const costBends = (turns.length * 320);        // ~320 €/adet rulmanlı tekerlekli viraj
    const costDrive = 750;                         // 0.37kW motor, redüktör ve tahrik kafası
    const costIdler = 220;                         // Avare gergili dönüş ucu
    const costChain = (totalChainLen * 38);        // ~38 €/m asetal baklalı zincir
    const costGuides = (totalLength * 2 * 18);     // Çift taraf polietilen kılavuz korkuluk
    const costLegs = (supportLegsCount * 65);      // Paslanmaz / alüminyum çift ayak

    const totalEstCost = Math.round(costBeams + costBends + costDrive + costIdler + costChain + costGuides + costLegs);

    // UI Güncelle
    const lenEl = document.getElementById('bom-total-length');
    if (lenEl) lenEl.innerText = `${totalLength.toFixed(2)} m`;

    const turnsEl = document.getElementById('bom-turns-count');
    if (turnsEl) turnsEl.innerText = `${turns.length} Adet`;

    const motorsEl = document.getElementById('bom-motors-count');
    if (motorsEl) motorsEl.innerText = `1 Adet`;

    const costEl = document.getElementById('bom-est-cost');
    if (costEl) costEl.innerText = `~${totalEstCost.toLocaleString('tr-TR')} €`;

    // Tablo Satırlarını Oluştur
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
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>⚡</span> Tahrik Ünitesi (Motorlu Başlık)</td>
                <td class="py-2 px-3 text-cyan-400">XHEB 0 / XHEJ</td>
                <td class="py-2 px-3 text-gray-400">0.37 kW Motor & Sonsuz Redüktörlü</td>
                <td class="py-2 px-3 text-right text-emerald-400 font-bold">1 Adet</td>
            </tr>
            <tr class="hover:bg-zinc-800/50">
                <td class="py-2 px-3 font-medium text-white flex items-center gap-1.5"><span>🔄</span> Avare Dönüş Başlığı (Idler End)</td>
                <td class="py-2 px-3 text-cyan-400">XKEJ 160 / 200</td>
                <td class="py-2 px-3 text-gray-400">Rulmanlı, Yay Gergi Mekanizmalı</td>
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
 * 2. Polyline'dan 3D Konveyör Modellerini Sahneye İnşa Et
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
    const drivePosSelect = document.getElementById('builder-drive-pos');

    const assemblyName = assyNameInput ? assyNameInput.value.trim() || 'Conveyor_New' : 'Conveyor_New';
    const platformType = platformSelect ? platformSelect.value : 'XH';
    const bendRadiusMM = radiusSelect ? parseInt(radiusSelect.value, 10) || 700 : 700;
    const topOfChainMM = tocInput ? parseFloat(tocInput.value) || 850 : 850;
    const drivePosition = drivePosSelect ? drivePosSelect.value : 'head';

    if (typeof showNotice === 'function') {
        showNotice(`⏳ "${assemblyName}" konveyör hattı 3D sahnede inşa ediliyor...`);
    }

    // Modal'ı kapat
    if (typeof window.closeConveyorBuilderModal === 'function') {
        window.closeConveyorBuilderModal();
    }

    // Parça listesi oluştur
    const products = generateConveyorProductsFromPath(pathData, {
        assemblyName,
        platformType,
        bendRadiusMM,
        topOfChainMM,
        drivePosition
    });

    if (!products || products.length === 0) {
        if (typeof showNotice === 'function') {
            showNotice('❌ Konveyör parçaları türetilemedi.');
        }
        return;
    }

    // importedProject yapısına ekle
    if (!Array.isArray(importedProject)) {
        importedProject = [];
    }

    const newAssembly = {
        name: assemblyName,
        assemblyName: assemblyName,
        products: products
    };
    importedProject.push(newAssembly);

    // 3D Three.js Group oluştur
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

    // Ürün ağacını yeniden kur
    if (typeof rebuildModelTreeFromScene === 'function') {
        rebuildModelTreeFromScene();
    }

    // Canlı konveyör yolunu güncelle
    if (typeof generateAllConveyorPathways === 'function') {
        setTimeout(() => { generateAllConveyorPathways(); }, 300);
    }

    if (typeof showNotice === 'function') {
        showNotice(`🚀 "${assemblyName}" konveyör hattı ${pathData.totalLength.toFixed(1)}m uzunluğunda başarıyla inşa edildi! Ürün ağacından inceleyebilirsiniz.`);
    }
}

/**
 * 3. Polyline Geometrisinden Sıralı Ürün Listesi (Products) Türet
 */
function generateConveyorProductsFromPath(pathData, config) {
    const products = [];
    const nodes = pathData.nodes;
    const segments = pathData.segments;
    const turns = pathData.turns;
    const elevationZ = (config.topOfChainMM / 1000);

    let seq = 0;

    // Başlangıç Motoru / Tahrik Ünitesi
    if (config.drivePosition === 'head') {
        const startNode = nodes[0];
        const firstSeg = segments[0];
        const angleZ = Math.atan2(firstSeg.direction.y, firstSeg.direction.x);

        products.push({
            guid: `conv-head-${Date.now()}-${seq}`,
            name: `${config.platformType}EB Head Drive`,
            type: 'XHEB',
            group: 'Motors',
            assemblyName: config.assemblyName,
            sequence: seq++,
            topOfChain: config.topOfChainMM,
            bracketHeight: 100,
            platformType: config.platformType,
            position: { x: startNode.x, y: startNode.y, z: elevationZ },
            rotation: { x: 0, y: 0, z: angleZ },
            customAttributes: { motorKw: 0.37, gearRatio: '1:30' }
        });
    }

    // Segmentler ve Virajlar
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const angleZ = Math.atan2(seg.direction.y, seg.direction.x);

        // Düz hat parçası (SE01)
        products.push({
            guid: `conv-seg-${Date.now()}-${seq}`,
            name: `Straight Beam L:${seg.length.toFixed(1)}m`,
            type: 'SE01',
            group: 'StraightBeams',
            assemblyName: config.assemblyName,
            sequence: seq++,
            length: seg.length * 1000, // mm
            topOfChain: config.topOfChainMM,
            platformType: config.platformType,
            position: { x: seg.from.x, y: seg.from.y, z: elevationZ },
            rotation: { x: 0, y: 0, z: angleZ },
            customAttributes: {}
        });

        // Eğer bu segmentin sonunda viraj varsa
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

    // Bitiş Avare Dönüş Ünitesi
    const lastNode = nodes[nodes.length - 1];
    const lastSeg = segments[segments.length - 1];
    const lastAngleZ = Math.atan2(lastSeg.direction.y, lastSeg.direction.x);

    products.push({
        guid: `conv-tail-${Date.now()}-${seq}`,
        name: `${config.platformType}EJ Idler End`,
        type: 'XKEJ',
        group: 'IdlerEnds',
        assemblyName: config.assemblyName,
        sequence: seq++,
        topOfChain: config.topOfChainMM,
        bracketHeight: 100,
        platformType: config.platformType,
        position: { x: lastNode.x, y: lastNode.y, z: elevationZ },
        rotation: { x: 0, y: 0, z: lastAngleZ },
        customAttributes: {}
    });

    return products;
}

// Global Exports
if (typeof window !== 'undefined') {
    window.calculateAndRenderConveyorBOM = calculateAndRenderConveyorBOM;
    window.executeConveyorBuild = executeConveyorBuild;
}
