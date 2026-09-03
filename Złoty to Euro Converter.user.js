// ==UserScript==
// @name         Złoty to Euro Converter
// @namespace    1110101
// @version      4.1.0
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

	if (!document.body) {
		return;
	}

	const API_URL = 'https://open.er-api.com/v6/latest/PLN';
	const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours

	const PRICE_REGEX = /(?:^|[^\w.,])((\d{1,3}(?:[ \xA0,.]\d{3})*|\d+)(?:[.,]\d{1,2})?)\s*(zł|zl|PLN)(?!\s*\([^)]*€\))/gi;
	const PRICE_TEST_REGEX = /(?:^|[^\w.,])((\d{1,3}(?:[ \xA0,.]\d{3})*|\d+)(?:[.,]\d{1,2})?)\s*(zł|zl|PLN)(?!\s*\([^)]*€\))/i;
	const IGNORED_TAGS = /^(script|style|textarea|input|select|option|noscript)$/i;

	/**
	 * Parses price string taking thousands and decimal separators into account.
	 * @param {string} str
	 * @returns {number}
	 */
	function parsePriceValue(str) {
		const clean = str.replace(/[ \xA0]/g, '');
		if (clean.includes(',') && clean.includes('.')) {
			if (clean.indexOf(',') < clean.indexOf('.')) {
				return parseFloat(clean.replace(/,/g, ''));
			} else {
				return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
			}
		}
		if (clean.includes(',')) {
			const parts = clean.split(',');
			if (parts.length === 2 && parts[1].length <= 2) {
				return parseFloat(clean.replace(',', '.'));
			}
			return parseFloat(clean.replace(/,/g, ''));
		}
		return parseFloat(clean);
	}

	/**
	 * Fetches the latest PLN to EUR rate wrapped in a Promise.
	 * @returns {Promise<number>}
	 */
	const fetchRateFromApi = () => {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url: API_URL,
				timeout: 10000,
				onload: (response) => {
					try {
						const data = JSON.parse(response.responseText);
						if (data?.rates?.EUR) {
							resolve(data.rates.EUR);
						} else {
							reject(new Error('EUR rate not found in API response.'));
						}
					} catch (e) {
						reject(new Error(`Failed to parse API response: ${e.message}`));
					}
				},
				onerror: (error) => reject(new Error(`Failed to fetch exchange rate: ${error}`)),
				ontimeout: () => reject(new Error('The request timed out.'))
			});
		});
	};

	/**
	 * Gets the exchange rate, using the cached value if valid.
	 * @returns {Promise<number>}
	 */
	const getExchangeRate = async () => {
		const cachedRate = GM_getValue('pln_to_eur_rate');
		const lastFetch = GM_getValue('pln_to_eur_last_fetch');
		const isCacheValid = cachedRate && lastFetch && (Date.now() - lastFetch < CACHE_DURATION);

		if (isCacheValid) {
			return cachedRate;
		}

		const rate = await fetchRateFromApi();
		GM_setValue('pln_to_eur_rate', rate);
		GM_setValue('pln_to_eur_last_fetch', Date.now());
		return rate;
	};

	let observer = null;

	/**
	 * Scans a subtree for złoty prices and replaces them with EUR equivalent.
	 * @param {Node} rootNode
	 * @param {number} rate
	 * @returns {number} Count of converted elements
	 */
	const convertInNode = (rootNode, rate) => {
		if (!rootNode || (rootNode.nodeType !== Node.ELEMENT_NODE && rootNode.nodeType !== Node.DOCUMENT_NODE)) {
			return 0;
		}

		let convertedCount = 0;
		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				const tag = node.parentElement?.tagName;
				if (tag && IGNORED_TAGS.test(tag)) {
					return NodeFilter.FILTER_REJECT;
				}
				if (!PRICE_TEST_REGEX.test(node.nodeValue)) {
					return NodeFilter.FILTER_SKIP;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		});

		while (walker.nextNode()) {
			const node = walker.currentNode;
			const originalText = node.nodeValue;

			const newText = originalText.replace(PRICE_REGEX, (match, amountStr) => {
				const amountInZl = parsePriceValue(amountStr);
				if (Number.isNaN(amountInZl) || amountInZl <= 0) {
					return match;
				}

				const amountInEur = (amountInZl * rate).toFixed(2);
				return `${match} (${amountInEur}€)`;
			});

			if (newText !== originalText) {
				node.nodeValue = newText;
				convertedCount++;
			}
		}

		return convertedCount;
	};

	try {
		const rate = await getExchangeRate();
		const initialCount = convertInNode(document.body, rate);

		const isPolishDomain = window.location.hostname.endsWith('.pl');
		const isPolishLang = document.documentElement.lang?.toLowerCase().startsWith('pl');

		// Only observe if prices were found or if we are on a Polish site
		if (initialCount > 0 || isPolishDomain || isPolishLang) {
			let debounceTimer = null;
			const nodesToProcess = new Set();

			observer = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE && !IGNORED_TAGS.test(node.tagName)) {
							nodesToProcess.add(node);
						}
					}
				}

				if (nodesToProcess.size > 0) {
					if (debounceTimer) {
						clearTimeout(debounceTimer);
					}
					debounceTimer = setTimeout(() => {
						observer.disconnect();
						for (const node of nodesToProcess) {
							if (document.body.contains(node)) {
								convertInNode(node, rate);
							}
						}
						nodesToProcess.clear();
						observer.observe(document.body, { childList: true, subtree: true });
					}, 300);
				}
			});

			observer.observe(document.body, { childList: true, subtree: true });
		}
	} catch (error) {
		console.error('Złoty to Euro Converter Error:', error);
	}
})();
