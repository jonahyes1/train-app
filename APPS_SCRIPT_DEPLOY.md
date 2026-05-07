# Apps Script — Current State & Future Upgrade

## Current state (April 2026) — NO ACTION NEEDED

Your deployed Apps Script at
`https://script.google.com/macros/s/AKfycbzpwg6ZjjNnJTeQu2iW4CLlMetV4zkgE00DZiovL-1Pvogrowl7KvY9ez2pT3uqFj1k7A/exec`
already supports:

- ✅ JSONP reads (`?callback=fn`) — the React Calendar/History views work today
- ✅ POST writes with `{ secret: "Lubadon1", date, workout_type, exercise, set_num, weight_kg, reps, rpe, notes }` — one row at a time

**The React app has been adapted to match this existing format.** You don't need to redeploy anything for the features shipped so far (Calendar home, Last Session banner, History sheet).

## Sheet columns (confirmed from live `/exec` response)

```
date | workout_type | exercise | set_num | weight_kg | reps | rpe | notes | timestamp
```
The 9th column `timestamp` is auto-populated by `doPost` with `new Date().toISOString()`.

## Future upgrade — needed ONLY when we build Quick Log with "Save All"

Quick Log saves many rows at once. With the current append-only `doPost`:
- Re-saving the same Quick Log creates **duplicate rows**.
- Each set is a separate HTTP request (slower, N× quota).

To fix both, replace `doPost` with an upsert-aware version. **Do this only when we're ready to ship Quick Log.** Below is a drop-in replacement — paste this **in addition to keeping your existing `doGet` untouched** (or replace the whole file if you prefer).

```javascript
const SHEET_PASSWORD = 'Lubadon1';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');

    // Accept both "secret" (legacy) and "password" field names
    const pw = body.secret || body.password;
    if (pw !== SHEET_PASSWORD) {
      return ContentService.createTextOutput('unauthorized');
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const values = sheet.getDataRange().getValues();
    const headers = values[0];

    // Legacy single-row shape: body itself IS the row
    if (!body.action && (body.date || body.exercise)) {
      sheet.appendRow([
        body.date || '',
        body.workout_type || '',
        body.exercise || '',
        body.set_num || '',
        body.weight_kg || '',
        body.reps || '',
        body.rpe || '',
        body.notes || '',
        new Date().toISOString(),
      ]);
      return ContentService.createTextOutput('OK');
    }

    const action = body.action || 'append';
    const rows = body.rows || (body.row ? [body.row] : []);

    // Helper: build an array in header order
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
      const keyOf = o => keyFields.map(k => String(o[k] ?? '')).join('\u0001');
      let updated = 0, appended = 0;

      rows.forEach(r => {
        const idx = existing.findIndex(x => keyOf(x) === keyOf(r));
        if (idx >= 0) {
          const rowNum = idx + 2;
          headers.forEach((h, i) => {
            if (h === 'timestamp') {
              sheet.getRange(rowNum, i + 1).setValue(new Date().toISOString());
            } else if (r[h] !== undefined) {
              sheet.getRange(rowNum, i + 1).setValue(r[h]);
            }
          });
          updated++;
        } else {
          sheet.appendRow(toArray(r));
          appended++;
        }
      });
      return _json({ ok: true, updated, appended });
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

### Deploy steps (only run when upgrading)
1. Paste above → save (⌘S).
2. **Deploy → Manage deployments → pencil → New version → Deploy.**
3. URL stays the same.

### Why this is backward-compatible
- Still accepts the legacy `{ secret, date, workout_type, ... }` single-row shape — your existing tools won't break.
- Adds `action: "upsert"` + `rows: [...]` for batch saves from Quick Log.
- Accepts `password` or `secret` interchangeably.
