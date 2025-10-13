# Personal Userscripts
Various userscripts for enhancing web browsing experience on external sites.

## Scripts

### CorporateBenefits Toolkit
Company-agnostic toolkit for sorting and filtering employee benefit offers by discount percentage. Analyzes all available discounts and dynamically creates three filter ranges (low, medium, high) based on actual data distribution using tertiles. Features a global control system where changing sort or filter options in one category automatically applies to all categories. Includes ad blocking and a 3-state sort toggle (highest first, lowest first, off). Perfect for quickly finding the best deals among employee perks.

**Websites:** https://*.mitarbeiterangebote.de/overview/*

### MitarbeiterVorteile Toolkit
Company-agnostic toolkit for sorting and filtering employee benefits portal offers by discount percentage. Intelligently parses various discount formats including standard percentages, German decimal format (4,5%), cashback offers, and complex promotional text. Automatically organizes offers from highest to lowest discount and provides dynamic filter ranges based on actual discount distribution. Features a clean, intuitive control panel with 3-state sorting and category filters for finding the best deals quickly.

**Websites:** https://*.mitarbeitervorteile.de/offers.action*

### Kleinanzeigen Toolkit
Universal template and image manager for Kleinanzeigen (formerly eBay Kleinanzeigen). Provides centralized management of templates and media assets for creating and managing classified ads efficiently.

**Websites:** https://www.kleinanzeigen.de/*

### Zoomout with right click for Leaflet or OpenLayers
Modifies zoom behavior in Leaflet and OpenLayers map libraries. Changes default zoom interactions to provide better user experience for map-based applications.

**Websites:** *://*/*

### MyDealz Ignore Toolkit
Helps filter and ignore unwanted content on MyDealz deal-sharing platform. Improves browsing experience by hiding irrelevant or unwanted deal categories.

**Websites:** https://www.mydealz.de/*

### Reddit highlight new comments
Highlights new comments on Reddit threads since your last visit. Helps users quickly identify new discussions and responses in long-running Reddit conversations.

**Websites:** https://www.reddit.com/*

### Złoty to Euro Converter
Converts Polish Złoty (PLN) to Euro currency with real-time exchange rates. Useful for international transactions and price comparisons involving Polish currency.

**Websites:** http://*/*, https://*/*

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

These scripts are personal projects and are provided as-is for educational purposes.
