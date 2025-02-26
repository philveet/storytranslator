/**
 * Text chunking logic for Story Translator
 * Splits large text into manageable chunks for API processing
 */

class TextChunker {
    constructor(options = {}) {
        // Default settings
        this.maxChunkSize = options.maxChunkSize || 500; // words per chunk
        this.overlapSize = options.overlapSize || 50; // words to overlap between chunks
        this.separators = options.separators || ['.', '!', '?', '\n\n']; // sentence/paragraph separators
    }

    /**
     * Split text into chunks
     * @param {string} text - The full text to split
     * @returns {Array} - Array of chunk objects with text, index, and total
     */
    splitIntoChunks(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        // Trim and normalize whitespace
        const cleanedText = text.trim().replace(/\s+/g, ' ');
        const words = cleanedText.split(' ');
        const totalWords = words.length;

        if (totalWords <= this.maxChunkSize) {
            return [{
                text: cleanedText,
                index: 0,
                total: 1,
                wordCount: totalWords
            }];
        }

        // Split text into segments by preserving sentence boundaries
        const segments = this.splitIntoSegments(cleanedText);
        
        // Build chunks from segments
        return this.buildChunksFromSegments(segments);
    }

    /**
     * Split text into segments by preserving sentences and paragraphs
     * @param {string} text - The text to split into segments
     * @returns {Array} - Array of segment strings
     */
    splitIntoSegments(text) {
        let segments = [text];
        
        // Split by each separator in order of priority
        this.separators.forEach(separator => {
            let newSegments = [];
            segments.forEach(segment => {
                // Skip very small segments
                if (segment.split(' ').length < 10) {
                    newSegments.push(segment);
                    return;
                }
                
                // Split by current separator and add to new segments
                const parts = segment.split(separator);
                for (let i = 0; i < parts.length - 1; i++) {
                    newSegments.push(parts[i] + separator);
                }
                
                // Add the last part if not empty
                if (parts[parts.length - 1].trim()) {
                    newSegments.push(parts[parts.length - 1]);
                }
            });
            segments = newSegments;
        });
        
        return segments.filter(segment => segment.trim().length > 0);
    }

    /**
     * Build chunks from segments
     * @param {Array} segments - The segments to build chunks from
     * @returns {Array} - Array of chunk objects
     */
    buildChunksFromSegments(segments) {
        const chunks = [];
        let currentChunk = '';
        let currentWordCount = 0;
        
        segments.forEach(segment => {
            const segmentWordCount = segment.split(' ').length;
            
            // If adding this segment exceeds the max chunk size and we already have content,
            // finalize the current chunk and start a new one
            if (currentWordCount + segmentWordCount > this.maxChunkSize && currentWordCount > 0) {
                chunks.push({
                    text: currentChunk.trim(),
                    wordCount: currentWordCount
                });
                
                // Calculate overlap for context continuity
                const overlapText = this.extractOverlap(currentChunk);
                currentChunk = overlapText + segment;
                currentWordCount = overlapText.split(' ').filter(Boolean).length + segmentWordCount;
            } else {
                // Add segment to current chunk
                currentChunk += segment;
                currentWordCount += segmentWordCount;
            }
        });
        
        // Add the final chunk if there's anything left
        if (currentChunk.trim()) {
            chunks.push({
                text: currentChunk.trim(),
                wordCount: currentWordCount
            });
        }
        
        // Add index and total information
        return chunks.map((chunk, index) => ({
            ...chunk,
            index,
            total: chunks.length
        }));
    }

    /**
     * Extract overlap text from the end of a chunk for context continuity
     * @param {string} text - The chunk text to extract overlap from
     * @returns {string} - The overlap text
     */
    extractOverlap(text) {
        const words = text.split(' ');
        
        if (words.length <= this.overlapSize) {
            return text;
        }
        
        // Get the last N words for overlap
        return words.slice(Math.max(0, words.length - this.overlapSize)).join(' ') + ' ';
    }

    /**
     * Extract context from a chunk for use in the next chunk
     * @param {string} text - The chunk text to extract context from
     * @param {number} contextSize - Number of words to extract for context
     * @returns {string} - The context text
     */
    extractContext(text, contextSize = 100) {
        // Extract the last N words from the translated chunk
        const words = text.split(' ');
        if (words.length <= contextSize) {
            return text;
        }
        return words.slice(Math.max(0, words.length - contextSize)).join(' ');
    }
}

// Make TextChunker available globally
window.TextChunker = TextChunker; 