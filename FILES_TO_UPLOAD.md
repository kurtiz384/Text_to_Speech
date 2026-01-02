# 📦 Soubory k nahrání na GitHub

## ✅ TYTO SOUBORY NAHRAJTE

### Hlavní aplikační soubory:
```
✅ index.html          (6.5 KB)  - Hlavní HTML stránka
✅ app.js              (24 KB)   - JavaScript logika
✅ styles.css          (14 KB)   - CSS design pro iPad
✅ manifest.json       (637 B)   - PWA manifest
✅ service-worker.js   (3.5 KB)  - Offline podpora
```

### Ikony:
```
✅ icon-192.png        (3.9 KB)  - PWA ikona 192x192
✅ icon-512.png        (11 KB)   - PWA ikona 512x512
```

### Bezpečnost:
```
✅ .gitignore          (749 B)   - Chrání config.json před nahráním
```

### Dokumentace (volitelné, ale doporučené):
```
✅ README.md                     - Kompletní dokumentace
✅ GITHUB_SECURE_DEPLOY.md       - Návod na bezpečné nasazení
✅ IPAD_SETUP.md                 - Průvodce pro iPad
✅ QUICK_START.md                - Rychlý start
✅ TIPS_AND_TRICKS.md            - Tipy pro výkon
✅ TROUBLESHOOTING.md            - Řešení problémů
```

### Pomocné nástroje (volitelné):
```
✅ debug.html          (14 KB)   - Nástroj pro diagnostiku
✅ generate-icons.html (4.1 KB)  - Generátor ikon
```

---

## ❌ TENTO SOUBOR NENAHRÁVEJTE!

```
❌ config.json         - OBSAHUJE VAŠE AZURE CREDENTIALS!
```

**Proč ne?**
- Obsahuje váš Azure Key
- Veřejně dostupný = kdokoliv by mohl využívat váš Azure účet
- Platili byste za cizí použití!

**Co místo toho?**
- Credentials zadáte až v běžící aplikaci na iPadu
- Uloží se POUZE lokálně do vašeho Safari
- Nikdo jiný k nim nemá přístup

---

## 📁 Struktura po nahrání na GitHub

```
your-repository/
├── .gitignore              ✅ Nahrát
├── index.html              ✅ Nahrát
├── app.js                  ✅ Nahrát
├── styles.css              ✅ Nahrát
├── manifest.json           ✅ Nahrát
├── service-worker.js       ✅ Nahrát
├── icon-192.png            ✅ Nahrát
├── icon-512.png            ✅ Nahrát
├── README.md               ✅ Nahrát
├── GITHUB_SECURE_DEPLOY.md ✅ Nahrát
├── IPAD_SETUP.md           ✅ Nahrát
├── debug.html              ✅ Nahrát (volitelné)
└── (ostatní .md soubory)   ✅ Nahrát (volitelné)

config.json                 ❌ NENAHRÁVAT!!!
```

---

## 🔒 Jak .gitignore chrání config.json

Soubor `.gitignore` obsahuje:
```
# Azure credentials
config.json
```

**To znamená:**
- Git AUTOMATICKY ignoruje config.json
- Nemůžete ho nahrát ani omylem
- I kdybyste ho přidali, Git ho přeskočí

**Test:**
Zkuste v příkazové řádce:
```bash
git add config.json
# Vrátí: "The following paths are ignored by one of your .gitignore files"
```

---

## 📤 Postup nahrání

### Metoda 1: GitHub Web Interface (doporučeno)

1. **Vytvořte repository** na github.com
2. Klikněte **"Add file"** → **"Upload files"**
3. **Přetáhněte všechny soubory KROMĚ config.json**
4. GitHub automaticky respektuje .gitignore
5. **"Commit changes"**
6. ✅ Hotovo!

### Metoda 2: Git příkazová řádka

```bash
# V terminálu:
cd /cesta/k/aplikaci

# Inicializace Git (pokud ještě není)
git init

# Přidat všechny soubory (config.json se přeskočí díky .gitignore)
git add .

# Commit
git commit -m "Initial commit - Azure TTS PWA"

# Připojit k GitHub repository
git remote add origin https://github.com/VASE-JMENO/VASE-REPO.git

# Nahrát
git push -u origin main
```

**Výsledek:**
- Všechny soubory KROMĚ config.json budou na GitHubu
- config.json zůstane POUZE na vašem počítači

---

## ✅ Kontrola po nahrání

Po nahrání na GitHub zkontrolujte:

1. **Jděte do vašeho repository na github.com**
2. **Klikněte na "Code" tab**
3. **Měli byste vidět:**
   ```
   ✅ .gitignore
   ✅ index.html
   ✅ app.js
   ✅ styles.css
   ✅ manifest.json
   ✅ service-worker.js
   ✅ icon-192.png
   ✅ icon-512.png
   ✅ Všechny .md soubory
   ```

4. **NEMĚLI byste vidět:**
   ```
   ❌ config.json  ← pokud ho vidíte, OKAMŽITĚ ho smažte!
   ```

### Pokud omylem nahrajete config.json:

**1. Smažte ho z repository:**
```bash
git rm config.json
git commit -m "Remove config.json with credentials"
git push
```

**2. Vygenerujte NOVÝ Azure Key:**
- Starý key je kompromitovaný!
- Azure Portal → Speech Service → Keys and Endpoint
- Klikněte "Regenerate Key 1"
- Použijte nový key

---

## 🎯 Shrnutí

**Co nahrát:**
- ✅ Všechny soubory aplikace
- ✅ .gitignore (chrání config.json)
- ✅ Dokumentaci (.md soubory)

**Co NEnahrát:**
- ❌ config.json s Azure credentials

**Výsledek:**
- 🔒 Vaše credentials jsou v bezpečí
- 🌍 Aplikace je veřejně dostupná
- 👥 Můžete sdílet URL (každý si zadá své credentials)
- 📱 Funguje perfektně na iPadu

---

**Jste připraveni nahrát na GitHub! 🚀**

Pokračujte podle **GITHUB_SECURE_DEPLOY.md** pro kompletní návod.
