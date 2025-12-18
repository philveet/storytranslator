/**
 * Authentication handling for Story Translator
 * 
 * NOTE: Authentication is currently DISABLED for BYOK (Bring Your Own Key) model.
 * Users provide their own OpenAI API key, so no server-side auth is needed.
 * This code is preserved and can be re-enabled by:
 * 1. Setting AUTH_ENABLED = true below
 * 2. Uncommenting @require_auth decorator in app.py
 * 3. Removing 'hidden' class from auth-section in index.html
 * 4. Adding 'hidden' class to app-section in index.html
 */

const AUTH_ENABLED = false;  // Set to true to re-enable authentication

class Auth {
    constructor() {
        this.isAuthenticated = false;
        this.loginForm = document.getElementById('login-form');
        this.authSection = document.getElementById('auth-section');
        this.appSection = document.getElementById('app-section');
        this.authMessage = document.getElementById('auth-message');
        this.logoutBtn = document.getElementById('logout-btn');

        this.init();
    }

    init() {
        // BYOK mode: Skip authentication entirely
        if (!AUTH_ENABLED) {
            this.isAuthenticated = true;
            this.showApp();
            return;
        }
        
        // Check if already authenticated
        this.checkAuthStatus();

        // Set up event listeners
        this.loginForm.addEventListener('submit', this.handleLogin.bind(this));
        this.logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/check-auth');
            const data = await response.json();

            if (data.authenticated) {
                this.isAuthenticated = true;
                this.showApp();
            } else {
                this.isAuthenticated = false;
                this.showAuth();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showMessage('Error checking authentication status', 'error');
            this.isAuthenticated = false;
            this.showAuth();
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            this.showMessage('Please enter both username and password', 'error');
            return;
        }
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.isAuthenticated = true;
                this.showApp();
                this.loginForm.reset();
            } else {
                this.showMessage(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.showMessage('Error connecting to the server', 'error');
        }
    }

    async handleLogout() {
        try {
            await fetch('/logout', {
                method: 'POST'
            });
            
            this.isAuthenticated = false;
            this.showAuth();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    showApp() {
        this.authSection.classList.add('hidden');
        this.appSection.classList.remove('hidden');
    }

    showAuth() {
        this.authSection.classList.remove('hidden');
        this.appSection.classList.add('hidden');
    }

    showMessage(message, type = 'info') {
        this.authMessage.textContent = message;
        this.authMessage.className = 'message';
        this.authMessage.classList.add(type);
        
        // Clear message after 5 seconds
        setTimeout(() => {
            this.authMessage.textContent = '';
            this.authMessage.className = 'message';
        }, 5000);
    }
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    window.auth = new Auth();
}); 