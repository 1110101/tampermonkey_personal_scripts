// ==UserScript==
// @name         ImmoScout24 Toolkit
// @namespace    1110101
// @version      1.0
// @description  Adds ignore button, price-per-sqm calculation, and forces prices visible on map view
// @author       1110101@oczc.de
// @match        *://*.immobilienscout24.de/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=immobilienscout24.de
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/ImmoScout24%20Toolkit.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/ImmoScout24%20Toolkit.user.js
// ==/UserScript==

(function () {
	'use strict';

	const STORAGE_KEY = 'is24_ignored_listings_v5';
	const HIDE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

	const USER_BLOCK_SELECTORS = [

	];

	const getStoredData = () => {
		try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_e) { return {}; }
	};

	const saveToStore = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

	const forceShowPrices = () => {
		document.querySelectorAll('gmp-advanced-marker:not([data-prices-shown])').forEach(marker => {
			const custom = marker.querySelector('.custom-marker');
			if (custom) {
				marker.setAttribute('data-prices-shown', 'true');
				custom.classList.add('selected');
				custom.classList.remove('hidden-address');
				Object.assign(custom.style, { display: 'block', visibility: 'visible', opacity: '1', zIndex: '999' });
			}
		});
	};

	const injectMapButton = () => {
		const moreBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Mehr');
		if (moreBtn && !document.getElementById('manual-show-prices-btn')) {
			const btn = document.createElement('button');
			btn.id = 'manual-show-prices-btn';
			btn.textContent = 'Preise zeigen';
			btn.className = moreBtn.className;
			Object.assign(btn.style, { marginLeft: '8px', backgroundColor: '#00ff0022', border: '1px solid #00cc00' });
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				forceShowPrices();
			});
			moreBtn.parentNode.insertBefore(btn, moreBtn.nextSibling);
		}
	};

	const injectStyles = () => {
		const store = getStoredData();
		const now = Date.now();
		const ignoredSelectors = Object.entries(store)
			.filter(([_, timestamp]) => now - timestamp < HIDE_DURATION_MS)
			.map(([id]) => `html body .listing-card[data-obid="${id}"]`);

		const allBlocked = [...ignoredSelectors, ...USER_BLOCK_SELECTORS];
		let styleEl = document.getElementById('is24-ignore-styles');
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = 'is24-ignore-styles';
			(document.head || document.documentElement).appendChild(styleEl);
		}
		styleEl.textContent = allBlocked.length > 0 ? `${allBlocked.join(',\n')} { display: none !important; }` : '';
	};

	const initializeUI = () => {
		document.querySelectorAll('.listing-card:not([data-enhanced-initialized])').forEach(listing => {
			const id = listing.getAttribute('data-obid');
			const heartButton = listing.querySelector('button.shortlist-star');
			const attrContainer = listing.querySelector('[data-testid="attributes"] .grid-item.font-ellipsis');

			if (id && heartButton?.parentElement) {
				listing.setAttribute('data-enhanced-initialized', 'true');

				const dds = attrContainer ? attrContainer.querySelectorAll('dd.font-body-medium-bold') : [];
				if (attrContainer && dds.length >= 2) {
					const price = parseFloat(dds[0].textContent.replace(/[^0-9,]/g, '').replace(',', '.'));
					const size = parseFloat(dds[1].textContent.replace(/[^0-9,]/g, '').replace(',', '.'));
					if (!isNaN(price) && !isNaN(size) && size > 0) {
						const dd = document.createElement('dd');
						dd.className = 'display-inline font-body-medium-bold';
						dd.textContent = ` (${(price / size).toFixed(2)} €/m²)`;
						dd.style.color = '#00aa00';
						attrContainer.appendChild(dd);
					}
				}

				const container = heartButton.parentElement;
				container.style.display = 'flex';
				const closeButton = document.createElement('div');
				closeButton.textContent = '✕';
				Object.assign(closeButton.style, {
					cursor: 'pointer', padding: '0 10px', fontWeight: 'bold', fontSize: '18px',
					borderLeft: '1px solid #ccc', marginLeft: '5px'
				});
				closeButton.addEventListener('click', (e) => {
					e.preventDefault();
					const store = getStoredData();
					store[id] = Date.now();
					saveToStore(store);
					injectStyles();
				});
				container.appendChild(closeButton);
			}
		});
	};

	GM_registerMenuCommand('Ignorierte Listings zurücksetzen', () => {
		localStorage.removeItem(STORAGE_KEY);
		location.reload();
	});

	injectStyles();

	const observer = new MutationObserver(() => {
		injectStyles();
		initializeUI();
		forceShowPrices();
		injectMapButton();
	});

	const start = () => {
		observer.observe(document.body, { childList: true, subtree: true });
		initializeUI();
		forceShowPrices();
		injectMapButton();
	};

	if (document.body) {
		start();
	} else {
		const checkBody = setInterval(() => { if (document.body) { clearInterval(checkBody); start(); } }, 100);
	}
})();
