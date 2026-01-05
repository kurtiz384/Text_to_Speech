// ===================================================================
// Azure Text-to-Speech PWA Application
// Optimized for iPad with minimal latency
// ===================================================================

class TextToSpeechApp {
    constructor() {
        this.config = null;
        this.synthesizer = null;
        this.lastText = '';
        this.activeWindow = 1;
        this.isSynthesizing = false;  // Flag to prevent concurrent synthesis
        
        this.init();
    }

    // ===============================================================
    // Initialization
    // ===============================================================
    
    async init() {
        console.log('[TTS] Initializing app...');
        
        // Load config
        await this.loadConfig();
        
        // Setup UI
        this.setupUI();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.restoreTexts();
        
        // Initialize Azure SDK
        if (this.config && this.config.azureKey && this.config.azureRegion) {
            this.initializeAzure();
        } else {
            this.showConfigModal();
        }
        
        // Register service worker for PWA
        this.registerServiceWorker();
        
        console.log('[TTS] App initialized');
    }

    async loadConfig() {
        console.log('[TTS] Loading config...');
        
        // Try to load from localStorage first
        const savedConfig = localStorage.getItem('azureConfig');
        
        if (savedConfig) {
            try {
                this.config = JSON.parse(savedConfig);
                console.log('[TTS] Config loaded from localStorage');
                console.log('[TTS] Azure Key present:', !!this.config.azureKey);
                console.log('[TTS] Azure Region:', this.config.azureRegion);
                return;
            } catch (error) {
                console.error('[TTS] Failed to parse localStorage config:', error);
            }
        }
        
        // Try to load from config.json
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                this.config = await response.json();
                console.log('[TTS] Config loaded from config.json');
                console.log('[TTS] Azure Key present:', !!this.config.azureKey);
                console.log('[TTS] Azure Region:', this.config.azureRegion);
                console.log('[TTS] Voices count:', this.config.voices?.length || 0);
            }
        } catch (error) {
            console.warn('[TTS] Could not load config.json:', error.message);
        }
        
        // If no config at all, initialize empty
        if (!this.config) {
            console.log('[TTS] No config found, will show modal');
            this.config = { voices: [] };
        }
    }

    initializeAzure() {
        try {
            console.log('[TTS] Initializing Azure Speech SDK...');
            console.log('[TTS] Key length:', this.config.azureKey?.length || 0);
            console.log('[TTS] Region:', this.config.azureRegion);
            
            if (!this.config.azureKey || !this.config.azureRegion) {
                console.error('[TTS] Missing Azure credentials');
                this.showToast('Chybí Azure credentials', 'error');
                this.showConfigModal();
                return;
            }
            
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
                this.config.azureKey,
                this.config.azureRegion
            );
            
            // Set output format for better quality
            speechConfig.speechSynthesisOutputFormat = 
                SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
            
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
            
            this.synthesizer = new SpeechSDK.SpeechSynthesizer(
                speechConfig,
                audioConfig
            );
            
            this.updateStatus('Připraveno', 'success');
            console.log('[TTS] Azure SDK initialized successfully');
            
            // Populate voices
            this.populateVoices();
            
        } catch (error) {
            console.error('[TTS] Failed to initialize Azure SDK:', error);
            this.showToast('Chyba při inicializaci Azure TTS: ' + error.message, 'error');
            this.updateStatus('Chyba', 'error');
            this.showConfigModal();
        }
    }

    populateVoices() {
        const voiceSelect = document.getElementById('voiceSelect');
        
        // Only 3 voices as requested by user
        const defaultVoices = [
            { id: 'de-DE-ChristophNeural', name: 'Němčina - Christoph', lang: 'de-DE' },
            { id: 'cs-CZ-AntoninNeural', name: 'Čeština - Antonín', lang: 'cs-CZ' },
            { id: 'en-US-GuyNeural', name: 'Angličtina - Guy', lang: 'en-US' },
        ];
        
        // Use voices from config if available, otherwise use defaults
        let voices = defaultVoices;
        if (this.config && this.config.voices && this.config.voices.length > 0) {
            voices = this.config.voices;
            console.log('[TTS] Using voices from config.json');
        } else {
            console.log('[TTS] Using default voice list');
        }
        
        voiceSelect.innerHTML = '';
        
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = voice.name;
            voiceSelect.appendChild(option);
        });
        
        console.log(`[TTS] Populated ${voices.length} voices`);
        
        // Restore last selected voice
        const savedVoice = localStorage.getItem('selectedVoice');
        if (savedVoice) {
            voiceSelect.value = savedVoice;
            console.log('[TTS] Restored saved voice:', savedVoice);
        } else {
            // Set first voice as default
            if (voices.length > 0) {
                voiceSelect.value = voices[0].id;
                console.log('[TTS] Set default voice:', voices[0].id);
            }
        }
    }

    // ===============================================================
    // UI Setup
    // ===============================================================
    
    setupUI() {
        // Update character counts
        this.updateCharCount(1);
        this.updateCharCount(2);
    }

    setupEventListeners() {
        // Text areas - save on change
        document.getElementById('textArea1').addEventListener('input', () => {
            this.updateCharCount(1);
            this.saveText(1);
        });
        
        document.getElementById('textArea2').addEventListener('input', () => {
            this.updateCharCount(2);
            this.saveText(2);
        });
        
        // Track active window
        document.getElementById('textArea1').addEventListener('focus', () => {
            this.activeWindow = 1;
        });
        
        document.getElementById('textArea2').addEventListener('focus', () => {
            this.activeWindow = 2;
        });
        
        // Voice selection
        document.getElementById('voiceSelect').addEventListener('change', (e) => {
            localStorage.setItem('selectedVoice', e.target.value);
        });
        
        // Rate selection
        document.getElementById('rateSelect').addEventListener('change', (e) => {
            localStorage.setItem('selectedRate', e.target.value);
        });
        
        // Restore rate
        const savedRate = localStorage.getItem('selectedRate');
        if (savedRate) {
            document.getElementById('rateSelect').value = savedRate;
        }
        
        // Touch-friendly button event listeners
        // Use both click and touchend for maximum compatibility
        this.setupButtonListeners();
    }
    
    setupButtonListeners() {
        // Get all buttons with data-action attribute
        const buttons = document.querySelectorAll('[data-action]');
        
        buttons.forEach(button => {
            const action = button.getAttribute('data-action');
            const windowNum = button.getAttribute('data-window');
            
            // Add both click and touchend listeners for iPad trackpad/touch compatibility
            const handleAction = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('[TTS] Button action:', action, 'window:', windowNum);
                
                switch(action) {
                    case 'speak-all':
                        this.speakAll(parseInt(windowNum));
                        break;
                    case 'speak-selection':
                        this.speakSelection(parseInt(windowNum));
                        break;
                    case 'repeat-last':
                        this.repeatLast();
                        break;
                    case 'save-config':
                        this.saveConfig();
                        break;
                    case 'close-modal':
                        this.closeConfigModal();
                        break;
                }
            };
            
            // Add multiple event types for maximum compatibility
            button.addEventListener('click', handleAction, { passive: false });
            button.addEventListener('touchend', handleAction, { passive: false });
            
            // Prevent default touch behavior
            button.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: false });
        });
        
        console.log('[TTS] Button listeners setup complete');
    }

    setupKeyboardShortcuts() {
        // Control+Command+V = Speak All
        // Control+Command+B = Speak Selection
        
        document.addEventListener('keydown', (e) => {
            // Check for Control+Command (or Ctrl+Meta on some systems)
            const isCtrlCmd = (e.ctrlKey && e.metaKey);
            
            if (!isCtrlCmd) return;
            
            if (e.key === 'v' || e.key === 'V') {
                e.preventDefault();
                this.speakAll(this.activeWindow);
                console.log('[TTS] Keyboard shortcut: Speak All (Ctrl+Cmd+V)');
            } else if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                this.speakSelection(this.activeWindow);
                console.log('[TTS] Keyboard shortcut: Speak Selection (Ctrl+Cmd+B)');
            }
        });
    }

    // ===============================================================
    // Text Management
    // ===============================================================
    
    updateCharCount(windowNum) {
        const textArea = document.getElementById(`textArea${windowNum}`);
        const charCount = document.getElementById(`charCount${windowNum}`);
        const length = textArea.value.length;
        charCount.textContent = `${length} znaků`;
    }

    saveText(windowNum) {
        const textArea = document.getElementById(`textArea${windowNum}`);
        localStorage.setItem(`text${windowNum}`, textArea.value);
    }

    restoreTexts() {
        for (let i = 1; i <= 2; i++) {
            const savedText = localStorage.getItem(`text${i}`);
            if (savedText) {
                document.getElementById(`textArea${i}`).value = savedText;
                this.updateCharCount(i);
            }
        }
    }

    // ===============================================================
    // Speech Synthesis
    // ===============================================================
    
    async speakAll(windowNum) {
        console.log('[TTS] speakAll called for window', windowNum);
        const textArea = document.getElementById(`textArea${windowNum}`);
        if (!textArea) {
            console.error('[TTS] textArea not found:', `textArea${windowNum}`);
            return;
        }
        
        const text = textArea.value.trim();
        console.log('[TTS] Text length:', text.length);
        
        if (!text) {
            this.showToast('Text je prázdný', 'warning');
            return;
        }
        
        // For Safari: ensure user interaction unlocks audio
        this.ensureAudioUnlocked();
        
        await this.synthesizeSpeech(text);
        
        // Select all text and focus
        textArea.focus();
        textArea.select();
    }

    async speakSelection(windowNum) {
        console.log('[TTS] speakSelection called for window', windowNum);
        const textArea = document.getElementById(`textArea${windowNum}`);
        if (!textArea) {
            console.error('[TTS] textArea not found:', `textArea${windowNum}`);
            return;
        }
        
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const selectedText = textArea.value.substring(start, end).trim();
        
        if (!selectedText) {
            this.showToast('Není označen žádný text', 'warning');
            // Select all as fallback
            textArea.focus();
            textArea.select();
            return;
        }
        
        // For Safari: ensure user interaction unlocks audio
        this.ensureAudioUnlocked();
        
        await this.synthesizeSpeech(selectedText);
        
        // Keep selection and focus
        textArea.focus();
        textArea.setSelectionRange(start, end);
    }

    async repeatLast() {
        if (!this.lastText) {
            this.showToast('Zatím není co zopakovat', 'warning');
            return;
        }
        
        // For Safari: ensure user interaction unlocks audio
        this.ensureAudioUnlocked();
        
        await this.synthesizeSpeech(this.lastText);
    }
    
    ensureAudioUnlocked() {
        // Safari requires user interaction to play audio
        // This method is called from button clicks, which satisfies that requirement
        // No additional action needed, but keeping this for clarity
        console.log('[TTS] Audio unlock check - called from user interaction');
    }

    async synthesizeSpeech(text) {
        console.log('[TTS] synthesizeSpeech called');
        console.log('[TTS] Synthesizer exists:', !!this.synthesizer);
        console.log('[TTS] Text length:', text.length);
        console.log('[TTS] Is synthesizing:', this.isSynthesizing);
        
        // Check if already synthesizing
        if (this.isSynthesizing) {
            console.warn('[TTS] Synthesis already in progress, ignoring request');
            this.showToast('Čekejte na dokončení předchozího přehrávání', 'warning');
            return;
        }
        
        if (!this.synthesizer) {
            console.error('[TTS] Synthesizer not initialized!');
            this.showToast('Azure TTS není inicializován. Zkontrolujte credentials.', 'error');
            this.showConfigModal();
            return;
        }
        
        console.log('[TTS] Starting synthesis...');
        console.log('[TTS] Text length:', text.length);
        console.log('[TTS] First 100 chars:', text.substring(0, 100));
        
        this.lastText = text;
        this.isSynthesizing = true;  // Set flag
        
        // Get selected voice and rate
        const voiceId = document.getElementById('voiceSelect').value;
        const rate = document.getElementById('rateSelect').value;
        
        // Derive locale from voice ID
        const locale = this.getLocaleFromVoice(voiceId);
        
        // Escape XML special characters
        const safeText = this.escapeXml(text);
        
        // Build SSML with leading silence to prevent first syllable cutoff
        // Using 200ms as user reported 100ms wasn't enough
        const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'>
    <voice name='${voiceId}'>
        <break time='200ms'/>
        <prosody rate='${rate}'>${safeText}</prosody>
    </voice>
</speak>
        `.trim();
        
        console.log('[TTS] SSML prepared, voice:', voiceId, 'rate:', rate);
        
        this.updateStatus('Načítám...', 'loading');
        
        const startTime = performance.now();
        
        try {
            await new Promise((resolve, reject) => {
                this.synthesizer.speakSsmlAsync(
                    ssml,
                    (result) => {
                        const endTime = performance.now();
                        const latency = Math.round(endTime - startTime);
                        
                        console.log('[TTS] Synthesis result reason:', result.reason);
                        console.log('[TTS] Latency:', latency, 'ms');
                        
                        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                            this.updateStatus('Přehrávám...', 'success');
                            this.showToast(`Přehrávání (${latency}ms)`, 'success');
                            this.isSynthesizing = false;  // Reset flag on success
                            resolve();
                        } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
                            console.error('[TTS] Synthesis CANCELED');
                            this.isSynthesizing = false;  // Reset flag on cancel
                            
                            // Get detailed cancellation info
                            const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
                            console.error('[TTS] Cancellation reason:', cancellation.reason);
                            console.error('[TTS] Error code:', cancellation.errorCode);
                            console.error('[TTS] Error details:', cancellation.errorDetails);
                            
                            let errorMessage = 'Syntéza zrušena';
                            
                            if (cancellation.errorDetails) {
                                if (cancellation.errorDetails.includes('401') || 
                                    cancellation.errorDetails.includes('Unauthorized')) {
                                    errorMessage = 'Neplatný Azure Key (401)';
                                } else if (cancellation.errorDetails.includes('403') || 
                                           cancellation.errorDetails.includes('Forbidden')) {
                                    errorMessage = 'Azure subscription problém (403)';
                                } else if (cancellation.errorDetails.includes('Connection')) {
                                    errorMessage = 'Problém s připojením k Azure';
                                } else {
                                    errorMessage = cancellation.errorDetails;
                                }
                            }
                            
                            this.updateStatus('Chyba', 'error');
                            this.showToast(errorMessage, 'error');
                            reject(new Error(errorMessage));
                        } else {
                            console.error('[TTS] Unexpected result reason:', result.reason);
                            this.isSynthesizing = false;  // Reset flag on unexpected result
                            this.updateStatus('Chyba', 'error');
                            this.showToast('Neočekávaná chyba syntézy', 'error');
                            reject(new Error('Synthesis failed with reason: ' + result.reason));
                        }
                    },
                    (error) => {
                        console.error('[TTS] Synthesis error:', error);
                        this.isSynthesizing = false;  // Reset flag on error
                        
                        if (error.privErrorDetails) {
                            console.error('[TTS] Error details:', error.privErrorDetails);
                        }
                        
                        this.updateStatus('Chyba', 'error');
                        this.showToast('Chyba při syntéze řeči', 'error');
                        reject(error);
                    }
                );
            });
            
            // Reset status after playback
            setTimeout(() => {
                this.updateStatus('Připraveno', 'success');
            }, 1000);
            
        } catch (error) {
            console.error('[TTS] Failed to synthesize:', error);
            this.isSynthesizing = false;  // Reset flag in catch block
            this.updateStatus('Chyba', 'error');
            
            // Check if it's an authentication error
            if (error.toString().includes('401') || error.toString().includes('authentication')) {
                this.showToast('Neplatný Azure klíč', 'error');
                this.showConfigModal();
            }
        }
    }

    // ===============================================================
    // Helper Functions
    // ===============================================================
    
    getLocaleFromVoice(voiceId) {
        // Extract locale from voice ID (e.g., "de-DE-KillianNeural" -> "de-DE")
        const parts = voiceId.split('-');
        if (parts.length >= 2) {
            return `${parts[0]}-${parts[1]}`;
        }
        return 'en-US';
    }

    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // ===============================================================
    // UI Feedback
    // ===============================================================
    
    updateStatus(text, type = 'success') {
        const statusText = document.querySelector('.status-text');
        const statusDot = document.querySelector('.status-dot');
        
        // Check if status elements exist (they were removed in v1.1)
        if (!statusText || !statusDot) {
            console.log('[TTS] Status update (no UI):', text, type);
            return;
        }
        
        statusText.textContent = text;
        
        // Update dot color
        statusDot.style.background = {
            'success': 'var(--success)',
            'loading': 'var(--warning)',
            'error': 'var(--error)'
        }[type] || 'var(--success)';
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            'success': '✓',
            'error': '✕',
            'warning': '⚠'
        }[type] || 'ℹ';
        
        toast.innerHTML = `
            <span style="font-size: 1.25rem;">${icon}</span>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===============================================================
    // Configuration Modal
    // ===============================================================
    
    showConfigModal() {
        const modal = document.getElementById('configModal');
        modal.style.display = 'flex';
        
        // Pre-fill if config exists
        if (this.config) {
            document.getElementById('azureKey').value = this.config.azureKey || '';
            document.getElementById('azureRegion').value = this.config.azureRegion || 'westeurope';
        }
    }

    closeConfigModal() {
        document.getElementById('configModal').style.display = 'none';
    }

    saveConfig() {
        const key = document.getElementById('azureKey').value.trim();
        const region = document.getElementById('azureRegion').value.trim();
        
        if (!key || !region) {
            this.showToast('Vyplňte všechna pole', 'error');
            return;
        }
        
        this.config = {
            azureKey: key,
            azureRegion: region,
            voices: this.config?.voices || []
        };
        
        // Save to localStorage
        localStorage.setItem('azureConfig', JSON.stringify(this.config));
        
        this.closeConfigModal();
        this.showToast('Konfigurace uložena', 'success');
        
        // Initialize Azure
        this.initializeAzure();
    }

    // ===============================================================
    // Service Worker Registration
    // ===============================================================
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('service-worker.js');
                console.log('[SW] Service Worker registered:', registration);
            } catch (error) {
                console.warn('[SW] Service Worker registration failed:', error);
            }
        }
    }
}

// ===================================================================
// Initialize App
// ===================================================================

let app;

window.addEventListener('DOMContentLoaded', () => {
    console.log('[TTS] DOM loaded, initializing app...');
    app = new TextToSpeechApp();
});

// Prevent iOS rubber band scrolling
document.addEventListener('touchmove', (e) => {
    if (e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }
}, { passive: false });

// Handle iOS viewport height changes
window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
});
