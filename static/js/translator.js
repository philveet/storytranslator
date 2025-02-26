/**
 * Translation coordinator for Story Translator
 * Handles the translation process by chunking text, making API calls,
 * and assembling the results
 */

class Translator {
    constructor() {
        this.chunker = new TextChunker();
        this.chunks = [];
        this.results = [];
        this.originalText = '';
        this.targetLanguage = '';
        this.isTranslating = false;
        this.abortController = null;
        this.context = '';
        
        // Elements
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.chunkInfo = document.getElementById('chunk-info');
        this.progressContainer = document.getElementById('progress-container');
        this.resultsContainer = document.getElementById('results-container');
        this.translatedText = document.getElementById('translated-text');
        this.translatedTextSide = document.getElementById('translated-text-side');
        this.originalTextDisplay = document.getElementById('original-text');
        this.qualityIndicator = document.getElementById('quality-indicator');
        
        // Event listeners
        document.getElementById('translation-form').addEventListener('submit', this.handleTranslation.bind(this));
    }

    /**
     * Handle translation form submission
     * @param {Event} event - The form submission event
     */
    async handleTranslation(event) {
        event.preventDefault();
        
        // Get form data
        const form = event.target;
        this.targetLanguage = form.elements['target-language'].value;
        
        // Get text input based on input method
        const activeInput = document.querySelector('.input-toggle .active').dataset.input;
        
        if (activeInput === 'text') {
            this.originalText = document.getElementById('input-text').value.trim();
            if (!this.originalText) {
                this.showMessage('Please enter some text to translate', 'error');
                return;
            }
        } else {
            const fileInput = document.getElementById('input-file');
            if (!fileInput.files || !fileInput.files[0]) {
                this.showMessage('Please select a file to translate', 'error');
                return;
            }
            
            try {
                this.originalText = await this.readFile(fileInput.files[0]);
            } catch (error) {
                this.showMessage('Error reading file: ' + error.message, 'error');
                return;
            }
        }
        
        // Check text length
        const wordCount = this.originalText.split(/\s+/).length;
        if (wordCount > 50000) {
            this.showMessage(`Text is too long (${wordCount} words). Maximum is 50,000 words.`, 'error');
            return;
        }
        
        // Start translation process
        this.startTranslation();
    }

    /**
     * Read a text file
     * @param {File} file - The file to read
     * @returns {Promise<string>} - The file contents
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(event) {
                resolve(event.target.result);
            };
            
            reader.onerror = function(error) {
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Show a message to the user
     * @param {string} message - The message to show
     * @param {string} type - The message type (info, error, success, warning)
     */
    showMessage(message, type = 'info') {
        // For simplicity, we'll use alert here
        // In production, you'd use a proper UI element
        alert(`${type.toUpperCase()}: ${message}`);
    }

    /**
     * Start the translation process
     */
    async startTranslation() {
        if (this.isTranslating) {
            this.showMessage('Translation already in progress', 'warning');
            return;
        }
        
        this.isTranslating = true;
        this.abortController = new AbortController();
        
        // Reset state
        this.chunks = [];
        this.results = [];
        this.context = '';
        
        // Show progress container
        this.progressContainer.classList.remove('hidden');
        this.resultsContainer.classList.add('hidden');
        this.updateProgress(0);
        
        try {
            // Split text into chunks
            this.chunks = this.chunker.splitIntoChunks(this.originalText);
            
            if (this.chunks.length === 0) {
                throw new Error('Failed to split text into chunks');
            }
            
            this.chunkInfo.textContent = `Processing chunk 0 of ${this.chunks.length}`;
            
            // Process chunks in sequence
            for (let i = 0; i < this.chunks.length; i++) {
                // Check if operation was aborted
                if (this.abortController.signal.aborted) {
                    throw new Error('Translation aborted');
                }
                
                const chunk = this.chunks[i];
                this.chunkInfo.textContent = `Processing chunk ${i + 1} of ${this.chunks.length}`;
                
                // Try to translate chunk with retries
                const translatedChunk = await this.translateChunkWithRetry(chunk);
                
                // Add to results
                this.results.push(translatedChunk);
                
                // Extract context for next chunk
                this.context = this.chunker.extractContext(translatedChunk.translated_text);
                
                // Update progress
                this.updateProgress((i + 1) / this.chunks.length * 100);
            }
            
            // Assemble and display results
            this.assembleResults();
            
        } catch (error) {
            if (error.message !== 'Translation aborted') {
                this.showMessage(`Translation error: ${error.message}`, 'error');
                console.error('Translation error:', error);
            }
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * Translate a single chunk with retry logic
     * @param {Object} chunk - The chunk to translate
     * @returns {Promise<Object>} - The translation result
     */
    async translateChunkWithRetry(chunk, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            return await this.translateChunk(chunk);
        } catch (error) {
            if (retryCount < maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                this.showMessage(`Retrying chunk ${chunk.index + 1}...`, 'warning');
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.translateChunkWithRetry(chunk, retryCount + 1);
            } else {
                throw new Error(`Failed to translate chunk ${chunk.index + 1} after ${maxRetries} retries`);
            }
        }
    }

    /**
     * Translate a single chunk
     * @param {Object} chunk - The chunk to translate
     * @returns {Promise<Object>} - The translation result
     */
    async translateChunk(chunk) {
        const response = await fetch('/translate-chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: chunk.text,
                target_language: this.targetLanguage,
                context: this.context
            }),
            signal: this.abortController.signal
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Translation failed');
        }
        
        const result = await response.json();
        return {
            ...result,
            chunk_index: chunk.index
        };
    }

    /**
     * Update the progress bar and text
     * @param {number} percent - The progress percentage
     */
    updateProgress(percent) {
        const rounded = Math.round(percent);
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${rounded}%`;
    }

    /**
     * Assemble results and display the complete translation
     */
    assembleResults() {
        // Sort results by chunk index
        this.results.sort((a, b) => a.chunk_index - b.chunk_index);
        
        // Combine all translated text
        const translatedText = this.results.map(result => result.translated_text).join(' ');
        
        // Display results
        this.translatedText.textContent = translatedText;
        this.translatedTextSide.textContent = translatedText;
        this.originalTextDisplay.textContent = this.originalText;
        
        // Check quality
        this.checkQuality();
        
        // Show results container
        this.progressContainer.classList.add('hidden');
        this.resultsContainer.classList.remove('hidden');
    }

    /**
     * Check translation quality
     */
    checkQuality() {
        // Calculate original and translated word counts
        const originalWords = this.originalText.split(/\s+/).length;
        const translatedWords = this.results.reduce((total, result) => total + result.translated_length, 0);
        
        // Calculate the word count ratio
        const ratio = translatedWords / originalWords;
        
        let qualityStatus = '';
        
        // Thresholds for quality assessment
        if (ratio < 0.7) {
            qualityStatus = 'Warning: Translation appears to be missing content.';
            this.qualityIndicator.className = 'warning';
        } else if (ratio > 1.3) {
            qualityStatus = 'Warning: Translation appears to have additional content.';
            this.qualityIndicator.className = 'warning';
        } else {
            qualityStatus = 'Good: Word count ratio is within expected range.';
            this.qualityIndicator.className = 'success';
        }
        
        this.qualityIndicator.textContent = qualityStatus;
    }

    /**
     * Cancel the current translation
     */
    cancelTranslation() {
        if (this.isTranslating && this.abortController) {
            this.abortController.abort();
            this.isTranslating = false;
        }
    }
}

// Initialize Translator on page load
document.addEventListener('DOMContentLoaded', () => {
    window.translator = new Translator();
}); 