# Antigravity Reader
A lightweight, aesthetically beautiful Markdown & Universal File Reader designed for NW.js desktop environments and Chromium browsers.

## Key Features
- **Universal Multi-File Loading**: Simply drag and drop any `.md` file to read. Drops that are non-markdown files will automatically attempt raw parsing or inject as formatted `<pre>` text.
- **Folder Navigation Engine**: Drag and drop an entire folder directly over the app to browse and read all included `.md` files in a visually pleasing sub-menu seamlessly via Node.js local context.
- **Zero-Drift Pagination**: A pure CSS Multi-Column flow layout engine that mathematical segments content directly to screen widths without losing subpixels across infinite pages.
- **Dual & Single Mode**: Use the native UI overlay controls to choose between a classic Single screen view, or a Book-style Dual screen view.

## Requirements & Local Dev
You need Node.js and NPM to resolve packages.
1. Run `npm install`
2. Run `npm run dev` to boot within a standard Web browser (Folder drops fallback to standard reading, specific `.md` files recommended).
3. **Or native run**: Run `npm run nw` to launch a fully native NW.js instance (Direct disk-access enabled, folder browsing enabled).

## Creating an NW.js Distribution (Packaging)
To share this application as a standalone executable `.exe` file without needing Node.js or developers tools, follow these official NW.js steps:

1. **Build Static Assets**
   Compile your `src/` React application into static Web modules by running:
   ```bash
   npm run build
   ```
   *This outputs everything into the `/dist` directory.*

2. **Add Minimal Config to Dist**
   Create a single `package.json` inside your `/dist` folder that tells NW.js where to boot:
   ```json
   {
       "name": "antigravity-reader",
       "main": "index.html",
       "window": { "width": 1280, "height": 800 }
   }
   ```

3. **Zip and Transform (app.nw)**
   Compress the **contents** of the `/dist` folder (do NOT zip the `dist` folder itself, zip the `index.html` and `assets` inside it) into a `.zip` file.
   Rename this file from `app.zip` to `app.nw`.

4. **Combine into a Windows Executable**
   Locate your downloaded NW.js binaries (from `node_modules/nw/nwjs-v.../` or official website).
   Place `app.nw` next to `nw.exe`. Open Command Prompt (CMD) in that directory and run:
   ```cmd
   copy /b nw.exe+app.nw AntigravityReader.exe
   ```
   
**Result:** You now have a standalone `AntigravityReader.exe`! You can distribute this `.exe` file alongside the NW.js `.dll` dependencies (e.g. `nw.dll`, `icudtl.dat`).
