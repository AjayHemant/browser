// History Manager Module
const HistoryManager = {
    modal: null,
    historyList: null,
    searchInput: null,
    clearBtn: null,
    closeBtn: null,
    allHistory: [],

    init() {
        this.modal = document.getElementById('history-modal');
        this.historyList = document.getElementById('history-list');
        this.searchInput = document.getElementById('history-search');
        this.clearBtn = document.getElementById('clear-history-btn');
        this.closeBtn = document.getElementById('close-history');

        this.setupEventListeners();
    },

    setupEventListeners() {
        // Close modal
        this.closeBtn.addEventListener('click', () => this.close());

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Search history
        this.searchInput.addEventListener('input', (e) => {
            this.filterHistory(e.target.value);
        });

        // Clear all history
        this.clearBtn.addEventListener('click', () => this.clearAllHistory());
    },

    async open() {
        this.modal.style.display = 'block';
        await this.loadHistory();
    },

    close() {
        this.modal.style.display = 'none';
        this.searchInput.value = '';
    },

    async loadHistory() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/history', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }

            this.allHistory = await response.json();
            this.renderHistory(this.allHistory);
        } catch (error) {
            console.error('Error loading history:', error);
            this.historyList.innerHTML = `
                <div class="empty-state">
                    <p>Failed to load history</p>
                </div>
            `;
        }
    },

    renderHistory(historyItems) {
        if (!historyItems || historyItems.length === 0) {
            this.historyList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <p>No browsing history</p>
                </div>
            `;
            return;
        }

        // Group by date
        const grouped = this.groupByDate(historyItems);

        let html = '';
        for (const [date, items] of Object.entries(grouped)) {
            html += `
                <div class="history-date-group">
                    <h3 class="history-date">${date}</h3>
                    <div class="history-items">
            `;

            for (const item of items) {
                const time = new Date(item.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const icon = item.type === 'search' ? '🔍' : '🌐';
                const displayText = this.truncate(item.url, 80);

                html += `
                    <div class="history-item" data-id="${item.id}">
                        <div class="history-icon">${icon}</div>
                        <div class="history-content">
                            <div class="history-url" title="${this.escapeHtml(item.url)}">${this.escapeHtml(displayText)}</div>
                            <div class="history-time">${time}</div>
                        </div>
                        <button class="history-delete" data-id="${item.id}" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        }

        this.historyList.innerHTML = html;

        // Add click handlers for history items
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.history-delete')) {
                    const url = item.querySelector('.history-url').getAttribute('title');
                    this.openUrl(url);
                }
            });
        });

        // Add delete handlers
        this.historyList.querySelectorAll('.history-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.deleteHistoryItem(id);
            });
        });
    },

    groupByDate(items) {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        for (const item of items) {
            const itemDate = new Date(item.timestamp);
            let dateLabel;

            if (this.isSameDay(itemDate, today)) {
                dateLabel = 'Today';
            } else if (this.isSameDay(itemDate, yesterday)) {
                dateLabel = 'Yesterday';
            } else {
                dateLabel = itemDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
            }

            if (!groups[dateLabel]) {
                groups[dateLabel] = [];
            }
            groups[dateLabel].push(item);
        }

        return groups;
    },

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    },

    filterHistory(query) {
        if (!query.trim()) {
            this.renderHistory(this.allHistory);
            return;
        }

        const filtered = this.allHistory.filter(item =>
            item.url.toLowerCase().includes(query.toLowerCase())
        );

        this.renderHistory(filtered);
    },

    async deleteHistoryItem(id) {
        if (!confirm('Delete this history item?')) {
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/history/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to delete history item');
            }

            // Remove from local array
            this.allHistory = this.allHistory.filter(item => item.id !== id);
            this.renderHistory(this.allHistory);

            if (typeof showToast === 'function') {
                showToast('History item deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting history item:', error);
            if (typeof showToast === 'function') {
                showToast('Failed to delete history item', 'error');
            }
        }
    },

    async clearAllHistory() {
        if (!confirm('Clear all browsing history? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5000/api/history', {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to clear history');
            }

            this.allHistory = [];
            this.renderHistory([]);

            if (typeof showToast === 'function') {
                showToast('History cleared', 'success');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            if (typeof showToast === 'function') {
                showToast('Failed to clear history', 'error');
            }
        }
    },

    openUrl(url) {
        // Close the modal
        this.close();

        // Navigate to the URL in the active tab
        const tab = getActiveTab();
        if (tab) {
            tab.loadUrl(url);
        }
    },

    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HistoryManager.init());
} else {
    HistoryManager.init();
}

// Export for use in other modules
window.historyManager = HistoryManager;
