/**
 * ProposalApp - 3D Geometry & Snapping Helpers
 */

export function getAssemblyNameFromObject(obj) {
    if (!obj) return null;
    let curr = obj;
    while (curr) {
        if (curr.userData) {
            if (curr.userData.assemblyName) return curr.userData.assemblyName;
            if (curr.userData.product && curr.userData.product.assemblyName) return curr.userData.product.assemblyName;
            if (curr.userData.conveyorName) return curr.userData.conveyorName;
        }
        if (curr.name && (curr.name.startsWith('Conveyor_') || curr.name.startsWith('Assembly_'))) {
            return curr.name;
        }
        curr = curr.parent;
    }
    return null;
}

export function getSnappedPlacementPoint(point, snapStep = 0.5) {
    if (!point) return new THREE.Vector3();
    const step = parseFloat(snapStep) || 0.5;
    if (step <= 0) return point.clone();

    return new THREE.Vector3(
        Math.round(point.x / step) * step,
        Math.round(point.y / step) * step,
        Math.round(point.z / step) * step
    );
}

export function setSafeInnerText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}
