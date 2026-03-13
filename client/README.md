# CrowdSense Dashboard

BLE-based crowd sensing network analytics dashboard. Built with React, Vite, Shadcn UI, and Tailwind CSS.

## Setup

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Structure

- **Live Data** - Current occupancy per room, density levels, KPI cards
- **Historical Analysis** - Peak hours, weekly patterns, underused spaces
- **Predictions** - Expected crowd next hour, overcrowding alerts

## API Integration

The app uses mock data by default. To connect to a real backend, set `USE_MOCK = false` in `src/data/api.js` and implement the API endpoints.
