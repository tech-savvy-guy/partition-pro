# Repertoire Frontend (Feature-Sliced Architecture)

Tech: React 18, Vite, TypeScript, Tailwind, React Query, ky

## Quick start
```bash
npm i
cp .env.example .env
npm run dev
```
Open http://localhost:5173

## Structure
- `src/main.tsx` → app shell & routes
- `src/pages/Dashboard.tsx` → modern dashboard UI (grey/white/red)
- `src/shared/api/client.ts` → HTTP client with tenant header auto-injection
- `src/components` → ActionCard, SidebarItem, and icons
- Tailwind configured
