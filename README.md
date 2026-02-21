# MooBurger - Burger Restaurant Reviews

A fun, modern burger restaurant review website.

## Getting Started

1. **Install dependencies:**
   ```bash
   cd MooBurger
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in your browser:**
   ```
   http://localhost:3000
   ```

## Admin Access

- Navigate to `/admin/login`
- Default password: `mooburger2026`
- Change it by setting the `ADMIN_PASSWORD` environment variable

## Features

- **Landing page** with restaurant cards and Moo Scores
- **Detail pages** with reviews, photo galleries, and fun burger-patty scoring
- **Community submissions** — visitors can add restaurants and reviews
- **Admin dashboard** — add restaurants, validate community submissions, manage reviews
- **Visual differentiation** — admin (red), verified (teal), community (purple) content
- **Photo uploads** with lightbox gallery
- **Fun scoring system** — Patty Power, Juice Factor, Bun Game, Bang for Buck, Moo Vibes

## Scoring Categories

| Category       | What it Means           |
|----------------|-------------------------|
| Patty Power    | Taste and quality       |
| Juice Factor   | How juicy is the burger |
| Bun Game       | Bun quality and texture |
| Bang for Buck  | Value for money         |
| Moo Vibes      | Atmosphere and vibe     |

## Tech Stack

- **Node.js** + **Express**
- **EJS** templates
- **SQLite** via better-sqlite3
- **Multer** for file uploads
