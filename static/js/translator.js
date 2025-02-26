/**
 * Translation coordinator for Story Translator
 * Handles the translation process by chunking text, making API calls,
 * and assembling the results
 */

class Translator {
    constructor() {
        // Configuration - moved from TextChunker for simplification
        this.maxChunkSize = 500; // words per chunk
        this.overlapSize = 50; // words to overlap between chunks
        
        // State
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
        
        // Setup logging
        this.setupLogging();
    }

    /**
     * Setup enhanced logging
     */
    setupLogging() {
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn
        };
        
        // Enhance console.error to include timestamp and better formatting
        console.error = (...args) => {
            const timestamp = new Date().toISOString();
            this.originalConsole.error(`[${timestamp}] ERROR:`, ...args);
        };
        
        // Log uncaught errors
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
        });
        
        // Log unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
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
        
        try {
            if (activeInput === 'text') {
                this.originalText = document.getElementById('input-text').value.trim();
                if (!this.originalText) {
                    throw new Error('Please enter some text to translate');
                }
            } else {
                const fileInput = document.getElementById('input-file');
                if (!fileInput.files || !fileInput.files[0]) {
                    throw new Error('Please select a file to translate');
                }
                
                this.originalText = await this.readFile(fileInput.files[0]);
            }
            
            // Check text length
            const wordCount = this.originalText.split(/\s+/).length;
            if (wordCount > 50000) {
                throw new Error(`Text is too long (${wordCount} words). Maximum is 50,000 words.`);
            }
            
            // Start translation process
            this.startTranslation();
            
        } catch (error) {
            this.showMessage(error.message, 'error');
            console.error('Preparation error:', error);
        }
    }

    /**
     * Read a text file
     * @param {File} file - The file to read
     * @returns {Promise<string>} - The file contents
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
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
            console.log('Starting translation process...');
            
            // Split text into chunks - simplified chunking logic
            this.chunks = this.splitIntoChunks(this.originalText);
            
            if (this.chunks.length === 0) {
                throw new Error('Failed to split text into chunks');
            }
            
            console.log(`Text split into ${this.chunks.length} chunks`);
            this.chunkInfo.textContent = `Processing chunk 0 of ${this.chunks.length}`;
            
            // Process chunks in sequence
            for (let i = 0; i < this.chunks.length; i++) {
                // Check if operation was aborted
                if (this.abortController.signal.aborted) {
                    throw new Error('Translation aborted');
                }
                
                const chunk = this.chunks[i];
                this.chunkInfo.textContent = `Processing chunk ${i + 1} of ${this.chunks.length}`;
                console.log(`Processing chunk ${i + 1} of ${this.chunks.length}`);
                
                // Try to translate chunk with retries
                const translatedChunk = await this.translateChunkWithRetry(chunk);
                
                // Add to results
                this.results.push(translatedChunk);
                
                // Extract context for next chunk - simplified
                this.context = this.extractContext(translatedChunk.translated_text);
                
                // Update progress
                this.updateProgress((i + 1) / this.chunks.length * 100);
            }
            
            console.log('All chunks translated successfully');
            
            // Assemble and display results
            this.assembleResults();
            
        } catch (error) {
            if (error.message !== 'Translation aborted') {
                this.showMessage(`Translation error: ${error.message}`, 'error');
                console.error('Translation process error:', error);
            }
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * Simplified method to split text into chunks
     * @param {string} text - The text to split into chunks
     * @returns {Array} - Array of chunk objects
     */
    splitIntoChunks(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        // Clean the text
        const cleanedText = text.trim().replace(/\s+/g, ' ');
        const words = cleanedText.split(' ');
        
        // If text is small enough, return as single chunk
        if (words.length <= this.maxChunkSize) {
            return [{ text: cleanedText, index: 0, total: 1 }];
        }
        
        // Create chunks with naive but effective paragraph-aware splitting
        const paragraphs = cleanedText.split(/\n\n+/);
        const chunks = [];
        let currentChunk = '';
        let currentWordCount = 0;
        
        // Process each paragraph
        for (const paragraph of paragraphs) {
            const paragraphWordCount = paragraph.split(' ').length;
            
            // If adding this paragraph would exceed max size and we already have content
            if (currentWordCount + paragraphWordCount > this.maxChunkSize && currentWordCount > 0) {
                // Save current chunk
                chunks.push(currentChunk.trim());
                
                // Start new chunk with overlap for context
                const words = currentChunk.split(' ');
                const overlapText = words.slice(Math.max(0, words.length - this.overlapSize)).join(' ') + ' ';
                currentChunk = overlapText + paragraph;
                currentWordCount = overlapText.split(' ').filter(Boolean).length + paragraphWordCount;
            } else if (paragraphWordCount > this.maxChunkSize) {
                // Handle large paragraphs by splitting at sentence boundaries
                if (currentWordCount > 0) {
                    chunks.push(currentChunk.trim());
                }
                
                // Split paragraph into sentences
                const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
                currentChunk = '';
                currentWordCount = 0;
                
                for (const sentence of sentences) {
                    const sentenceWordCount = sentence.split(' ').length;
                    
                    if (currentWordCount + sentenceWordCount > this.maxChunkSize) {
                        if (currentWordCount > 0) {
                            chunks.push(currentChunk.trim());
                            currentChunk = '';
                            currentWordCount = 0;
                        }
                        
                        // If single sentence is too long, force split it
                        if (sentenceWordCount > this.maxChunkSize) {
                            const sentenceWords = sentence.split(' ');
                            for (let i = 0; i < sentenceWords.length; i += this.maxChunkSize) {
                                const chunkWords = sentenceWords.slice(i, i + this.maxChunkSize);
                                chunks.push(chunkWords.join(' ').trim());
                            }
                        } else {
                            currentChunk = sentence;
                            currentWordCount = sentenceWordCount;
                        }
                    } else {
                        currentChunk += sentence;
                        currentWordCount += sentenceWordCount;
                    }
                }
            } else {
                // Add paragraph to current chunk
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                currentWordCount += paragraphWordCount;
            }
        }
        
        // Add the final chunk if there's anything left
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        // Return chunks with metadata
        return chunks.map((text, index) => ({
            text,
            index,
            total: chunks.length
        }));
    }

    /**
     * Extract context from translated text for the next chunk
     * @param {string} text - The text to extract context from
     * @returns {string} - The extracted context
     */
    extractContext(text, contextSize = 100) {
        const words = text.split(' ');
        if (words.length <= contextSize) {
            return text;
        }
        return words.slice(Math.max(0, words.length - contextSize)).join(' ');
    }

    /**
     * Improved retry mechanism for translating chunks
     * @param {Object} chunk - The chunk to translate
     * @returns {Promise<Object>} - The translation result
     */
    async translateChunkWithRetry(chunk, retryCount = 0) {
        const maxRetries = 3;
        const baseDelay = 1000; // 1 second base delay
        
        try {
            console.log(`Attempting to translate chunk ${chunk.index + 1} (attempt ${retryCount + 1})`);
            return await this.translateChunk(chunk);
        } catch (error) {
            // Log the specific error
            console.error(`Error translating chunk ${chunk.index + 1} (attempt ${retryCount + 1}):`, error);
            
            // Check for specific error types that shouldn't be retried
            if (error.message.includes('Authentication required')) {
                this.showMessage('Your session has expired. Please log in again.', 'error');
                throw error; // Don't retry auth errors
            }
            
            if (retryCount < maxRetries) {
                // Calculate delay with exponential backoff and jitter
                const jitter = Math.random() * 0.3 + 0.85; // random between 0.85 and 1.15
                const delay = Math.pow(2, retryCount) * baseDelay * jitter;
                
                this.showMessage(`