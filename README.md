# SprayPlan 🌿

Chemical spray scheduling and work management app.

Built with React + Vite, backed by Supabase (PostgreSQL), deployed via Vercel.

---

## First-time setup

### 1. Set up the database (do this once)

- Go to your [Supabase dashboard](https://supabase.com/dashboard)
- Open your project → **SQL Editor** → **New Query**
- Paste the contents of `supabase_setup.sql` and click **Run**

### 2. Upload this folder to GitHub

- Go to [github.com](https://github.com) and create a **New Repository** (name it `sprayplan`)
- Upload all these files, or use:

```bash
git init
git add .
git commit -m "Initial SprayPlan"
git remote add origin https://github.com/YOUR_USERNAME/sprayplan.git
git push -u origin main
```

### 3. Deploy to Vercel

- Go to [vercel.com](https://vercel.com) and sign in with GitHub
- Click **Add New Project** → select your `sprayplan` repo
- Leave all settings as default and click **Deploy**
- In ~60 seconds you'll get a live URL like `https://sprayplan.vercel.app`

### 4. Share the URL

Anyone on your team can open the URL in any browser on any computer.
All data is live and shared — changes one person makes are visible to everyone instantly.

---

## Local development (optional)

```bash
npm install
npm run dev
```

Then open http://localhost:5173

---

## Project structure

```
sprayplan/
├── src/
│   ├── App.jsx          ← Main application
│   └── main.jsx         ← React entry point
├── index.html
├── vite.config.js
├── package.json
├── supabase_setup.sql   ← Run once in Supabase SQL Editor
└── README.md
```
