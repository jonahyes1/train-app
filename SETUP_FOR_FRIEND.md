# Build Your Own Train App — Step-by-Step Setup

This guide gets you a personal workout tracker exactly like the one I built, but with **your own data** in **your own Google Sheet**, hosted on **your own free GitHub site**. No coding required — just clicking, copying, and pasting.

**Total time:** ~30 minutes. If you get stuck on any step, see the **"Use Claude Pro for help"** section at the bottom — it tells you exactly what to paste so your Claude can debug for you.

---

## What you'll end up with

- A workout app that lives at `your-username.github.io/train-app/`
- A Google Sheet that holds every set you ever log (you own all the data)
- A "Train" icon on your iPhone home screen — works like a real app
- $0/month forever to run it

---

## Before you start — what you need

- A **Google account** (Gmail counts)
- A **GitHub account** — sign up free at https://github.com/signup if you don't have one
- A **computer** for the initial setup (you'll use your phone afterwards)
- ~30 minutes of focus

---

## Phase 1 — Get your own copy of the app code (5 min)

### Step 1.1 — Open the template repo

Click here: **https://github.com/Thekidriv/train-app**

You should see a page full of code files. **Look for a green button at the top right that says "Use this template"** (it's near the green "Code" button).

> If you don't see "Use this template" — message the friend who sent you this guide. They need to enable it in their repo settings (Settings → check "Template repository").

### Step 1.2 — Click "Use this template" → "Create a new repository"

GitHub will ask you a few things:
- **Repository name:** type `train-app` (or whatever you want — keep it lowercase, no spaces)
- **Public or Private:** pick **Public** (this is required for free hosting)
- Leave everything else as defaults
- Click the green **"Create repository"** button at the bottom

GitHub will spin for ~10 seconds and then you'll be on YOUR new repo page.

### Step 1.3 — Turn on free hosting (GitHub Pages)

Still on your new repo page:

1. Click the **"Settings"** tab at the top of the page (with a gear icon)
2. In the left sidebar, click **"Pages"**
3. Under **"Source"**, click the dropdown and pick **"GitHub Actions"**
4. That's it — just leave that page

Your site is now building. It takes about 60 seconds. Don't refresh — just wait.

### Step 1.4 — Find your live URL

1. Click the **"Actions"** tab at the top of your repo
2. You'll see a workflow called "Deploy to GitHub Pages" — wait for the green checkmark
3. Once green, click on it
4. Scroll down to the **"deploy"** job — it shows your URL

Or just guess your URL — it follows this pattern: `https://YOUR_USERNAME.github.io/train-app/`

For example, if your GitHub username is `mike_lifts`, your URL is `https://mike_lifts.github.io/train-app/`

**Open that URL in a browser tab.** You should see the Train app load up. It'll prompt you to enter an Apps Script URL — that's what we set up next.

---

## Phase 2 — Create your Google Sheet database (5 min)

### Step 2.1 — Create a fresh Google Sheet

1. Go to **https://sheets.new** (this creates a brand-new empty Sheet)
2. Click **"Untitled spreadsheet"** at the top-left and rename it to **"Train App Data"**

### Step 2.2 — Add the header row

Click cell **A1** and type these column names. **You must put each in its own column, exactly as written:**

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| date | workout_type | exercise | set_num | weight_kg | reps | rpe | notes | timestamp |

Easiest way: copy this entire line (including the tabs between words) and paste into cell A1:

```
date	workout_type	exercise	set_num	weight_kg	reps	rpe	notes	timestamp
```

Google Sheets will spread the words across columns A through I automatically.

That's it — your "database" exists. Don't add anything else.

---

## Phase 3 — Wire up the Apps Script "messenger" (10 min)

This is the part that lets your app read and write to your Sheet.

### Step 3.1 — Open Apps Script

Inside your Google Sheet:

1. Click **"Extensions"** in the menu bar
2. Click **"Apps Script"**
3. A new tab opens with a code editor — it'll have a tiny `function myFunction() {}` already there

### Step 3.2 — Replace ALL the code

1. In the Apps Script editor, click anywhere in the code area
2. Press **⌘A** (Mac) or **Ctrl+A** (Windows) to select everything
3. Press **Delete** to clear it all
4. Copy the entire block below (every line) and paste it in

```javascript
const SHEET_PASSWORD = 'CHANGE-THIS-TO-A-PASSWORD-YOU-PICK';

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1).map(row => {
    const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o;
  });
  const cb = e.parameter.callback;
  const payload = JSON.stringify(rows);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const pw = body.secret || body.password;
    if (pw !== SHEET_PASSWORD) {
      return ContentService.createTextOutput('unauthorized');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const values = sheet.getDataRange().getValues();
    const headers = values[0];

    if (!body.action && (body.date || body.exercise)) {
      sheet.appendRow([
        body.date || '', body.workout_type || '', body.exercise || '',
        body.set_num || '', body.weight_kg || '', body.reps || '',
        body.rpe || '', body.notes || '', new Date().toISOString(),
      ]);
      return ContentService.createTextOutput('OK');
    }

    const action = body.action || 'append';
    const rows = body.rows || (body.row ? [body.row] : []);

    const toArray = (r) => headers.map(h => {
      if (h === 'timestamp') return new Date().toISOString();
      return r[h] != null ? r[h] : '';
    });

    if (action === 'append') {
      rows.forEach(r => sheet.appendRow(toArray(r)));
      return _json({ ok: true, appended: rows.length });
    }

    if (action === 'upsert') {
      const keyFields = (body.upsertKey || 'date|workout_type|exercise|set_num').split('|');
      const existing = values.slice(1).map(row => {
        const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o;
      });
      const keyOf = function (o) {
        return keyFields.map(function (k) {
          return String(o[k] != null ? o[k] : '');
        }).join('');
      };
      let updated = 0, appended = 0;
      rows.forEach(function (r) {
        const idx = existing.findIndex(function (x) { return keyOf(x) === keyOf(r); });
        if (idx >= 0) {
          const rowNum = idx + 2;
          headers.forEach(function (h, i) {
            if (h === 'timestamp') sheet.getRange(rowNum, i + 1).setValue(new Date().toISOString());
            else if (r[h] !== undefined) sheet.getRange(rowNum, i + 1).setValue(r[h]);
          });
          updated++;
        } else {
          sheet.appendRow(toArray(r));
          appended++;
        }
      });
      return _json({ ok: true, updated: updated, appended: appended });
    }

    if (action === 'clean-duplicates') {
      const keyFields = ['date', 'workout_type', 'exercise', 'set_num'];
      const data = values.slice(1).map(function (row, i) {
        const o = { __row: i + 2 };
        headers.forEach(function (h, j) { o[h] = row[j]; });
        return o;
      });
      const keyOf = function (o) {
        return keyFields.map(function (k) {
          return String(o[k] != null ? o[k] : '');
        }).join('');
      };
      const groups = {};
      data.forEach(function (r) {
        const k = keyOf(r);
        if (!groups[k]) groups[k] = [];
        groups[k].push(r);
      });
      const toDelete = [];
      Object.keys(groups).forEach(function (k) {
        const group = groups[k];
        if (group.length <= 1) return;
        group.sort(function (a, b) {
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        group.slice(1).forEach(function (r) { toDelete.push(r.__row); });
      });
      toDelete.sort(function (a, b) { return b - a; });
      toDelete.forEach(function (rowNum) { sheet.deleteRow(rowNum); });
      return _json({ ok: true, deleted: toDelete.length, kept: Object.keys(groups).length });
    }

    return _json({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Step 3.3 — Set YOUR password

Look at the **very first line** of the code you just pasted:

```javascript
const SHEET_PASSWORD = 'CHANGE-THIS-TO-A-PASSWORD-YOU-PICK';
```

Replace `CHANGE-THIS-TO-A-PASSWORD-YOU-PICK` with a password of your choosing. Make it something only you know — letters, numbers, no spaces. Example:

```javascript
const SHEET_PASSWORD = 'MyGymPass2026';
```

**Write this password down somewhere safe.** You'll need to type it into the app in a few minutes.

### Step 3.4 — Save the code

Press **⌘S** (Mac) or **Ctrl+S** (Windows). You should see "Project saved" briefly.

### Step 3.5 — Deploy as a Web App

1. Look at the top-right of the Apps Script editor for a blue **"Deploy"** button. Click it.
2. Click **"New deployment"**
3. Click the gear icon ⚙️ next to "Select type" → choose **"Web app"**
4. Fill in:
   - **Description:** type `Train App` (anything — this is just a label)
   - **Execute as:** **Me** (your email)
   - **Who has access:** **Anyone**
5. Click the blue **"Deploy"** button at the bottom

Google will pop up an authorization screen:
- Click **"Authorize access"**
- Pick your Google account
- It'll say "Google hasn't verified this app" — that's normal, this is YOUR script. Click **"Advanced"** → **"Go to Train App (unsafe)"** → **"Allow"**

After it deploys, you'll see a popup with **"Web app URL"** at the bottom. It looks like:

```
https://script.google.com/macros/s/AKfycbz...../exec
```

**Copy that whole URL.** This is your "Apps Script URL" — write it down or paste it somewhere temporary.

Click **"Done"**.

---

## Phase 4 — Connect the app to your Sheet (1 min)

1. Open your Train app URL on your computer (e.g., `mike-lifts.github.io/train-app/`)
2. A "Settings" panel will pop up automatically on first visit
3. Paste your **Apps Script URL** in the first field
4. Type your **password** (the one you set in Step 3.3) in the second field
5. Click **"Test connection"** — it should say "Connected. Sheet has 0 rows."
6. Click **"Save"**

You're done. The calendar should appear.

---

## Phase 5 — Install on your phone (1 min)

1. On your iPhone, open **Safari** (NOT Chrome — only Safari can install web apps)
2. Go to your Train app URL: `your-username.github.io/train-app/`
3. Tap the **Share button** (square with up-arrow)
4. Scroll down → **"Add to Home Screen"** → **"Add"**
5. You'll get a "Train" icon on your home screen that opens like a normal app

The first time you open it on phone, you'll see the Settings popup again — paste your Apps Script URL + password again (it's stored per-device).

---

## You're done — what to do next

1. Tap any day on the calendar → tap **"Quick Log"** → enter some sets → **Save All**
2. Open your Google Sheet — you'll see your sets appear as new rows
3. Try **"Start Session"** for the guided workout flow with rest timer

The workout program is hardcoded for now (Upper A / Lower A / Upper B / Lower B). To customize:
- **Add custom workouts**: tap **Routines** → **+ New** at the top
- **Add custom exercises**: open a workout in Routines → **"Add exercise to this workout"** at the bottom

To rename the existing workouts or change the default weights, you'd need to edit the file `src/lib/program.js` in your GitHub repo. That's where the AI assistance comes in — see next section.

---

## Use Claude Pro for help

If you get stuck on ANY step above, or want to customize the app, here's a magic shortcut.

**Step 1:** Open Claude.ai on your computer (you have Claude Pro).

**Step 2:** Start a new chat and paste this entire block as your first message:

> I'm setting up a workout tracker app from a friend. The repo is at https://github.com/Thekidriv/train-app and the setup guide I'm following is at https://github.com/Thekidriv/train-app/blob/main/SETUP_FOR_FRIEND.md (or my own fork's version of that file). The stack is React on GitHub Pages talking to a Google Apps Script that writes to a Google Sheet. I'm not a developer.
>
> I'll describe what I'm trying to do and where I'm stuck. Please walk me through the answer step-by-step in plain English, with screenshots-of-words descriptions ("look for the blue button on the top right that says ___"). If I need to paste code, give me the entire block to paste — never partial edits.

**Step 3:** Then describe what you're stuck on. Examples:

- "I'm at Step 3.5 — when I click Deploy, I get an error that says X"
- "I want to change the default Bench Press weight from 72.5kg to 60kg — how?"
- "How do I add a new exercise called 'Cable Curl' to Upper A?"

Claude Pro will walk you through it. If you need to edit code in your GitHub repo, Claude will tell you exactly which file to open in GitHub's web editor (you can edit any file in your repo by clicking it on the GitHub website and clicking the pencil icon — no need to install anything on your computer).

---

## Common gotchas

| Problem | Fix |
|---|---|
| "Page not found" at your URL | Wait 2-3 minutes after Pages is enabled. The first deploy is slow. |
| "Unauthorized" when testing connection | Your password in Settings doesn't match `SHEET_PASSWORD` in your Apps Script. Make sure they match exactly. |
| "Unexpected response" when testing | You probably copied an old version of the Apps Script URL. Re-deploy in Apps Script (Deploy → Manage deployments → pencil → New version) and copy the URL again. |
| Settings popup keeps appearing | Your Apps Script URL or password is wrong, or your phone cleared its memory. Re-enter both. |
| App on phone is showing old version | Force-close Safari and reopen. iPhone caches aggressively. |
| I deleted/overwrote my data | Go to your Google Sheet → File → Version history → see all previous versions. Can restore any. |

---

## What's actually free here, what could break

**Free forever:**
- GitHub Pages hosting (unlimited as long as repo is public, < 1GB)
- Google Apps Script (20,000 calls/day quota — you'll never hit this)
- Google Sheets (free, basically unlimited rows)

**Could "break":**
- If you make your GitHub repo private, GitHub Pages disables hosting on free accounts. Keep it public.
- If your Sheet hits ~5 million cells you'd have a problem (you'd need ~50 years of daily lifting to get there)
- If Google ever paywalls Apps Script (they haven't in 18 years, so unlikely)

---

That's the whole thing. Welcome to owning your own software.
