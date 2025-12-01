// Downloads Manager Module
const DownloadsManager = {
    modal: null,
    downloadsList: null,
    searchInput: null,
    clearBtn: null,
    closeBtn: null,
    allDownloads: [],

    init() {
        this.modal = document.getElementById('downloads-modal');
        this.downloadsList = document.getElementById('downloads-list');
        this.searchInput = document.getElementById('downloads-search');
        this.clearBtn = document.getElementById('clear-downloads-btn');
        this.closeBtn = document.getElementById('close-downloads');

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

        // Search downloads
        this.searchInput.addEventListener('input', (e) => {
            this.filterDownloads(e.target.value);
        });

        // Clear all downloads
        this.clearBtn.addEventListener('click', () => this.clearAllDownloads());

        // Listen for new downloads from Electron
        if (window.electronAPI && window.electronAPI.onDownloadCompleted) {
            window.electronAPI.onDownloadCompleted((event, downloadInfo) => {
                this.recordDownload(downloadInfo);
            });
        }
    },

    async recordDownload(downloadInfo) {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/downloads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(downloadInfo)
            });

            if (response.ok) {
                // Refresh list if modal is open
                if (this.modal.style.display === 'block') {
                    this.loadDownloads();
                }
                if (typeof showToast === 'function') {
                    showToast('Download completed', 'success');
                }
            }
        } catch (error) {
            console.error('Error recording download:', error);
        }
    },

    async open() {
        this.modal.style.display = 'block';
        await this.loadDownloads();
    },

    close() {
        this.modal.style.display = 'none';
        this.searchInput.value = '';
    },

    async loadDownloads() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/downloads', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch downloads');
            }

            this.allDownloads = await response.json();
            this.renderDownloads(this.allDownloads);
        } catch (error) {
            console.error('Error loading downloads:', error);
            this.downloadsList.innerHTML = `
                <div class="empty-state">
                    <p>Failed to load downloads</p>
                </div>
            `;
        }
    },

    renderDownloads(downloads) {
        if (!downloads || downloads.length === 0) {
            this.downloadsList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <p>No downloads yet</p>
                </div>
            `;
            return;
        }

        // Group by date
        const grouped = this.groupByDate(downloads);

        let html = '';
        for (const [date, items] of Object.entries(grouped)) {
            html += `
                <div class="downloads-date-group">
                    <h3 class="downloads-date">${date}</h3>
                    <div class="downloads-items">
            `;

            for (const item of items) {
                const time = new Date(item.download_date).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const fileIcon = this.getFileIcon(item.filename, item.mime_type);
                const fileSize = this.formatFileSize(item.file_size);

                html += `
                    <div class="download-item" data-id="${item.id}">
                        <div class="download-icon">${fileIcon}</div>
                        <div class="download-content">
                            <div class="download-filename" title="${this.escapeHtml(item.filename)}">${this.escapeHtml(item.filename)}</div>
                            <div class="download-meta">
                                <span class="download-size">${fileSize}</span>
                                ${item.source_url ? `<span class="download-source" title="${this.escapeHtml(item.source_url)}">from ${this.getDomain(item.source_url)}</span>` : ''}
                                <span class="download-time">${time}</span>
                            </div>
                        </div>
                        <div class="download-actions">
                            <button class="download-action-btn" data-path="${this.escapeHtml(item.file_path)}" title="Open file location">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </button>
                            <button class="download-delete" data-id="${item.id}" title="Remove from list">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        }

        this.downloadsList.innerHTML = html;

        // Add click handlers for open folder
        this.downloadsList.querySelectorAll('.download-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = btn.dataset.path;
                this.openFileLocation(path);
            });
        });

        // Add delete handlers
        this.downloadsList.querySelectorAll('.download-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                this.deleteDownload(id);
            });
        });
    },

    groupByDate(items) {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        for (const item of items) {
            const itemDate = new Date(item.download_date);
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

    filterDownloads(query) {
        if (!query.trim()) {
            this.renderDownloads(this.allDownloads);
            return;
        }

        const filtered = this.allDownloads.filter(item =>
            item.filename.toLowerCase().includes(query.toLowerCase()) ||
            (item.source_url && item.source_url.toLowerCase().includes(query.toLowerCase()))
        );

        this.renderDownloads(filtered);
    },

    async deleteDownload(id) {
        if (!confirm('Remove this download from the list?')) {
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/downloads/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to delete download');
            }

            // Remove from local array
            this.allDownloads = this.allDownloads.filter(item => item.id !== id);
            this.renderDownloads(this.allDownloads);

            if (typeof showToast === 'function') {
                showToast('Download removed from list', 'success');
            }
        } catch (error) {
            console.error('Error deleting download:', error);
            if (typeof showToast === 'function') {
                showToast('Failed to remove download', 'error');
            }
        }
    },

    async clearAllDownloads() {
        if (!confirm('Clear all downloads from the list? This will not delete the actual files.')) {
            return;
        }

        try {
            const response = await fetch('http://127.0.0.1:5000/api/downloads', {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to clear downloads');
            }

            this.allDownloads = [];
            this.renderDownloads([]);

            if (typeof showToast === 'function') {
                showToast('Downloads list cleared', 'success');
            }
        } catch (error) {
            console.error('Error clearing downloads:', error);
            if (typeof showToast === 'function') {
                showToast('Failed to clear downloads', 'error');
            }
        }
    },

    openFileLocation(path) {
        // This would require Electron API to open file location
        if (window.electronAPI && window.electronAPI.showItemInFolder) {
            window.electronAPI.showItemInFolder(path);
        } else {
            if (typeof showToast === 'function') {
                showToast('File location: ' + path, 'info');
            }
        }
    },

    getFileIcon(filename, mimeType) {
        const ext = filename.split('.').pop().toLowerCase();

        // Document types
        if (['pdf'].includes(ext)) return '📄';
        if (['doc', 'docx'].includes(ext)) return '📝';
        if (['xls', 'xlsx'].includes(ext)) return '📊';
        if (['ppt', 'pptx'].includes(ext)) return '📽️';

        // Image types
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';

        // Video types
        if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return '🎥';

        // Audio types
        if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '🎵';

        // Archive types
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';

        // Code types
        if (['js', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return '💻';

        // Default
        return '📁';
    },

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'Unknown size';

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    },

    getDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return url;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DownloadsManager.init());
} else {
    DownloadsManager.init();
}

// Export for use in other modules
window.downloadsManager = DownloadsManager;
