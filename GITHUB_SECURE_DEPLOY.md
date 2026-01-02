# 🔐 GitHub Pages - Bezpečné nasazení BEZ config.json

## ✅ Tento přístup je 100% bezpečný

Vaše Azure credentials **NIKDY** nebudou na GitHubu. Zadáte je až v běžící aplikaci na iPadu a uloží se **POUZE** lokálně ve vašem zařízení.

---

## 📋 Krok za krokem

### Krok 1: Připravte soubory k nahrání

**NAHRAJTE NA GITHUB:**
- ✅ `index.html`
- ✅ `app.js`
- ✅ `styles.css`
- ✅ `manifest.json`
- ✅ `service-worker.js`
- ✅ `icon-192.png`
- ✅ `icon-512.png`
- ✅ `.gitignore` (tento soubor chrání config.json)
- ✅ Všechny `.md` soubory (dokumentace)
- ✅ `debug.html` (volitelně - pro testování)

**NENAHRÁVEJTE NA GITHUB:**
- ❌ `config.json` - tento soubor VYNECHTE!

---

### Krok 2: Vytvořte GitHub repository

1. Jděte na **https://github.com**
2. Přihlaste se (nebo vytvořte účet na https://github.com/signup)
3. Klikněte na **"+"** vpravo nahoře → **"New repository"**

4. **Vyplňte:**
   - **Repository name:** `azure-tts` (nebo jakýkoliv název)
   - **Description:** (volitelné) "Azure Text-to-Speech PWA for iPad"
   - **Public** ✅ (pro GitHub Pages zdarma)
   - **Add a README file** ✅

5. Klikněte **"Create repository"**

---

### Krok 3: Nahrajte soubory

1. V repository klikněte **"Add file"** → **"Upload files"**

2. **Přetáhněte tyto soubory** (nebo klikněte "choose your files"):
   ```
   index.html
   app.js
   styles.css
   manifest.json
   service-worker.js
   icon-192.png
   icon-512.png
   .gitignore
   README.md
   IPAD_SETUP.md
   QUICK_START.md
   (+ ostatní .md soubory pokud chcete)
   ```

3. ⚠️ **DŮLEŽITÉ: NEKOPÍRUJTE config.json!**
   - Soubor `.gitignore` automaticky zajistí, že config.json nebude nikdy nahrán
   - Vaše Azure credentials zůstanou v bezpečí

4. V poli **"Commit changes"** napište: `Initial commit`

5. Klikněte **"Commit changes"**

---

### Krok 4: Zapněte GitHub Pages

1. V repository jděte do **Settings** (nahoře)

2. V levém menu klikněte **"Pages"**

3. V sekci **"Source"**:
   - **Branch:** vyberte `main` (nebo `master`)
   - **Folder:** vyberte `/ (root)`

4. Klikněte **"Save"**

5. **Počkejte 1-2 minuty** - GitHub build váš web

6. Obnovte stránku - uvidíte zprávu:
   ```
   Your site is live at https://vase-jmeno.github.io/azure-tts
   ```

---

### Krok 5: Otevřete na iPadu

1. **Zkopírujte URL** z GitHub Pages (např. `https://honza123.github.io/azure-tts`)

2. **Na iPadu:**
   - Otevřete **Safari**
   - Vložte URL do adresního řádku
   - Stránka se načte

3. **Objeví se modal "Konfigurace Azure":**
   ```
   Zadejte Azure Speech Service credentials:
   
   Azure Key: [_________________________]
   Azure Region: [westeurope___________]
   
   [Uložit] [Zrušit]
   ```

4. **Zadejte vaše credentials:**
   - **Azure Key:** váš skutečný klíč z Azure Portal
   - **Azure Region:** např. `westeurope`

5. Klikněte **"Uložit"**

6. ✅ **Credentials se uloží do localStorage** (lokálně na iPadu)
   - POUZE ve vašem prohlížeči
   - NIKDY se neodešlou na GitHub
   - Zůstanou na iPadu i po zavření aplikace

---

### Krok 6: Přidejte na plochu (PWA)

1. V Safari klikněte **"Share"** (čtverec se šipkou)
2. Scrollujte dolů → **"Add to Home Screen"**
3. Pojmenujte: "TTS" nebo "Azure TTS"
4. Klikněte **"Add"**
5. ✅ Ikona se objeví na ploše!

---

## 🔐 Jak to funguje (zabezpečení)

### Co se děje s credentials:

1. **Zadáte je na iPadu** → ukládají se do `localStorage`
2. **localStorage** = lokální úložiště Safari na iPadu
3. **Data NIKDY neopouští iPad**
4. **GitHub neví o vašich credentials**
5. **Nikdo jiný nemá přístup** (ani když má URL aplikace)

### Pokud někdo jiný použije vaši aplikaci:

```
Scénář: Pošlete URL kamarádovi
↓
Kamarád otevře URL v Safari
↓
Zobrazí se mu modal pro zadání credentials
↓
Musí zadat SVOJE Azure credentials
↓
Jeho credentials se uloží do JEHO prohlížeče
↓
Vaše credentials zůstávají POUZE ve vašem iPadu
```

**✅ Bezpečné pro sdílení!**

---

## 🛠️ Jak získat Azure Credentials

### Máte již Azure účet?

**ANO:**

1. Jděte na **https://portal.azure.com**
2. Přihlaste se
3. V horním vyhledávání: **"Speech Services"**
4. Klikněte na váš Speech Service
5. V levém menu: **"Keys and Endpoint"**
6. Zkopírujte:
   - **KEY 1** (dlouhý řetězec písmen a čísel)
   - **LOCATION/REGION** (např. `westeurope`, `northeurope`)

**NE:**

1. **Vytvořte účet:** https://azure.microsoft.com/free
   - Vyžaduje kreditní kartu pro verifikaci
   - Ale dostanete $200 kredit zdarma!
   - Speech Service má navíc Free tier (500k znaků/měsíc zdarma)

2. **Po registraci vytvořte Speech Service:**
   - V Azure Portal vyhledejte: **"Speech Services"**
   - Klikněte **"Create"**
   - **Resource group:** vytvořte nový (např. "tts-resources")
   - **Region:** **West Europe** (pro ČR/SK nejblíž)
   - **Pricing tier:** **Free F0** ← důležité!
   - Klikněte **"Review + create"** → **"Create"**

3. **Získejte credentials:**
   - Po vytvoření: **"Go to resource"**
   - **"Keys and Endpoint"**
   - Zkopírujte KEY 1 a REGION

---

## 🔄 Aktualizace aplikace

Pokud budete chtít později změnit aplikaci:

1. V GitHub repository klikněte na soubor (např. `app.js`)
2. Klikněte ikonu tužky (Edit)
3. Upravte kód
4. **"Commit changes"**
5. GitHub Pages se automaticky aktualizuje za 1-2 minuty
6. Na iPadu refreshujte stránku (nebo zavřete a otevřete app)

---

## ❓ Co když zapomenu credentials?

### Chcete smazat uložené credentials:

1. Otevřete aplikaci na iPadu
2. Otevřete Safari DevTools (pokud máte):
   - Safari → Develop → iPad → console
   - Napište: `localStorage.clear()`

Nebo:

1. V Safari: Settings → Safari → Advanced → Website Data
2. Najděte vaši stránku
3. Swipe vlevo → Delete

### Chcete změnit credentials:

Stejný postup jako výše, pak refreshujte stránku → modal se objeví znovu

---

## 📱 Testování před nahráním na GitHub

Chcete otestovat lokálně před nahráním?

### Možnost 1: Přes lokální soubor
1. Otevřete `index.html` přímo v prohlížeči
2. Modal se objeví
3. Zadejte credentials
4. Testujte!

### Možnost 2: Přes lokální server
```bash
# V terminále (Mac/PC):
cd /cesta/k/aplikaci
python3 -m http.server 8000
```

Pak otevřete: `http://localhost:8000`

---

## ✅ Kontrolní seznam

Před nahráním na GitHub zkontrolujte:

- [ ] Mám všechny soubory KROMĚ config.json
- [ ] Soubor `.gitignore` obsahuje řádek `config.json`
- [ ] Vytvořil jsem GitHub repository
- [ ] Nahrál jsem soubory (BEZ config.json)
- [ ] Zapnul jsem GitHub Pages v Settings
- [ ] Mám Azure credentials připravené (Key + Region)

Po nasazení:

- [ ] Otevřel jsem URL na iPadu
- [ ] Modal se objevil
- [ ] Zadal jsem credentials
- [ ] Aplikace funguje
- [ ] Přidal jsem na plochu
- [ ] Testoval jsem čtení textu

---

## 🎉 Hotovo!

Máte:
- ✅ Aplikaci na GitHub Pages (s HTTPS)
- ✅ Plně funkční PWA na iPadu
- ✅ Bezpečné credentials (POUZE na iPadu)
- ✅ Možnost sdílet URL (každý si zadá své credentials)
- ✅ Automatické aktualizace přes GitHub

**Vaše Azure credentials jsou v bezpečí!** 🔐
