# Projektové výkaznictví

React/Vite aplikace pro evidenci a reporting projektu podle KA01, KA02 a KA03.

## Spuštění

```powershell
npm install
npm run dev
```

Produkční build:

```powershell
npm run build
```

## AI klíč

Generátor dokumentů používá Google Gemini API. Klíč se načítá z lokálního `.env` souboru:

```powershell
Copy-Item .env.example .env
```

Potom v `.env` nahraďte hodnotu `VITE_GEMINI_API_KEY` vlastním klíčem z Google AI Studio.

Po změně `.env` je nutné restartovat vývojový server:

```powershell
Ctrl + C
npm run dev
```

## Automatické ukládání zápisů na Google Disk

1. Otevřete Google Apps Script a vytvořte nový projekt.
2. Do souboru `Code.gs` vložte obsah souboru `google-drive-upload.apps-script.js`.
3. Zvolte `Deploy` -> `New deployment` -> typ `Web app`.
4. Nastavte `Execute as` na vlastní účet a `Who has access` podle potřeby na uživatele, kteří aplikaci používají.
5. Zkopírujte Web app URL a vložte ji do `.env`:

```powershell
VITE_GOOGLE_DRIVE_UPLOAD_URL=https://script.google.com/macros/s/.../exec
```

Po změně `.env` restartujte Vite server. Pokud URL není nastavená, aplikace ukládá pouze do interní evidence. Selhání Google Disku neblokuje uložení záznamu v aplikaci.

## Sdilena databaze Firestore

Bez Firebase konfigurace aplikace uklada data jen lokalne do prohlizece. Pro sdileni mezi pocitaci nastavte Firebase Web App a Firestore.

Do `.env` doplnte hodnoty z Firebase konzole:

```powershell
VITE_APP_ID=projektove-vykaznictvi
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Zaznamy aplikace se ukladaji do sdilene projektove cesty:

```text
artifacts/{VITE_APP_ID}/public/data/projectRecords
```

Po zmene `.env` restartujte Vite server.

### Rychly postup Firebase

1. Otevri [Firebase Console](https://console.firebase.google.com/).
2. Vytvor novy projekt.
3. V projektu zapni `Cloud Firestore`.
4. Zaloz `Web App`.
5. Z konfigurace zkopiruj hodnoty do `.env`:

```powershell
VITE_APP_ID=projektove-vykaznictvi
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

6. Firestore pravidla nastav alespon pro prihlasene uzivatele:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/projectRecords/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

7. Restartuj aplikaci:

```powershell
Ctrl + C
npm run dev
```

Pro maly provoz obvykle staci bezplatny Firebase Spark plan.

## Struktura

- `src/app/ProjectReportingApp.jsx` - hlavní aplikace a moduly KA.
- `src/config/projectConfig.js` - cíle indikátorů, pohledy a výchozí formuláře.
- `src/components/ui.jsx` - sdílené UI komponenty.
- `src/lib/firebase.js` - Firebase inicializace.
- `src/lib/projectUtils.js` - helpery pro klienty, indikátory, exporty a záznamy.
