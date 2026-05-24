# Personal Userscripts
Various userscripts for enhancing web browsing experience on external sites.

> ✨ Mostly vibe-coded scripts. Thanks Claude.

**🌐 [View Website](https://1110101.github.io/tampermonkey_personal_scripts/)**

## Scripts

### CorporateBenefits Toolkit
Adds sorting and filtering offers by discount percentage. Analyzes all available discounts and dynamically creates three filter ranges (low, medium, high) based on actual data. Blocks some ads.

**Websites:** https://*.mitarbeiterangebote.de/overview/*

### MitarbeiterVorteile Toolkit
Adds sorting and filtering offers by discount percentage. Parses various discount formats including standard percentages, German decimal format (4,5%), cashback offers, and complex promotional text. Organizes offers from highest to lowest discount.

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
