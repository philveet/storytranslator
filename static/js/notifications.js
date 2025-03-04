class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }
    
    init() {
        // Create notification container if it doesn't exist
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
            
            // Add styles directly to ensure they're available
            const style = document.createElement('style');
            style.textContent = `
                .notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 300px;
                }
                
                .notification {
                    padding: 15px;
                    border-radius: 4px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    color: var(--text-color);
                    opacity: 0;
                    transform: translateX(50px);
                    transition: opacity 0.3s, transform 0.3s;
                    position: relative;
                }
                
                .notification.show {
                    opacity: 1;
                    transform: translateX(0);
                }
                
                .notification.error {
                    background-color: var(--error-color);
                }
                
                .notification.success {
                    background-color: var(--success-color);
                }
                
                .notification.warning {
                    background-color: var(--warning-color);
                    color: #333;
                }
                
                .notification.info {
                    background-color: var(--primary-color);
                }
                
                .notification-close {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    font-size: 16px;
                    opacity: 0.7;
                }
                
                .notification-close:hover {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Show a notification
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (info, success, warning, error)
     * @param {number} duration - How long to show the notification in ms
     */
    show(message, type = 'info', duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            ${message}
            <button class="notification-close">&times;</button>
        `;
        
        // Add to container
        this.container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Add close button handler
        const closeButton = notification.querySelector('.notification-close');
        closeButton.addEventListener('click', () => {
            this.hide(notification);
        });
        
        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hide(notification);
            }, duration);
        }
        
        return notification;
    }
    
    /**
     * Hide a notification
     * @param {HTMLElement} notification - The notification element to hide
     */
    hide(notification) {
        notification.classList.remove('show');
        
        // Remove after animation completes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

// Create global instance
window.notifications = new NotificationManager(); 