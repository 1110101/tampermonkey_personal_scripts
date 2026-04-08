// ==UserScript==
// @name         Złoty to Euro Converter
// @namespace    1110101
// @version      4.0
// @description  Scans web pages for Polish Złoty (zł/zl) and displays the equivalent amount in Euro (€) in parentheses.
// @author       1110101@oczc.de
// @match        http://*/*
// @match        https://*/*
// @connect      open.er-api.com
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nbp.pl
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Z%C5%82oty%20to%20Euro%20Converter.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Z%C5%82oty%20to%20Euro%20Converter.user.js
// ==/UserScript==

(async function () {
	'use strict';


	// Quick exit if the currency symbol is absent, to avoid unnecessary DOM traversal
	if (!/zł|zl/i.test(document.body.textContent)) {
		return;
	}

	const API_URL = 'https://open.er-api.com/v6/latest/PLN';
	const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

	/**
     * Fetches the latest PLN to EUR rate, wrapped in a Promise for async/await.
     * @returns {Promise<number>}
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
					} catch {
						reject('Failed to parse API response.');
					}
				},
				onerror: (error) => reject(new Error(`Failed to fetch exchange rate: ${error}`)),
				ontimeout: () => reject('The request timed out.')
			});
		});
	};

	/**
     * Gets the exchange rate, using the cached value if available and not expired.
     * @returns {Promise<number>}
     */
	const getExchangeRate = async () => {
		const cachedRate = await GM_getValue('pln_to_eur_rate');
		const lastFetch = await GM_getValue('pln_to_eur_last_fetch');
		const isCacheValid = cachedRate && lastFetch && (Date.now() - lastFetch < CACHE_DURATION);

		if (isCacheValid) {
			return cachedRate;
		}

		const rate = await fetchRateFromApi();
		await GM_setValue('pln_to_eur_rate', rate);
		await GM_setValue('pln_to_eur_last_fetch', Date.now());
		return rate;
	};

	// Defined in outer scope so convertCurrencyOnPage can disconnect/reconnect it
	let observer;

	/**
     * Traverses the document's text nodes and replaces złoty prices with their Euro equivalent.
     * @param {number} rate - The PLN to EUR conversion rate.
     */	const convertCurrencyOnPage = (rate) => {
		// Disconnect to prevent reacting to our own DOM manipulations
		if (observer) {
			observer.disconnect();
		}

		const priceRegex = /((\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?)\s?(zł|zl)(?!\s*\([^)]*€\))/gi;
		const priceTestRegex = /((\d{1,3}(?:,\d{3})*|\d+)(?:[.,]\d{1,2})?)\s?(zł|zl)(?!\s*\([^)]*€\))/i;

		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				if (node.parentElement.tagName.match(/^(script|style|textarea)$/i) ||
					!priceTestRegex.test(node.nodeValue)) {
					return NodeFilter.FILTER_SKIP;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		});

		while (walker.nextNode()) {
			const node = walker.currentNode;
			const originalText = node.nodeValue;

			const newText = originalText.replace(priceRegex, (match, amountStr) => {
				const amountInZl = parseFloat(amountStr.replace(/,/g, '.'));
				if (isNaN(amountInZl)) {
					return match;
				} // Failsafe

				const amountInEur = (amountInZl * rate).toFixed(2);
				return `${match} (${amountInEur}€)`;
			});

			if (newText !== originalText) {
				node.nodeValue = newText;
			}
		}

		if (observer) {
			observer.observe(document.body, { childList: true, subtree: true });
		}
	};


	try {
		const rate = await getExchangeRate();
		convertCurrencyOnPage(rate);

		// Re-run on dynamically loaded content (e.g., infinite scroll)
		observer = new MutationObserver(() => convertCurrencyOnPage(rate));
		observer.observe(document.body, { childList: true, subtree: true });

	} catch (error) {
		console.error('Złoty to Euro Converter Error:', error);
	}

})();
