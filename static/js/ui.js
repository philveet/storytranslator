/**
 * UI interactions for Story Translator
 * Handles form toggles, theme switching, and result display
 */

class UI {
    constructor() {
        // Elements
        this.themeSwitch = document.getElementById('theme-switch');
        this.inputToggles = document.querySelectorAll('.input-toggle .btn');
        this.textInputContainer = document.getElementById('text-input-container');
        this.fileInputContainer = document.getElementById('file-input-container');
        this.copyResultBtn = document.getElementById('copy-result');
        this.toggleViewBtn = document.getElementById('toggle-view');
        this.singleView = document.getElementById('single-view');
        this.sideBySideView = document.getElementById('side-by-side-view');
        this.inputText = document.getElementById('input-text');
        this.wordCount = document.getElementById('word-count');
        this.targetLanguageSelect = document.getElementById('target-language');
        
        this.init();
    }

    /**
     * Initialize UI components
     */
    init() {
        // Set up event listeners
        this.themeSwitch.addEventListener('change', this.toggleTheme.bind(this));
        this.inputToggles.forEach(toggle => {
            toggle.addEventListener('click', this.toggleInputMethod.bind(this));
        });
        this.copyResultBtn.addEventListener('click', this.copyResult.bind(this));
        this.toggleViewBtn.addEventListener('click', this.toggleResultView.bind(this));
        this.inputText.addEventListener('input', this.updateWordCount.bind(this));
        
        // Load available languages
        this.loadLanguages();
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        // As our theme is already dark, we would implement light theme here
        // For now, we'll just keep it as is
    }

    /**
     * Toggle between text and file input methods
     * @param {Event} event - The click event
     */
    toggleInputMethod(event) {
        const inputType = event.target.dataset.input;
        
        // Update active toggle button
        this.inputToggles.forEach(toggle => {
            toggle.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Show/hide input containers
        if (inputType === 'text') {
            this.textInputContainer.classList.remove('hidden');
            this.fileInputContainer.classList.add('hidden');
        } else {
            this.textInputContainer.classList.add('hidden');
            this.fileInputContainer.classList.remove('hidden');
        }
    }

    /**
     * Copy translation result to clipboard
     */
    copyResult() {
        const text = document.getElementById('translated-text').textContent;
        
        if (!text) {
            alert('No translation to copy');
            return;
        }
        
        // Use clipboard API
        navigator.clipboard.writeText(text)
            .then(() => {
                // Show success message temporarily
                const originalText = this.copyResultBtn.textContent;
                this.copyResultBtn.textContent = 'Copied!';
                
                setTimeout(() => {
                    this.copyResultBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy text. Please try again.');
            });
    }

    /**
     * Toggle between single and side-by-side result views
     */
    toggleResultView() {
        const isSideBySide = this.singleView.classList.contains('hidden');
        
        if (isSideBySide) {
            this.singleView.classList.remove('hidden');
            this.sideBySideView.classList.add('hidden');
            this.toggleViewBtn.textContent = 'Side by Side View';
        } else {
            this.singleView.classList.add('hidden');
            this.sideBySideView.classList.remove('hidden');
            this.toggleViewBtn.textContent = 'Single View';
        }
    }

    /**
     * Update word count for textarea input
     */
    updateWordCount() {
        const text = this.inputText.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        this.wordCount.textContent = words.toString();
        
        // Add warning class if too many words
        if (words > 50000) {
            this.wordCount.classList.add('warning');
        } else {
            this.wordCount.classList.remove('warning');
        }
    }

    /**
     * Load available languages from the server
     */
    async loadLanguages() {
        try {
            const response = await fetch('/languages');
            const languages = await response.json();
            
            // Clear existing options
            this.targetLanguageSelect.innerHTML = '';
            
            // Add options for each language
            Object.entries(languages).forEach(([code, name]) => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = name;
                this.targetLanguageSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load languages:', error);
        }
    }
}

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
}); 