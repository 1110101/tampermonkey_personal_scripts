// ==UserScript==
// @name				Złoty to Euro Converter
// @namespace			1110101
// @version				4.0
// @description			Scans web pages for Polish Złoty (zł/zl) and displays the equivalent amount in Euro (€) in parentheses.
// @author				1110101@oczc.de
// @match				http://*/*
// @match				https://*/*
// @connect				open.er-api.com
// @icon				https://www.google.com/s2/favicons?sz=64&domain=nbp.pl
// @grant				GM_xmlhttpRequest
// @grant				GM_setValue
// @grant				GM_getValue
// @run-at				document-idle
// @license				MIT
// @downloadURL			https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Z%C5%82oty%20to%20Euro%20Converter.user.js
// @updateURL			https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Z%C5%82oty%20to%20Euro%20Converter.user.js
// ==/UserScript==

(async function () {
	'use strict';


	// First, perform a quick check to see if the currency symbol exists. If not, exit early to save resources.
	if (!/zł|zl/i.test(document.body.textContent)) {
		return;
	}

	const API_URL = 'https://open.er-api.com/v6/latest/PLN';
	const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

	/**
     * Fetches the latest PLN to EUR rate from the API, wrapped in a Promise for async/await.
     * @returns {Promise<number>} The EUR exchange rate.
     */
	const fetchRateFromApi = () => {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url: API_URL,
				onload: (response) => {
					try {
						const data = JSON.parse(response.responseText);
						if (data?.rates?.EUR) {
							resolve(data.rates.EUR);
						} else {
							reject('EUR rate not found in API response.');
						}
					} catch (e) {
						reject('Failed to parse API response.');
					}
				},
				onerror: (error) => reject('Failed to fetch exchange rate.', error),
				ontimeout: () => reject('The request timed out.')
			});
		});
	};

	/**
     * Gets the exchange rate, using a cached value if it's available and not expired.
     * @returns {Promise<number>} The EUR exchange rate.
     */
	const getExchangeRate = async () => {
		const cachedRate = await GM_getValue('pln_to_eur_rate');
		const lastFetch = await GM_getValue('pln_to_eur_last_fetch');
		const isCacheValid = cachedRate && lastFetch && (Date.now() - lastFetch < CACHE_DURATION);

		if (isCacheValid) {return cachedRate;}

		const rate = await fetchRateFromApi();
		await GM_setValue('pln_to_eur_rate', rate);
		await GM_setValue('pln_to_eur_last_fetch', Date.now());
		return rate;
	};

	// Define the observer in a higher scope so it can be controlled within the conversion function.
	let observer;

	/**
     * Traverses the document's text nodes and replaces złoty prices with their Euro equivalent.
     * @param {number} rate - The PLN to EUR conversion rate.
     */
	const convertCurrencyOnPage = (rate) => {
		// Disconnect the observer to prevent it from reacting to its own DOM manipulations.
		if (observer) {observer.disconnect();}

		// Regex Explanation:
		// ((\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?) - Captures the numeric amount, allowing for comma/period separators.
		// \s?                                      - Optional space.
		// (zł|zl)                                  - The currency symbol.
		// (?!\s*\([^)]*€\))                        - Negative lookahead. Ensures the match is ignored if it's already followed by "(...€)".
		const priceRegex = /((\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?)\s?(zł|zl)(?!\s*\([^)]*€\))/gi;

		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				if (node.parentElement.tagName.match(/^(script|style|textarea)$/i) || !priceRegex.test(node.nodeValue)) {
					return NodeFilter.FILTER_REJECT;
				}
				priceRegex.lastIndex = 0; // Reset regex state for each node.
				return NodeFilter.FILTER_ACCEPT;
			}
		});

		while (walker.nextNode()) {
			const node = walker.currentNode;
			const originalText = node.nodeValue;

			const newText = originalText.replace(priceRegex, (match, amountStr) => {
				const amountInZl = parseFloat(amountStr.replace(/,/g, '.'));
				if (isNaN(amountInZl)) {return match;} // Failsafe

				const amountInEur = (amountInZl * rate).toFixed(2);
				return `${match} (${amountInEur}€)`;
			});

			if (newText !== originalText) {
				node.nodeValue = newText;
			}
		}

		// Reconnect the observer to watch for future page changes.
		if (observer) {
			observer.observe(document.body, { childList: true, subtree: true });
		}
	};


	try {
		const rate = await getExchangeRate();
		// Run the initial conversion on page load.
		convertCurrencyOnPage(rate);

		// Set up the observer to handle dynamically loaded content (e.g., infinite scroll).
		observer = new MutationObserver(() => convertCurrencyOnPage(rate));
		observer.observe(document.body, { childList: true, subtree: true });

	} catch (error) {
		console.error('Złoty to Euro Converter Error:', error);
	}

})();
