# Whyyoushould

**Decisive reviews for movies and games.** No filler, just decisive recommendations. Why should you spend your time on this?

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm start
   ```
   Visit `http://localhost:8080`

3. **Build for production**:
   ```bash
   npm run build
   ```

## Project Structure

```
whyyoushould/
├── _data/              # Global data
├── _includes/
│   └── layouts/        # Page layouts
├── css/                # Global stylesheet
├── images/             # Image assets
├── reviews/            # Individual review markdown files
├── .eleventy.js        # Eleventy configuration
├── package.json        # Project metadata
└── index.njk          # Homepage
```

## How It Works

Each review is a markdown file in the `reviews/` directory with front matter containing:

- **title**: Name of movie or game
- **type**: "movie" or "game"
- **verdict**: "Must Play"/"Must Watch", "Worth Your Time", or "Skip It"
- **why**: One-sentence value proposition
- **rating**: 0-10 score
- **releaseYear**: Year released
- **genre**: Array of genre tags
- **creator**: Game developer/director name
- **platform**: Game platforms or "streamingOn" for movies
- **reviewDate**: ISO date of review
- **timeInvestment**: Hours needed or runtime
- **excerpt**: Short summary

## Verdict Tiers

- **Must Play/Watch** (🟢): Essential. Clear recommendation.
- **Worth Your Time** (🟡): Good. Worthwhile if it matches your taste.
- **Skip It** (🔴): Not recommended. Save your time.

## Brand

**WYS** (logo) = bold, confident, monospace  
**Tagline**: "Decisive reviews for movies and games."  
**Voice**: Respectful of viewer time. Honest. Playful even in criticism.

## Customization

- **Colors**: Edit CSS variables in `css/style.css:root`
- **Layout**: Templates in `_includes/layouts/`
- **Data**: Add new reviews as markdown files in `reviews/`

## Deploy to GitHub Pages

1. Update `package.json` "homepage" to: `"https://yourusername.github.io/whyyoushould"`
2. Commit and push to GitHub
3. Enable GitHub Pages in repo settings (branch: gh-pages)
4. Site builds automatically!

---

Built with [Eleventy](https://11ty.dev) — Fast, flexible static site generator.
