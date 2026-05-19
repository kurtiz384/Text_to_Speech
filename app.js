// ===================================================================
// Azure Text-to-Speech PWA Application
// Optimized for iPad with minimal latency
//
// ZMĚNY v této verzi:
// - Přidána tlačítka STOP ke každému oknu
// - Klávesová zkratka Ctrl+Cmd+S pro zastavení mluvení
// - Font textových polí zvětšen o 15% (inline přes JS)
// - Konfigurovatelná pauza před textem (přepínač Pauza)
// ===================================================================

// Verze kódu. Při každé úpravě zvyšte (např. datum + pořadí).
// Zobrazuje se v titulku okna a v UI - tím vždy poznáte, jestli
// Safari/PWA cache načetla aktuální verzi.
const APP_VERSION = '2026-05-16.1';

class TextToSpeechApp {
    constructor() {
        this.config = null;
        this.synthesizer = null;
        this.lastText = '';
        this.activeWindow = 1;
        this.isSynthesizing = false;  // Flag to prevent concurrent synthesis
        this.speechConfig = null;     // Uloženo zvlášť, aby šlo synthesizer znovu vytvořit po STOP
        
        // Idle/staleness tracking - pro chytrou obnovu synthesizeru
        this._lastSuccessfulSynthAt = null; // čas posledního úspěšného přehrání
        this._synthesizerStale = false;     // true = synthesizer je podezřelý (po pozadí/sleep)
        this._lastHiddenAt = null;          // čas, kdy aplikace přešla na pozadí
        
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
        this.injectVersionBadge();        // zobrazí verzi v titulku okna i v UI
        this.injectStopButtons();         // přidá STOP tlačítka do DOM
        this.injectBreakTimeSelector();   // přidá přepínač pro experiment s pauzou
        this.enlargeTextareaFonts();      // zvětší font textových polí o 15 %
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupStalenessDetection();   // označit synthesizer jako stale po probuzení iPadu
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
            
            // Uložíme speechConfig zvlášť, abychom mohli později recreate synthesizer po STOP
            this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
                this.config.azureKey,
                this.config.azureRegion
            );
            
            // Set output format for better quality
            this.speechConfig.speechSynthesisOutputFormat = 
                SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
            
            this.createSynthesizer();
            
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

    // Vytvoří (nebo znovuvytvoří) synthesizer.
    // Voláno z initializeAzure(), synthesizeSpeech() (chytrá obnova) a stopSpeaking().
    createSynthesizer() {
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
        this.synthesizer = new SpeechSDK.SpeechSynthesizer(
            this.speechConfig,
            audioConfig
        );
        // Nový synthesizer = čerstvé spojení. Resetujeme idle čas a stale flag,
        // aby ho synthesizeSpeech() okamžitě znovu neobnovoval.
        this._lastSuccessfulSynthAt = Date.now();
        this._synthesizerStale = false;
        console.log('[TTS] Synthesizer created (předehřátý, idle čas resetován)');
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

    // NOVÉ: dynamicky přidá tlačítko STOP vedle existujících tlačítek
    // u každého okna. Nemusíte tedy upravovat HTML soubor.
    injectStopButtons() {
        for (let i = 1; i <= 2; i++) {
            // Najdeme libovolné existující tlačítko v daném okně (Přečíst vše / Přečíst výběr)
            // a STOP tlačítko vložíme za něj do stejného rodiče.
            const refButton = document.querySelector(
                `[data-action="speak-selection"][data-window="${i}"]`
            ) || document.querySelector(
                `[data-action="speak-all"][data-window="${i}"]`
            );
            
            if (!refButton) {
                console.warn(`[TTS] Nelze najít referenční tlačítko pro okno ${i}, STOP tlačítko nebylo přidáno.`);
                continue;
            }
            
            // Pokud už STOP tlačítko existuje (např. po hot-reloadu), nevkládáme znovu
            const exists = refButton.parentElement.querySelector(
                `[data-action="stop"][data-window="${i}"]`
            );
            if (exists) continue;
            
            const stopButton = document.createElement('button');
            // Použijeme stejné CSS třídy jako sousední tlačítka pro konzistentní vzhled
            stopButton.className = refButton.className;
            stopButton.setAttribute('data-action', 'stop');
            stopButton.setAttribute('data-window', String(i));
            stopButton.setAttribute('type', 'button');
            stopButton.setAttribute('aria-label', `Zastavit přehrávání (okno ${i})`);
            stopButton.textContent = '⏹ STOP';
            
            // Vložíme hned za referenční tlačítko
            refButton.insertAdjacentElement('afterend', stopButton);
            
            console.log(`[TTS] STOP tlačítko přidáno do okna ${i}`);
        }
    }

    // NOVÉ: zvětší font textových polí o 15 %. 
    // Děláme to po načtení DOM - vezmeme aktuální CSS font-size a vynásobíme 1.15.
    enlargeTextareaFonts() {
        for (let i = 1; i <= 2; i++) {
            const textArea = document.getElementById(`textArea${i}`);
            if (!textArea) continue;
            
            // Aktuální výsledná velikost (v px) z CSS:
            const computed = window.getComputedStyle(textArea).fontSize;
            const currentPx = parseFloat(computed);
            
            if (Number.isFinite(currentPx) && currentPx > 0) {
                const newPx = (currentPx * 1.15).toFixed(2);
                textArea.style.fontSize = `${newPx}px`;
                console.log(`[TTS] textArea${i} font: ${currentPx}px → ${newPx}px (+15%)`);
            }
        }
    }

    // Zobrazí verzi kódu v titulku okna a v UI.
    // Slouží k ověření, že Safari/PWA cache načetla aktuální verzi -
    // při každé úpravě stačí zvýšit konstantu APP_VERSION na začátku
    // souboru a verze se promítne všude.
    injectVersionBadge() {
        // 1) Titulek okna (Safari tab title)
        const originalTitle = document.title || 'TTS';
        document.title = `${originalTitle} v${APP_VERSION}`;
        
        // 2) Vizuální badge v rohu obrazovky - fixed pozice,
        //    aby fungovala bez ohledu na strukturu HTML
        if (document.getElementById('appVersionBadge')) return;
        
        const badge = document.createElement('div');
        badge.id = 'appVersionBadge';
        badge.textContent = `v${APP_VERSION}`;
        badge.style.cssText = `
            position: fixed;
            bottom: 4px;
            right: 8px;
            font-size: 10px;
            color: rgba(128, 128, 128, 0.7);
            font-family: -apple-system, monospace;
            pointer-events: none;
            z-index: 9999;
            user-select: none;
        `;
        document.body.appendChild(badge);
        
        // 3) Console log - pro Web Inspector
        console.log(`[TTS] App version: ${APP_VERSION}`);
    }

    // EXPERIMENT: dynamicky přidá přepínač "Pauza" vedle Rychlosti.
    // Umožňuje za běhu měnit délku <break time='Xms'/> v SSML a porovnat
    // latenci. Hodnota se ukládá do localStorage pod klíčem 'breakTimeMs'.
    injectBreakTimeSelector() {
        // Najdeme rateSelect a vložíme nový label+select hned za něj
        const rateSelect = document.getElementById('rateSelect');
        if (!rateSelect) {
            console.warn('[TTS] rateSelect nenalezen, přepínač pauzy nepřidán');
            return;
        }
        
        // Pokud už existuje, nepřidáme znovu (např. po hot-reloadu)
        if (document.getElementById('breakTimeSelect')) return;
        
        // Label
        const label = document.createElement('label');
        label.setAttribute('for', 'breakTimeSelect');
        label.style.marginLeft = '12px';
        label.textContent = 'Pauza:';
        
        // Select
        const select = document.createElement('select');
        select.id = 'breakTimeSelect';
        // Použijeme stejné CSS třídy jako sousední select, pokud existují
        select.className = rateSelect.className;
        
        const options = [
            { value: '0',   label: '0 ms (nejrychlejší)' },
            { value: '50',  label: '50 ms (kompromis)' },
            { value: '100', label: '100 ms' },
            { value: '200', label: '200 ms (originál)' }
        ];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        
        // Načíst uloženou hodnotu nebo výchozích 50
        const saved = localStorage.getItem('breakTimeMs') ?? '50';
        select.value = saved;
        
        // Uložit při změně
        select.addEventListener('change', (e) => {
            localStorage.setItem('breakTimeMs', e.target.value);
            console.log('[TTS] Break time changed to:', e.target.value, 'ms');
        });
        
        // Vložíme za rateSelect (na stejnou úroveň v DOM)
        rateSelect.insertAdjacentElement('afterend', select);
        rateSelect.insertAdjacentElement('afterend', label);
        
        console.log('[TTS] Break time selector přidán, aktuální hodnota:', saved, 'ms');
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
                    case 'stop':
                        // NOVÉ: STOP tlačítko
                        this.stopSpeaking();
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
        // Klávesové zkratky:
        //   Control+Command+V  = Speak All
        //   Control+Command+B  = Speak Selection
        //   Control+Command+S  = STOP   (primární)
        //   Control+Command+X  = STOP   (záloha - Cmd+S Safari na iPadu zachytává)
        //   Escape             = STOP   (záloha - vždy funguje)
        //
        // Safari na iPadu blokuje Cmd+S na úrovni systému (Save Page).
        // Proto:
        //   1) Používáme CAPTURE fázi (true) - listener se spustí dřív než Safari.
        //   2) Detekce přes e.code (fyzická klávesa) místo e.key.
        //   3) Přidány záložní zkratky, které Safari nezachytává.
        //   4) preventDefault() + stopPropagation() pro maximální spolehlivost.
        
        const handler = (e) => {
            // Diagnostický log - uvidíte v Safari Web Inspectoru,
            // co přesně zařízení posílá při každém stisku s modifikátory.
            if (e.ctrlKey || e.metaKey) {
                console.log('[TTS][KEY]', {
                    key: e.key,
                    code: e.code,
                    ctrl: e.ctrlKey,
                    meta: e.metaKey,
                    shift: e.shiftKey,
                    alt: e.altKey
                });
            }
            
            const isCtrlCmd = (e.ctrlKey && e.metaKey);
            
            // === STOP zkratky ===
            // 1) Esc - vždy STOP, žádné modifikátory
            if (e.code === 'Escape' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.stopSpeaking();
                console.log('[TTS] Keyboard shortcut: STOP (Esc)');
                return;
            }
            
            if (!isCtrlCmd) return;
            
            // 2) Ctrl+Cmd+S (primární, ale Safari ho může blokovat)
            if (e.code === 'KeyS') {
                e.preventDefault();
                e.stopPropagation();
                this.stopSpeaking();
                console.log('[TTS] Keyboard shortcut: STOP (Ctrl+Cmd+S)');
                return;
            }
            
            // 3) Ctrl+Cmd+X (záložní pro STOP)
            if (e.code === 'KeyX') {
                e.preventDefault();
                e.stopPropagation();
                this.stopSpeaking();
                console.log('[TTS] Keyboard shortcut: STOP (Ctrl+Cmd+X)');
                return;
            }
            
            // === Speak zkratky ===
            if (e.code === 'KeyV') {
                e.preventDefault();
                e.stopPropagation();
                this.speakAll(this.activeWindow);
                console.log('[TTS] Keyboard shortcut: Speak All (Ctrl+Cmd+V)');
                return;
            }
            
            if (e.code === 'KeyB') {
                e.preventDefault();
                e.stopPropagation();
                this.speakSelection(this.activeWindow);
                console.log('[TTS] Keyboard shortcut: Speak Selection (Ctrl+Cmd+B)');
                return;
            }
        };
        
        // CAPTURE fáze (třetí parametr = true) - listener se spustí
        // při sestupu eventu, tedy dřív než case-listener Safari na <body>.
        // To je klíčový trik pro obejití systémových zkratek.
        document.addEventListener('keydown', handler, true);
        
        // Pro jistotu i v bubble fázi - kdyby capture něco propustilo.
        document.addEventListener('keydown', handler, false);
        
        console.log('[TTS] Keyboard shortcuts registered (capture + bubble)');
    }
    
    // Označí synthesizer jako "stale" (= pravděpodobně rozbité spojení),
    // když uživatel přepne pryč z aplikace nebo iPad uspí obrazovku.
    // Při dalším pokusu o přehrání ho synthesizeSpeech automaticky obnoví.
    //
    // Důvod: po probuzení iPadu nebo návratu z jiné aplikace iOS Safari
    // často přeruší WebSocket k Azure, ale SDK to nedetekuje a tváří se OK.
    setupStalenessDetection() {
        // visibilitychange = uživatel přepnul tab, minimalizoval Safari,
        // uzamkl iPad, nebo se vrátil
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                console.log('[TTS] Aplikace přešla na pozadí');
                this._lastHiddenAt = Date.now();
            } else if (document.visibilityState === 'visible') {
                const hiddenMs = this._lastHiddenAt
                    ? (Date.now() - this._lastHiddenAt)
                    : 0;
                console.log(`[TTS] Aplikace se vrátila do popředí (bylo skryté ${Math.round(hiddenMs / 1000)}s)`);
                
                // Pokud byla aplikace na pozadí déle než 10 sekund,
                // synthesizer je téměř jistě v podezřelém stavu
                if (hiddenMs > 10 * 1000) {
                    this._synthesizerStale = true;
                    console.log('[TTS] Synthesizer označen jako stale - bude obnoven při dalším použití');
                }
            }
        });
        
        // pageshow s persisted=true = stránka se vrátila z bfcache (back/forward cache)
        // To znamená, že JS běh byl pozastaven a teď ožil - vše může být v podivném stavu
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) {
                console.log('[TTS] Stránka obnovena z bfcache - označuji synthesizer jako stale');
                this._synthesizerStale = true;
            }
        });
        
        console.log('[TTS] Staleness detection setup complete');
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
    
    // Zastaví probíhající přehrávání.
    //
    // PROBLÉM: Azure SDK stáhne celé audio a předá ho prohlížeči k přehrání.
    // synthesizer.close() zastaví jen budoucí syntézu, ne přehrávání audia,
    // které už hraje. Audio přehrává <audio> element nebo Web Audio API,
    // a ten musíme zastavit sami.
    //
    // ŘEŠENÍ: Útočíme z více stran současně:
    //   1) Zastavíme všechny <audio>/<video> elementy v dokumentu.
    //   2) Pokud běží AudioContext (Web Audio API), pozastavíme ho.
    //   3) Pokud SDK uchovává interní player, voláme jeho pause/close.
    //   4) Zavřeme synthesizer a vytvoříme nový pro další použití.
    stopSpeaking() {
        console.log('[TTS] stopSpeaking called');
        
        let stoppedSomething = false;
        
        // === 1) Zastavit všechny HTML audio/video elementy ===
        // Azure SDK někdy vytváří <audio> element a přidává ho do DOM.
        try {
            const mediaElements = document.querySelectorAll('audio, video');
            mediaElements.forEach((el, idx) => {
                if (!el.paused) {
                    el.pause();
                    stoppedSomething = true;
                    console.log(`[TTS] Pozastaven media element #${idx}`);
                }
                // Reset pozice, ať se nepokouší pokračovat
                try { el.currentTime = 0; } catch (_) {}
                // Odpojit zdroj
                try { el.src = ''; el.removeAttribute('src'); el.load(); } catch (_) {}
            });
            console.log(`[TTS] Zkontrolováno ${mediaElements.length} media elementů`);
        } catch (e) {
            console.warn('[TTS] Chyba při zastavování media elementů:', e);
        }
        
        // === 2) Pozastavit globální AudioContexty ===
        // Web Audio API - SDK nebo prohlížeč mohou používat AudioContext.
        // V iOS Safari je obvykle jen jeden globální kontext.
        try {
            // Některé SDK nechávají kontext na window.audioContext nebo podobně
            const possibleContexts = [
                window.audioContext,
                window.AudioContext && this._lastAudioContext,
            ].filter(Boolean);
            
            possibleContexts.forEach((ctx, idx) => {
                if (ctx && typeof ctx.suspend === 'function' && ctx.state === 'running') {
                    ctx.suspend();
                    stoppedSomething = true;
                    console.log(`[TTS] Pozastaven AudioContext #${idx}`);
                }
            });
        } catch (e) {
            console.warn('[TTS] Chyba při suspend AudioContextu:', e);
        }
        
        // === 3) Sáhnout do synthesizeru a najít interní player ===
        // Azure SDK má interní strukturu - zkusíme najít a zastavit
        // jejich audio destination. Toto je hack, ale pomáhá.
        try {
            if (this.synthesizer) {
                // Audio config se na synthesizeru drží pod různými jmény
                const candidates = [
                    this.synthesizer.privAudioConfig,
                    this.synthesizer.audioConfig,
                    this.synthesizer.privAdapter,
                ];
                
                candidates.forEach((obj) => {
                    if (!obj) return;
                    // Hledáme jakýkoli vnořený objekt s pause/close metodou
                    Object.values(obj).forEach((val) => {
                        if (val && typeof val === 'object') {
                            if (typeof val.pause === 'function') {
                                try { val.pause(); stoppedSomething = true; } catch (_) {}
                            }
                            if (typeof val.close === 'function' && val !== this.synthesizer) {
                                try { val.close(); stoppedSomething = true; } catch (_) {}
                            }
                        }
                    });
                });
            }
        } catch (e) {
            // SDK internals jsou nestabilní mezi verzemi - chyba je ok
            console.log('[TTS] Internal SDK probe failed (ok):', e.message);
        }
        
        // === 4) Zavřít a znovu vytvořit synthesizer ===
        if (this.synthesizer) {
            try {
                this.synthesizer.close();
                console.log('[TTS] Synthesizer closed');
                stoppedSomething = true;
            } catch (e) {
                console.warn('[TTS] Chyba při close() synthesizeru:', e);
            }
            this.synthesizer = null;
        }
        
        this.isSynthesizing = false;
        
        // Vytvoříme nový synthesizer pro další použití
        if (this.speechConfig) {
            try {
                this.createSynthesizer();
            } catch (e) {
                console.error('[TTS] Nelze znovu vytvořit synthesizer:', e);
            }
        }
        
        this.updateStatus('Zastaveno', 'success');
        this.showToast(
            stoppedSomething ? 'Přehrávání zastaveno' : 'Nic nehraje',
            'success'
        );
        
        console.log('[TTS] stopSpeaking done, stoppedSomething=', stoppedSomething);
    }
    
    ensureAudioUnlocked() {
        // Safari requires user interaction to play audio
        // This method is called from button clicks, which satisfies that requirement
        // No additional action needed, but keeping this for clarity
        console.log('[TTS] Audio unlock check - called from user interaction');
    }

    async synthesizeSpeech(text) {
        console.log('[TTS] synthesizeSpeech called');
        console.log('[TTS] Text length:', text.length);
        console.log('[TTS] Is synthesizing:', this.isSynthesizing);
        
        // Check if already synthesizing
        if (this.isSynthesizing) {
            console.warn('[TTS] Synthesis already in progress, ignoring request');
            this.showToast('Čekejte na dokončení předchozího přehrávání', 'warning');
            return;
        }
        
        if (!this.speechConfig) {
            console.error('[TTS] SpeechConfig not initialized!');
            this.showToast('Azure TTS není inicializován. Zkontrolujte credentials.', 'error');
            this.showConfigModal();
            return;
        }
        
        // CHYTRÁ OBNOVA SYNTHESIZERU:
        // Synthesizer obnovíme JEN když je potřeba - jinak používáme stávající
        // (nízká latence). Důvody pro obnovu:
        //   1) Synthesizer neexistuje (úplně první volání nebo po stop_speaking)
        //   2) Idle - od posledního úspěšného přehrání uplynulo víc než 5 minut
        //      (WebSocket k Azure mohl spadnout)
        //   3) "stale" flag - aplikace zaregistrovala návrat z pozadí / probuzení
        //      iPadu, takže staré spojení je podezřelé
        const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minut
        const now = Date.now();
        const idleMs = this._lastSuccessfulSynthAt
            ? (now - this._lastSuccessfulSynthAt)
            : Infinity;
        
        const needFresh = (
            !this.synthesizer ||
            this._synthesizerStale ||
            idleMs > IDLE_LIMIT_MS
        );
        
        if (needFresh) {
            const reason = !this.synthesizer ? 'neexistuje'
                : this._synthesizerStale ? 'stale (návrat z pozadí)'
                : `idle ${Math.round(idleMs / 1000)}s > ${IDLE_LIMIT_MS / 1000}s`;
            console.log(`[TTS] Obnovuji synthesizer - důvod: ${reason}`);
            
            // Zavřeme starý, pokud existuje
            if (this.synthesizer) {
                try {
                    this.synthesizer.close();
                } catch (e) {
                    console.warn('[TTS] Chyba při zavírání starého synthesizeru:', e);
                }
                this.synthesizer = null;
            }
            
            try {
                this.createSynthesizer();
                this._synthesizerStale = false;
            } catch (e) {
                console.error('[TTS] Nelze vytvořit nový synthesizer:', e);
                this.showToast('Chyba při vytváření syntetizéru', 'error');
                return;
            }
        } else {
            console.log(`[TTS] Používám existující synthesizer (idle ${Math.round(idleMs / 1000)}s)`);
        }
        
        console.log('[TTS] Starting synthesis...');
        console.log('[TTS] First 100 chars:', text.substring(0, 100));
        
        this.lastText = text;
        this.isSynthesizing = true;  // Set flag
        
        // Get selected voice and rate
        const voiceId = document.getElementById('voiceSelect').value;
        const rate = document.getElementById('rateSelect').value;
        
        // Derive locale from voice ID
        const locale = this.getLocaleFromVoice(voiceId);
        
        console.log('[TTS] Voice ID:', voiceId);
        console.log('[TTS] Derived locale:', locale);
        console.log('[TTS] Rate:', rate);
        
        // Escape XML special characters
        const safeText = this.escapeXml(text);
        
        // Konfigurovatelná úvodní pauza (experiment s latencí).
        // Hodnoty: 0 = bez pauzy, 50 = krátká, 200 = standard (původní)
        // Výchozí 50 ms - kompromis mezi rychlostí a bezpečností proti oříznutí první slabiky.
        const breakMs = parseInt(localStorage.getItem('breakTimeMs') ?? '50', 10);
        const breakTag = breakMs > 0 ? `<break time='${breakMs}ms'/>` : '';
        
        const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${locale}'>
    <voice name='${voiceId}'>
        ${breakTag}
        <prosody rate='${rate}'>${safeText}</prosody>
    </voice>
</speak>
        `.trim();
        
        console.log('[TTS] Break time:', breakMs, 'ms');
        
        console.log('[TTS] SSML prepared');
        console.log('[TTS] Voice:', voiceId);
        console.log('[TTS] Locale:', locale);
        console.log('[TTS] Rate:', rate);
        console.log('[TTS] Text preview:', text.substring(0, 50));
        
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
                            
                            // Zaznamenat čas posledního úspěchu - používá se
                            // pro idle detekci (po 5 minutách obnovíme synthesizer)
                            this._lastSuccessfulSynthAt = Date.now();
                            
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
