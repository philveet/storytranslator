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
        // Read selected model (fallback to gpt-4.1)
        this.model = (document.getElementById('model-picker') && document.getElementById('model-picker').value) || 'gpt-4.1';
        
        try {
            // Get text from textarea
            this.originalText = document.getElementById('input-text').value.trim();
            if (!this.originalText) {
                throw new Error('Please enter some text to translate');
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
     * Show a message to the user
     * @param {string} message - The message to show
     * @param {string} type - The message type (info, error, success, warning)
     */
    showMessage(message, type = 'info') {
        // Use the non-blocking notification system instead of alert
        if (window.notifications) {
            window.notifications.show(message, type);
        } else {
            // Fallback to alert only if notifications aren't available
            alert(`${type.toUpperCase()}: ${message}`);
        }
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
            
            // Split text into chunks
            this.chunks = this.splitIntoChunks(this.originalText);
            
            if (this.chunks.length === 0) {
                throw new Error('Failed to split text into chunks');
            }
            
            console.log(`Text split into ${this.chunks.length} chunks`);
            this.chunkInfo.textContent = `Processing ${this.chunks.length} chunks`;
            
            // Context-aware parallel processing
            const concurrencyLimit = 2; // Adjust based on your API limits
            const results = new Array(this.chunks.length);
            let completedChunks = 0;
            
            // Track which chunks are processing or completed
            const chunkStatus = new Array(this.chunks.length).fill('pending');
            
            // Process all chunks
            while (completedChunks < this.chunks.length) {
                // Check if operation was aborted
                if (this.abortController.signal.aborted) {
                    throw new Error('Translation aborted');
                }
                
                // Find chunks that can be processed now (dependencies satisfied)
                const availableChunks = [];
                
                for (let i = 0; i < this.chunks.length; i++) {
                    // Skip already processing or completed chunks
                    if (chunkStatus[i] !== 'pending') continue;
                    
                    // First chunk can always start
                    if (i === 0) {
                        availableChunks.push(i);
                        continue;
                    }
                    
                    // Other chunks can start if their dependency (previous chunk) is completed
                    const dependencyIdx = i - 1; // Each chunk depends on its immediately preceding chunk
                    
                    if (chunkStatus[dependencyIdx] === 'completed') {
                        availableChunks.push(i);
                    }
                    
                    // Limit available chunks to maintain concurrency limit
                    if (availableChunks.length >= concurrencyLimit) break;
                }
                
                // If no chunks can be processed right now, wait for some to complete
                if (availableChunks.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
                
                // Start processing available chunks
                const processingPromises = availableChunks.map(async (chunkIndex) => {
                    // Mark as processing
                    chunkStatus[chunkIndex] = 'processing';
                    const chunk = this.chunks[chunkIndex];
                    
                    // Get context from previous chunk if available
                    let chunkContext = '';
                    if (chunkIndex > 0) {
                        const prevChunkIndex = chunkIndex - 1;
                        if (results[prevChunkIndex]) {
                            chunkContext = this.extractContext(results[prevChunkIndex].translated_text);
                        }
                    }
                    
                    try {
                        console.log(`Processing chunk ${chunkIndex + 1} of ${this.chunks.length}`);
                        this.chunkInfo.textContent = `Processing chunk ${chunkIndex + 1}...`;
                        
                        // Translate the chunk
                        const result = await this.translateChunkWithRetry({
                            ...chunk,
                            context: chunkContext
                        });
                        
                        // Store result
                        results[chunkIndex] = result;
                        chunkStatus[chunkIndex] = 'completed';
                        completedChunks++;
                        
                        // Update progress
                        this.updateProgress(completedChunks / this.chunks.length * 100);
                        this.chunkInfo.textContent = `Completed ${completedChunks} of ${this.chunks.length} chunks`;
                        
                        return result;
                    } catch (error) {
                        chunkStatus[chunkIndex] = 'error';
                        throw error;
                    }
                });
                
                // Wait for this batch to complete
                await Promise.all(processingPromises);
            }
            
            // Store results and filter out any nulls
            this.results = results.filter(Boolean);
            
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
     * Enhanced translateChunkWithRetry method that guarantees either success or clear failure
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
                
                console.log(`Will retry chunk ${chunk.index + 1} in ${Math.round(delay/1000)} seconds...`);
                this.chunkInfo.textContent = `Retrying chunk ${chunk.index + 1} (attempt ${retryCount + 2})...`;

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));

                // Retry with incremented counter
                return this.translateChunkWithRetry(chunk, retryCount + 1);
            } else {
                // CRITICAL: Permanent failure after max retries
                const errorMessage = `Failed to translate chunk ${chunk.index + 1} after ${maxRetries} retries`;
                console.error(errorMessage);
                
                // Display clear error to user
                this.showMessage(`Translation failed: ${errorMessage}. Please try again later.`, 'error');
                
                // This error will propagate up and cause the entire translation to abort
                throw new Error(errorMessage);
            }
        }
    }

    /**
     * Translate a single chunk of text
     * @param {Object} chunk - The chunk to translate
     * @returns {Promise<Object>} - The translation result
     */
    async translateChunk(chunk) {
        try {
            const payload = {
                text: chunk.text,
                target_language: this.targetLanguage,
                context: chunk.context || this.context,
                model: this.model
            };
            
            console.log(`Sending chunk ${chunk.index + 1} to translation API`);
            
            const response = await fetch('/translate-chunk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: this.abortController.signal
            });
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || `HTTP error ${response.status}`;
                } catch (e) {
                    errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            // Add content type validation before parsing JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Expected JSON response but got ${contentType || 'unknown content type'}`);
            }
            
            const result = await response.json();
            
            // Return only essential data, dropping the full chunk text to save memory
            return {
                translated_text: result.translated_text,
                chunk_index: chunk.index,
                original_length: result.original_length,
                translated_length: result.translated_length
            };
        } catch (error) {
            console.error("Translation chunk error:", error);
            throw error;  // Re-throw for retry mechanism
        }
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
        console.log('Assembling translation results...');
        
        // CRITICAL SAFETY CHECK: Verify all chunks were translated
        const missingChunks = [];
        for (let i = 0; i < this.chunks.length; i++) {
            if (!this.results[i]) {
                missingChunks.push(i);
            }
        }
        
        // If any chunks are missing, abort with clear error
        if (missingChunks.length > 0) {
            const errorMessage = `Translation incomplete. Missing chunks: ${missingChunks.join(', ')}`;
            console.error(errorMessage);
            this.showMessage(`ERROR: ${errorMessage}. Please try again.`, 'error');
            
            // Hide progress and don't show incomplete results
            this.progressContainer.classList.add('hidden');
            return;
        }
        
        // Sort results by chunk index
        this.results.sort((a, b) => a.chunk_index - b.chunk_index);
        
        // Try the new batched rendering approach
        try {
            // Calculate total length for progress reporting
            const totalChunks = this.results.length;
            
            // Clear any existing content
            this.translatedText.textContent = '';
            this.translatedTextSide.textContent = '';
            
            // Flag to track if batched rendering completes
            this._batchedRenderingComplete = false;
            
            // Process in batches to avoid blocking UI
            const processBatch = (startIdx, batchSize) => {
                // Create fragments for better performance
                const fragment = document.createDocumentFragment();
                const fragmentSide = document.createDocumentFragment();
                
                // Process only a subset of results at a time
                const endIdx = Math.min(startIdx + batchSize, totalChunks);
                
                for (let i = startIdx; i < endIdx; i++) {
                    const result = this.results[i];
                    
                    // Create text nodes for better performance
                    const textNode = document.createTextNode(result.translated_text + ' ');
                    const textNodeSide = document.createTextNode(result.translated_text + ' ');
                    
                    fragment.appendChild(textNode);
                    fragmentSide.appendChild(textNodeSide);
                }
                
                // Append fragments to DOM
                this.translatedText.appendChild(fragment);
                this.translatedTextSide.appendChild(fragmentSide);
                
                // If we've processed all chunks
                if (endIdx >= totalChunks) {
                    // Set original text
                    this.originalTextDisplay.textContent = this.originalText;
                    
                    // Quality check is still performed internally but not displayed
                    this.checkQuality(false);
                    
                    // Show results container
                    this.progressContainer.classList.add('hidden');
                    this.resultsContainer.classList.remove('hidden');
                    
                    // Mark as complete so fallback doesn't run
                    this._batchedRenderingComplete = true;
                    
                    console.log('Translation completed successfully with batched rendering');
                    
                    // Clean up memory
                    this.cleanupMemory();
                    return;
                }
                
                // Process next batch after a small delay
                setTimeout(() => {
                    processBatch(endIdx, batchSize);
                }, 50);
            };
            
            // Start processing in batches of 5 chunks at a time
            processBatch(0, 5);
            
            // We don't proceed past this point in the success case
            // The remainder of the function serves as a fallback
            
        } catch (error) {
            // Log the error for debugging
            console.error('Error with batched rendering, using fallback method:', error);
            
            // Only run fallback if batched rendering didn't complete
            if (!this._batchedRenderingComplete) {
                this.fallbackAssembleResults();
            }
        }
    }

    /**
     * Fallback method for assembling results when batched rendering fails
     */
    fallbackAssembleResults() {
        console.log('Using fallback rendering method');
        
        // Make sure results are sorted (even though we already did this)
        this.results.sort((a, b) => a.chunk_index - b.chunk_index);
        
        // Original method: combine all translated text at once
        const translatedText = this.results.map(result => result.translated_text).join(' ');
        
        // Display results using the original direct approach
        this.translatedText.textContent = translatedText;
        this.translatedTextSide.textContent = translatedText;
        this.originalTextDisplay.textContent = this.originalText;
        
        // Quality check is still performed internally but not displayed
        this.checkQuality(false);
        
        // Show results container
        this.progressContainer.classList.add('hidden');
        this.resultsContainer.classList.remove('hidden');
        
        console.log('Translation completed successfully using fallback method');
        
        // Clean up memory after a short delay to ensure UI has updated
        setTimeout(() => this.cleanupMemory(), 1000);
    }

    /**
     * Clean up memory after translation is complete
     * This keeps only what's needed and releases everything else
     */
    cleanupMemory() {
        console.log('Performing memory cleanup...');
        
        // No need to rebuild the full text - it's already in the DOM
        // Just clear all the source data
        this.chunks = null;
        
        // Keep minimal reference to results
        const originalResultsLength = this.results.length;
        this.results = [{ translated_text: "(Translation complete)", chunk_index: 0 }];
        
        // Clear context
        this.context = '';
        
        // Force garbage collection consideration without blocking UI
        setTimeout(() => {
            console.log(`Memory cleanup complete, released data for ${originalResultsLength} chunks`);
        }, 0);
    }

    /**
     * Limit how much text is displayed while keeping the full content
     * Only implement if users complain about performance with very large texts
     */
    limitDisplayText() {
        // Only implement if users complain about performance with very large texts
        // This would show a subset of the text with pagination controls
    }

    /**
     * Check translation quality
     * @param {boolean} updateDisplay - Whether to update the quality indicator display
     */
    checkQuality(updateDisplay = true) {
        // Calculate original and translated word counts
        const originalWords = this.originalText.split(/\s+/).length;
        const translatedWords = this.results.reduce((total, result) => total + result.translated_length, 0);
        
        // Calculate the word count ratio
        const ratio = translatedWords / originalWords;
        
        let qualityStatus = '';
        
        // Thresholds for quality assessment
        if (ratio < 0.7) {
            qualityStatus = 'Warning: Translation appears to be missing content.';
            if (updateDisplay) this.qualityIndicator.className = 'warning';
        } else if (ratio > 1.3) {
            qualityStatus = 'Warning: Translation appears to have additional content.';
            if (updateDisplay) this.qualityIndicator.className = 'warning';
        } else {
            qualityStatus = 'Good: Word count ratio is within expected range.';
            if (updateDisplay) this.qualityIndicator.className = 'good';
        }
        
        // Log quality info but don't update display
        console.log(`Quality check: ${qualityStatus} (Ratio: ${ratio.toFixed(2)})`);
        
        // Only update the display if requested
        if (updateDisplay) {
            this.qualityIndicator.textContent = qualityStatus;
        }
    }

    /**
     * Cancel the current translation
     */
    cancelTranslation() {
        if (this.isTranslating && this.abortController) {
            console.log('Cancelling translation process');
            this.abortController.abort();
            this.isTranslating = false;
            this.showMessage('Translation cancelled', 'info');
        }
    }
}

// Initialize Translator on page load
document.addEventListener('DOMContentLoaded', () => {
    window.translator = new Translator();
});