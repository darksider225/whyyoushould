# Deployment Guide for Whyyoushould to GitHub Pages

## Prerequisites

- A GitHub account
- Git installed on your machine
- The WhyYouShould project ready to deploy

## Step-by-Step Deployment

### 1. Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the **+** icon and select **New repository**
3. Name it `whyyoushould` (or any name you prefer)
4. Add description: "Decisive reviews for movies and games"
5. Choose **Public** (required for GitHub Pages free tier)
6. Click **Create repository**

### 2. Initialize Git & Push Code

In your project directory (`c:\Users\Acer\myprojects\whyshould`):

```powershell
# Initialize Git repository
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit: Complete Whyyoushould Eleventy site"

# Add remote origin (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/whyyoushould.git

# Push to GitHub (main branch)
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (gear icon)
3. Navigate to **Pages** (left sidebar)
4. Under "Source", select **Deploy from a branch**
5. Choose branch: **main**
6. Choose folder: **/ (root)**
7. Click **Save**

GitHub will automatically build and deploy your site. Wait 1-2 minutes.

### 4. Verify Deployment

Your site will be live at:  
```
https://YOUR_USERNAME.github.io/whyyoushould/
```

Or if you set a custom domain through GitHub Pages settings.

## Automatic Builds

**GitHub Pages will NOT automatically build your Eleventy site.** You must:

### Option A: Use GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build site
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./_site
```

Then:
1. Commit and push this file to `main`
2. Go to **Settings → Pages**
3. Under "Source", select **Deploy from a branch**
4. Choose branch: **gh-pages** (will be created by the action)
5. Click **Save**

### Option B: Manual Build & Push

Build locally, then push the `_site` folder:

```powershell
# Build the site
npm run build

# Commit built files
git add _site/
git commit -m "Build site"
git push
```

Then in GitHub Pages settings, select `gh-pages` branch (or create it if building manually).

## Important: Update package.json for Production

Edit `package.json` and add:

```json
{
  "homepage": "https://YOUR_USERNAME.github.io/whyyoushould/",
  ...
}
```

This ensures CSS and asset paths work correctly under the subdirectory.

## Updating Content

To add new reviews:

1. Create a new `.md` file in `reviews/` folder
2. Follow the front matter structure from existing reviews
3. Commit and push to GitHub
4. If using GitHub Actions, the site will rebuild automatically

Example:

```markdown
---
layout: layouts/review.njk
title: "Game/Movie Name"
type: game
verdict: Must Play
why: One sentence summary
rating: 9
releaseYear: 2024
genre:
  - Genre 1
  - Genre 2
creator: Developer/Director Name
platform:
  - Platform 1
  - Platform 2
reviewDate: 2024-03-15
timeInvestment: 40-60 hours
moodTags:
  - tag1
  - tag2
excerpt: Short description
similarTitles:
  - Similar Title 1
  - Similar Title 2
---

Full review content in markdown...
```

## Troubleshooting

### Site not updating:
- Check GitHub Actions tab in your repository for build errors
- Ensure `.github/workflows/deploy.yml` is in `main` branch
- Check GitHub Pages settings point to correct branch

### Links broken:
- Make sure `package.json` has correct `homepage` URL
- Ensure all internal links use relative paths like `/reviews/`

### CSS not loading:
- This usually means `homepage` URL in package.json is incorrect
- Rebuild and redeploy

## Custom Domain (Optional)

To use a custom domain like `www.whyyoushould.com`:

1. In GitHub Pages settings, add your domain under "Custom domain"
2. Update your domain registrar DNS settings to point to GitHub Pages IPs
3. GitHub will verify and issue an SSL certificate

See GitHub's [custom domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).

## Performance Notes

- This is a static site: instant loads, minimal bandwidth
- Site is cached by GitHub Pages CDN worldwide
- Builds take < 1 minute on GitHub Actions
- Perfect for scaling: no server costs, unlimited traffic

---

## Quick Reference Commands

```powershell
# Local development
npm start          # Start dev server at localhost:8080

# Build for production
npm run build      # Creates _site/ folder

# Deploy
git add .
git commit -m "your message"
git push           # Pushes to GitHub, triggers build
```

---

## Support

For Eleventy documentation: [11ty.dev](https://11ty.dev)  
For GitHub Pages: [pages.github.com](https://pages.github.com)
