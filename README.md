# Personal Userscripts
Various userscripts for enhancing web browsing experience on external sites.

> ✨ Mostly vibe-coded scripts. Thanks Claude.

**🌐 [View Website](https://1110101.github.io/tampermonkey_personal_scripts/)**

## Scripts

### ImmoScout24 Toolkit
Cuts through the platform's upsell prompts, hidden metrics, and cluttered layouts. Automatically calculates rent or buy price per square meter (€/m²) and displays it next to the price on listing cards. Adds a close button to instantly ignore and hide search result listings, and integrates a persistent, auto-saving notes textarea directly on cards and detail pages. Overrides the map view to keep price markers visible, automatically clicks "Weiterlesen" to expand descriptions, and cleans detail pages into a two-column grid while hiding ads.

**Websites:** https://*.immobilienscout24.de/*

### CorporateBenefits Toolkit
Bypasses redirection screens and adds deal sorting and filtering features. Injects sorting controls into categories (highest first, lowest first, original) and builds dynamic low/medium/high discount filter options on the fly. Rewrites shop buttons to bypass warning redirects and open partner store links directly, automatically clicks past login disclaimers, and hides inline banner ads.

**Websites:** https://*.mitarbeiterangebote.de/overview/*, https://*.mitarbeiterangebote.de/offer/*

### MitarbeiterVorteile Toolkit
Adds sorting and filtering offers by discount percentage to the employee benefits portal. Parses complex discount formats like standard percentages, German decimal formats (4,5%), cashback, and text coupons. Replaces navigation-blocking buttons with real links for middle-click/Ctrl-click tab support, generates dynamic filters, and persists your sorting and page location between navigations.

**Websites:** https://*.mitarbeitervorteile.de/offers.action*

### Kleinanzeigen Toolkit
Universal template and image manager for Kleinanzeigen. Makes reposting deals easy.

**Websites:** https://www.kleinanzeigen.de/*

### Zoomout with right click for Leaflet or OpenLayers
Modifies zoom behavior in Leaflet and OpenLayers map libraries. Changes default zoom interactions to provide better user experience for map-based applications.

**Websites:** *://*/*

### MyDealz Ignore Toolkit
Adds filter and ignore unwanted content features to MyDealz. Improves browsing experience by hiding irrelevant or unwanted deal categories. Filter all the shitty deals out.

**Websites:** https://www.mydealz.de/*

### Reddit highlight new comments
Highlights new comments on Reddit threads since your last visit. Helps users quickly identify new discussions and responses in long-running Reddit conversations.

**Websites:** https://www.reddit.com/*

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click on any `.user.js` file in this repository
3. Click the "Raw" button
4. Tampermonkey will automatically detect the script and offer to install it

## Development

This repository includes ESLint configuration for maintaining code quality:

```bash
npm install
npm run lint
```

## License

MIT.
These scripts are personal projects and are provided as-is for educational purposes. 
