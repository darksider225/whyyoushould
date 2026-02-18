# TMDB & RAWG API Integration Setup

Your "Whyyoushould" site is now configured to automatically enrich reviews with movie and game data from TMDB (The Movie Database) and RAWG (Video Game Database). Here's how to set it up:

## Step 1: Get Your API Keys

### TMDB (for movies)
1. Go to https://www.themoviedb.org/settings/api
2. Sign up or log in (free account)
3. Request an API key (Developer tab)
4. Copy your API key

### RAWG (for games)
1. Go to https://rawg.io/api
2. Sign up (free API access)
3. Copy your API key from your account page

## Step 2: Add Keys to `.env`

Edit `.env` in your project root:

```env
TMDB_API_KEY=your_tmdb_api_key_here
RAWG_API_KEY=your_rawg_api_key_here
REFRESH_EXTERNAL_DATA=false
```

**⚠️ Important**: Never commit `.env` to Git! It's already in `.gitignore`.

## Step 3: Build and Test

```bash
npm run build
```

You should see output like:
```
🔄 Fetching data for "Elden Ring"...
🔄 Fetching data for "Baldur's Gate 3"...
✅ Reviews enriched with external data
```

## What Gets Fetched?

### Movies (from TMDB)
- Poster/cover image
- Official plot description
- TMDB rating (to compare with your verdict)
- TMDB link

### Games (from RAWG)
- Box art/cover image
- Official description
- Metacritic score (if available)
- RAWG link

## How It Works

1. **At Build Time**: When you run `npm run build`, the system calls TMDB/RAWG APIs
2. **Cached Locally**: Results are saved in `_data/.cache/external-data.json`
3. **Next Builds Faster**: Subsequent builds use the cache instead of hitting the API again
4. **Force Refresh**: Set `REFRESH_EXTERNAL_DATA=true` to fetch fresh data

## Display on Your Site

The enriched data appears on review pages:
- **Poster/cover image** at the top of each review
- **Official ratings** in the metadata section
- **Official description** in an accent-colored box below the metadata

## Adding New Reviews

When you add a new review to `_data/_reviews-raw.json`:

```json
{
  "slug": "new-game",
  "title": "New Game Title",
  "type": "game",  // or "movie"
  "verdict": "Must Play",
  ...
}
```

Then run `npm run build` and the API will automatically fetch metadata for it.

## Troubleshooting

**"API rate limit exceeded"**
- TMDB free tier: 40 requests/10 seconds
- RAWG free tier: 20 requests/day
- Just wait before running the build again, or set `REFRESH_EXTERNAL_DATA=false` to use cache

**"Could not find movie/game"**
- API couldn't find an exact match
- Review still builds fine, just without the poster/official data
- Check the title spelling in your reviews data

**Images not showing**
- Make sure your API keys are correct in `.env`
- Run build with fresh keys: `REFRESH_EXTERNAL_DATA=true npm run build`
- Delete `_data/.cache/external-data.json` to clear cache

## Performance Notes

- First build with fresh keys: ~2-5 seconds (depends on API response time)
- Subsequent builds with cache: ~0.7 seconds
- No additional dependencies needed beyond what you already have
