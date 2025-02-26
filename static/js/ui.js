/**
 * UI interactions for Story Translator
 * Handles form toggles and result display
 */

class UI {
    constructor() {
        // Elements
        this.textInputContainer = document.getElementById('text-input-container');
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
        this.copyResultBtn.addEventListener('click', this.copyResult.bind(this));
        this.toggleViewBtn.addEventListener('click', this.toggleResultView.bind(this));
        this.inputText.addEventListener('input', this.updateWordCount.bind(this));
        
        // Load available languages
        this.loadLanguages();
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
            
            // Add Spanish as the first option
            if (languages.spanish) {
                const spanishOption = document.createElement('option');
                spanishOption.value = 'spanish';
                spanishOption.textContent = languages.spanish;
                spanishOption.selected = true;
                this.targetLanguageSelect.appendChild(spanishOption);
            }
            
            // Add the rest of the languages (excluding Spanish which was already added)
            Object.entries(languages).forEach(([code, name]) => {
                if (code !== 'spanish') {
                    const option = document.createElement('option');
                    option.value = code;
                    option.textContent = name;
                    this.targetLanguageSelect.appendChild(option);
                }
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