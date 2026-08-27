/**
 * ProposalApp - Notice System & Toast UI Manager
 * Handles user notifications, success toasts, and status notices.
 */

export function showNotice(message, duration = 3000) {
    if (!message) return;
    
    let noticeContainer = document.getElementById('app-notice-container');
    if (!noticeContainer) {
        noticeContainer = document.createElement('div');
        noticeContainer.id = 'app-notice-container';
        noticeContainer.setAttribute('style', 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;');
        document.body.appendChild(noticeContainer);
    }

    const toast = document.createElement('div');
    toast.setAttribute('style', 'background-color: #0f172a; color: #38bdf8; border: 1px solid #06b6d4; border-radius: 8px; padding: 10px 16px; font-size: 11px; font-weight: 600; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.8); pointer-events: auto; opacity: 0; transition: all 0.3s ease; transform: translateY(10px);');
    toast.innerHTML = `<span>⚡ ${message}</span>`;
    
    noticeContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

if (typeof window !== 'undefined') {
    window.showNotice = showNotice;
}
