// adblocker-manager.js

(function () {
    'use strict';

    let adBlockerEnabled = true;
    let blockedCount = 0;
    let updateInterval = null;

    // DOM Elements
    const toggle = document.getElementById('adblocker-toggle');
    const badge = document.getElementById('adblocker-badge');

    // Initialize
    async function init() {
        if (!window.electronAPI || !window.electronAPI.adBlockerStats) {
            console.warn('Ad-blocker API not available');
            return;
        }

        // Load initial state
        await updateStats();

        // Set up toggle listener
        if (toggle) {
            toggle.addEventListener('change', handleToggle);
        }

        // Update stats every 2 seconds
        updateInterval = setInterval(updateStats, 2000);

        console.log('Ad-blocker manager initialized');
    }

    // Update statistics from main process
    async function updateStats() {
        try {
            const stats = await window.electronAPI.adBlockerStats();

            if (stats) {
                adBlockerEnabled = stats.enabled;
                blockedCount = stats.blockedCount;

                // Update UI
                if (toggle) {
                    toggle.checked = adBlockerEnabled;
                }

                if (badge) {
                    badge.textContent = formatCount(blockedCount);

                    // Add visual feedback when count increases
                    if (blockedCount > 0) {
                        badge.style.display = 'inline-block';
                    }
                }
            }
        } catch (error) {
            console.error('Error updating ad-blocker stats:', error);
        }
    }

    // Handle toggle switch
    async function handleToggle(e) {
        const enabled = e.target.checked;

        try {
            const result = await window.electronAPI.adBlockerToggle(enabled);

            if (result.success) {
                adBlockerEnabled = result.enabled;

                // Show toast notification
                showToast(
                    enabled ? 'Ad-Blocker Enabled' : 'Ad-Blocker Disabled',
                    enabled ? 'success' : 'info'
                );

                // Reset count when toggling
                if (enabled) {
                    await window.electronAPI.adBlockerResetCount();
                    blockedCount = 0;
                    if (badge) {
                        badge.textContent = '0';
                    }
                }
            } else {
                // Revert toggle if failed
                e.target.checked = !enabled;
                showToast('Failed to toggle ad-blocker', 'error');
            }
        } catch (error) {
            console.error('Error toggling ad-blocker:', error);
            e.target.checked = !enabled;
            showToast('Error toggling ad-blocker', 'error');
        }
    }

    // Format count for display
    function formatCount(count) {
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'k';
        }
        return count.toString();
    }

    // Show toast notification
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `
            <span style="font-size: 18px;">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

    // Expose API for debugging
    window.adBlockerManager = {
        getStats: () => ({ enabled: adBlockerEnabled, blockedCount }),
        updateStats,
        resetCount: async () => {
            await window.electronAPI.adBlockerResetCount();
            blockedCount = 0;
            if (badge) badge.textContent = '0';
        }
    };
})();
