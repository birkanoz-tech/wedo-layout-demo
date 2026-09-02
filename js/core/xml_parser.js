/**
 * ProposalApp - XML & 3D Model Parser Core Module
 * Handles FlexLink XML project parsing, product tree construction, and 3D mesh building.
 */

import { scene } from './scene_engine.js';
import { showNotice } from '../utils/notice_system.js';

export let currentRawXmlText = '';
export let currentXmlFilename = 'OPP-0106989-1-R1.xml';
export let importedProjectRoot = null;
export let addedPanels = [];
export let addedManualModels = [];

export function parseXmlProject(xmlText) {
    if (!xmlText) return [];
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const assemblies = Array.from(xmlDoc.getElementsByTagName('assembly'));
        
        return assemblies.map((assy, assyIdx) => {
            const name = assy.getAttribute('name') || `Montaj ${assyIdx + 1}`;
            const products = Array.from(assy.getElementsByTagName('product')).map((prod, prodIdx) => {
                const getChildText = (tagName) => {
                    const el = prod.getElementsByTagName(tagName)[0];
                    return el ? el.textContent.trim() : '';
                };
                const posNode = prod.getElementsByTagName('position')[0];
                const rotNode = prod.getElementsByTagName('rotation')[0];
                
                return {
                    name: getChildText('name') || `Ürün ${prodIdx + 1}`,
                    type: getChildText('type') || 'conveyor',
                    group: getChildText('group') || name,
                    assemblyName: name,
                    sequence: prodIdx,
                    guid: getChildText('guid') || '',
                    position: posNode ? {
                        x: parseFloat(posNode.getAttribute('px') || 0) / 1000,
                        y: parseFloat(posNode.getAttribute('py') || 0) / 1000,
                        z: parseFloat(posNode.getAttribute('pz') || 0) / 1000
                    } : { x: 0, y: 0, z: 0 },
                    rotation: rotNode ? {
                        qx: parseFloat(rotNode.getAttribute('qx') || 0),
                        qy: parseFloat(rotNode.getAttribute('qy') || 0),
                        qz: parseFloat(rotNode.getAttribute('qz') || 0),
                        qw: parseFloat(rotNode.getAttribute('qw') || 1)
                    } : null
                };
            });
            return { name, products };
        });
    } catch (err) {
        console.error("XML parse hatası:", err);
        return [];
    }
}

export function resetSceneContent() {
    if (importedProjectRoot && importedProjectRoot.parent) {
        importedProjectRoot.parent.remove(importedProjectRoot);
    }
    if (typeof THREE !== 'undefined') {
        importedProjectRoot = new THREE.Group();
        importedProjectRoot.name = "Imported_Project_Root";
        if (scene) {
            scene.add(importedProjectRoot);
        }
    }
    addedPanels = [];
    addedManualModels = [];
}

if (typeof window !== 'undefined') {
    window.parseXmlProject = parseXmlProject;
    window.resetSceneContent = resetSceneContent;
}
