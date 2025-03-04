/**
 * Add this to a new file: static/js/logger.js
 */
class Logger {
    constructor() {
        this.isProduction = window.location.hostname !== 'localhost' && 
                            !window.location.hostname.includes('127.0.0.1');
        this.debugMode = localStorage.getItem('debugMode') === 'true';
        
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn
        };
        
        // Replace console methods with filtered versions
        this.setupConsoleOverrides();
    }
    
    setupConsoleOverrides() {
        // Only log errors and warnings in production unless debug mode is on
        console.log = (...args) => {
            if (!this.isProduction || this.debugMode) {
                this.originalConsole.log(...args);
            }
        };
        
        // Always log errors, but with formatting
        console.error = (...args) => {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] ERROR:`;
            
            // Always log errors
            this.originalConsole.error(prefix, ...args);
            
            // In production, send critical errors to server (optional)
            if (this.isProduction && !this.debugMode) {
                this.logToServer('error', args);
            }
        };
        
        // Always log warnings, but with formatting
        console.warn = (...args) => {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] WARNING:`;
            this.originalConsole.warn(prefix, ...args);
        };
    }
    
    /**
     * Log critical events to server (implementation optional)
     */
    logToServer(level, args) {
        // This is where you could send critical errors to your server
        // Only implement if you need server-side error tracking
        try {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg);
                }
                return String(arg);
            }).join(' ');
            
            // For simplicity, just log that we would send to server
            this.originalConsole.log(`[Would send to server]: ${level} - ${message.substring(0, 200)}`);
            
            // Actual implementation would be something like:
            /*
            fetch('/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message, timestamp: new Date().toISOString() })
            });
            */
        } catch (e) {
            // Don't let logging errors cause more problems
            this.originalConsole.error('Error in logToServer:', e);
        }
    }
    
    /**
     * Add meaningful logs at key points in the translation process
     */
    static addTranslationLogs(translator) {
        // Store original methods
        const originalStartTranslation = translator.startTranslation;
        const originalTranslateChunk = translator.translateChunk;
        const originalAssembleResults = translator.assembleResults;
        
        // Add logging to startTranslation
        translator.startTranslation = async function() {
            console.log(`[Translation] Starting new translation - Target language: ${this.targetLanguage}, Text length: ${this.originalText.length} chars`);
            const startTime = performance.now();
            
            try {
                await originalStartTranslation.apply(this, arguments);
            } finally {
                const duration = ((performance.now() - startTime) / 1000).toFixed(2);
                console.log(`[Translation] Completed in ${duration}s`);
            }
        };
        
        // Add logging to translateChunk
        translator.translateChunk = async function(chunk) {
            const startTime = performance.now();
            console.log(`[Chunk ${chunk.index + 1}/${this.chunks.length}] Starting translation`);
            
            try {
                const result = await originalTranslateChunk.apply(this, arguments);
                const duration = ((performance.now() - startTime) / 1000).toFixed(2);
                console.log(`[Chunk ${chunk.index + 1}/${this.chunks.length}] Completed in ${duration}s`);
                return result;
            } catch (error) {
                console.error(`[Chunk ${chunk.index + 1}/${this.chunks.length}] Failed after ${((performance.now() - startTime) / 1000).toFixed(2)}s`, error);
                throw error;
            }
        };
        
        // Add logging to assembleResults
        translator.assembleResults = function() {
            console.log(`[Assembly] Starting results assembly - ${this.results.length} chunks`);
            const startTime = performance.now();
            
            originalAssembleResults.apply(this, arguments);
            
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`[Assembly] Completed in ${duration}s`);
        };
    }
}

// Initialize logger on page load
document.addEventListener('DOMContentLoaded', () => {
    window.logger = new Logger();
    
    // Wait for translator to be defined, then add logs
    const checkTranslator = setInterval(() => {
        if (window.translator) {
            Logger.addTranslationLogs(window.translator);
            clearInterval(checkTranslator);
        }
    }, 100);
}); 