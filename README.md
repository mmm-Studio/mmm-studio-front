# MMM Studio Frontend

Marketing Mix Modeling SaaS Platform — Next.js + Supabase + shadcn/ui

## Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: Supabase SSR
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **State**: Zustand (auth) + TanStack Query (data)
- **Backend**: FastAPI ([mmm_builder](https://github.com/mmm-Studio/mmm_builder))

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase and API URLs
npm run dev
```

## Pages

| Route | Description |
|---|---|
| `/login` | Email/password + Google OAuth |
| `/signup` | Account registration |
| `/dashboard` | Overview stats + quick actions |
| `/projects` | CRUD projects |
| `/datasets` | Upload + validate CSV datasets |
| `/jobs` | Launch + monitor training jobs |
| `/models` | List trained models |
| `/models/[id]` | ROAS + contribution charts |
| `/optimization` | Historical / budget / period comparison |
| `/results` | Saved optimization scenarios |
| `/settings` | Org management + team members |
| `/orgs/new` | Create organization |
