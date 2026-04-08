# Tampermonkey Userscript Development

## Metadata Standards
- Author: `oliwer.christ02@sap.com`
- License: MIT
- Namespace: consistent identifier across all scripts
- Match patterns: be specific but not overly restrictive
- Use descriptive `@description` fields without dates
- Include `@icon` pointing to relevant favicons
- Version format: X.X or X.X.X

## Code Style
- Tabs for indentation, single quotes, semicolons
- Max line length: 180 characters
- ES2025+ (const/let, arrow functions, template literals, optional chaining)
- Prefer IIFEs for script isolation
- camelCase for variables/functions, PascalCase for classes, UPPER_CASE for constants
- Prefix event handlers with `handle` or `on`

## Tampermonkey Best Practices
- Include all needed `@grant` directives — only what's strictly used
- Use `@run-at document-idle` for most scripts
- Add `@downloadURL` and `@updateURL` for automatic updates
- Use `GM_setValue`/`GM_getValue` for preferences, never store sensitive user data
- Use appropriate `@connect` directives for CORS

## Dynamic Content & DOM
- Use MutationObserver for dynamic content, not polling
- Use modern selectors (`querySelector`, `querySelectorAll`)
- Check element existence before manipulation
- Use event delegation; clean up listeners and dynamically created elements

## Performance & Error Handling
- try-catch for risky operations, fail silently for DOM manipulations that may break on page changes
- Debounce frequent events (resize, scroll, input)
- Clean up event listeners and observers

## Development Workflow
- Run `npm run lint` before committing
- Use `npm run count` to track script sizes
