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
	const NOTES_STORAGE_KEY = 'is24_expose_notes_v1';
	const CLEANUP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

	const USER_BLOCK_SELECTORS = [
		'div.touchpoint-card',
		'div.single-ad-card',
		'div.ad-card',
		'div.quick-prompts-card'
	];

	const getStoredData = () => {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		} catch (_e) {
			return {};
		}
	};

	const saveToStore = (data) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	};

	const getStoredNotes = () => {
		try {
			return JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '{}');
		} catch (_e) {
			return {};
		}
	};

	const saveNotesToStore = (notes) => {
		localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
	};

	const cleanStaleNotes = () => {
		const notes = getStoredNotes();
		const now = Date.now();
		let changed = false;
		for (const [id, data] of Object.entries(notes)) {
			if (now - data.updatedAt > CLEANUP_DURATION_MS) {
				delete notes[id];
				changed = true;
			}
		}
		if (changed) {
			saveNotesToStore(notes);
		}
	};

	const saveNote = (id, text) => {
		const notes = getStoredNotes();
		const trimmedText = text.trim();
		if (trimmedText) {
			notes[id] = {
				text: trimmedText,
				updatedAt: Date.now()
			};
		} else {
			delete notes[id];
		}
		saveNotesToStore(notes);
	};

	const attachNoteSaver = (textarea, id, savedIndicator) => {
		let saveDebounce = null;
		textarea.addEventListener('input', () => {
			if (saveDebounce) {
				clearTimeout(saveDebounce);
			}
			saveDebounce = setTimeout(() => {
				saveNote(id, textarea.value);
				savedIndicator.style.opacity = '1';
				setTimeout(() => {
					savedIndicator.style.opacity = '0';
				}, 1500);
			}, 500);
		});
	};

	const setIgnoreState = (id, ignore) => {
		const store = getStoredData();
		if (ignore) {
			store[id] = Date.now();
		} else {
			delete store[id];
		}
		saveToStore(store);
		injectStyles();
	};

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
		let styles = allBlocked.length > 0 ? `${allBlocked.join(',\n')} { display: none !important; }` : '';
		styles += '\n[class*="thumbnailsContainer_"] { margin-left: 0 !important; margin-right: 0 !important; width: 100% !important; max-width: 100% !important; }';
		styles += '\n#is24-expose-travel-time, #is24-expose-available-services { display: none !important; }';
		styles += `
			.is24-enlarged-gallery [class*="mainSlidesContainer"] {
				margin-left: 0 !important;
				margin-right: 0 !important;
				width: 100% !important;
				height: 73vh !important;
				max-height: 73vh !important;
			}
			.is24-enlarged-gallery [class*="mainSlidesContainer"] [class*="slick-slider"],
			.is24-enlarged-gallery [class*="mainSlidesContainer"] [class*="slick-list"],
			.is24-enlarged-gallery [class*="mainSlidesContainer"] [class*="slick-track"],
			.is24-enlarged-gallery [class*="mainSlidesContainer"] .slick-slide,
			.is24-enlarged-gallery [class*="mainSlidesContainer"] .slick-slide > div {
				height: 100% !important;
				max-height: none !important;
			}
			.is24-enlarged-gallery [class*="imageContainer"] {
				width: 100% !important;
				height: 100% !important;
			}
			.is24-enlarged-gallery [class*="imageContainer"] img {
				width: 100% !important;
				height: 100% !important;
				max-height: 100% !important;
				object-fit: contain !important;
				cursor: zoom-out !important;
			}
			[class*="mainSlidesContainer"] img {
				cursor: zoom-in;
			}
			.is24-card-note-container {
				padding: 8px 12px;
				border-top: 1px solid #e5e5e5;
				background: #fdfdfd;
				display: flex;
				flex-direction: column;
				gap: 4px;
			}
			.is24-card-note-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.is24-card-note-title {
				font-size: 11px;
				font-weight: bold;
				color: #666;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}
			.is24-note-saved-indicator {
				font-size: 11px;
				color: #00aa00;
				opacity: 0;
				transition: opacity 0.3s;
				font-weight: bold;
			}
			.is24-card-note-input {
				width: 100% !important;
				min-height: 36px;
				height: 36px;
				border: 1px solid #ccc !important;
				border-radius: 4px !important;
				padding: 4px 8px !important;
				font-size: 13px !important;
				resize: vertical !important;
				box-sizing: border-box !important;
				font-family: inherit !important;
				background: #fff !important;
			}
			.is24-expose-note-container {
				margin: 15px 0;
				padding: 12px 16px;
				background: #fdfdfd;
				border: 1px solid #e5e5e5;
				border-radius: 8px;
				box-shadow: 0 1px 3px rgba(0,0,0,0.05);
			}
			.is24-expose-note-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 6px;
			}
			.is24-expose-note-title {
				font-size: 12px;
				font-weight: bold;
				color: #555;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}
			.is24-expose-note-input {
				width: 100% !important;
				min-height: 60px;
				border: 1px solid #ccc !important;
				border-radius: 6px !important;
				padding: 8px 12px !important;
				font-size: 14px !important;
				line-height: 1.4 !important;
				resize: vertical !important;
				box-sizing: border-box !important;
				font-family: inherit !important;
				background: #fff !important;
			}
		`;
		styleEl.textContent = styles;
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
				container.style.flexWrap = 'nowrap';
				if (container.parentElement) {
					container.parentElement.style.width = 'auto';
					container.parentElement.style.minWidth = '75px';
					container.parentElement.style.overflow = 'visible';
				}
				const closeButton = document.createElement('div');
				closeButton.textContent = '✕';
				Object.assign(closeButton.style, {
					cursor: 'pointer', padding: '0 10px', fontWeight: 'bold', fontSize: '18px',
					borderLeft: '1px solid #ccc', marginLeft: '5px'
				});
				closeButton.addEventListener('click', (e) => {
					e.preventDefault();
					setIgnoreState(id, true);
				});
				container.appendChild(closeButton);

				// Inject persistent note box at the bottom of the card
				const notes = getStoredNotes();
				const noteData = notes[id] || { text: '' };

				const noteContainer = document.createElement('div');
				noteContainer.className = 'is24-card-note-container';
				noteContainer.innerHTML = `
					<div class="is24-card-note-header">
						<span class="is24-card-note-title">Persönliche Notiz</span>
						<span class="is24-note-saved-indicator">Gespeichert</span>
					</div>
					<textarea class="is24-card-note-input" placeholder="Notiz für dieses Exposé hinzufügen..."></textarea>
				`;

				const textarea = noteContainer.querySelector('.is24-card-note-input');
				textarea.value = noteData.text || '';
				const savedIndicator = noteContainer.querySelector('.is24-note-saved-indicator');

				// Prevent interactions from propagating to the card
				noteContainer.addEventListener('click', (e) => {
					e.stopPropagation();
				});
				noteContainer.addEventListener('mousedown', (e) => {
					e.stopPropagation();
				});

				attachNoteSaver(textarea, id, savedIndicator);
				listing.appendChild(noteContainer);
			}
		});
	};

	if (typeof GM_registerMenuCommand !== 'undefined') {
		GM_registerMenuCommand('Ignorierte Listings zurücksetzen', () => {
			localStorage.removeItem(STORAGE_KEY);
			location.reload();
		});
	}

	let accumulatedDelta = 0;
	let pendingSlides = 0;
	let queueTimeout = null;
	let resetAccumulatorTimeout = null;
	const SCROLL_THRESHOLD = 60;

	const processQueue = () => {
		if (pendingSlides === 0) {
			queueTimeout = null;
			return;
		}

		const gallery = document.querySelector('[data-testid="gallery-layer"]');
		if (!gallery) {
			pendingSlides = 0;
			queueTimeout = null;
			return;
		}

		const track = gallery.querySelector('.slick-track');
		if (track && (track.style.transition || track.style.webkitTransition)) {
			queueTimeout = setTimeout(processQueue, 20);
			return;
		}

		if (pendingSlides > 0) {
			const nextBtn = gallery.querySelector('[data-testid="chevron-right"]');
			if (nextBtn && !nextBtn.classList.contains('slick-disabled')) {
				const svg = nextBtn.querySelector('svg');
				const target = svg || nextBtn;
				target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
				pendingSlides--;
			} else {
				pendingSlides = 0;
			}
		} else if (pendingSlides < 0) {
			const prevBtn = gallery.querySelector('[data-testid="chevron-left"]');
			if (prevBtn && !prevBtn.classList.contains('slick-disabled')) {
				const svg = prevBtn.querySelector('svg');
				const target = svg || prevBtn;
				target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
				pendingSlides++;
			} else {
				pendingSlides = 0;
			}
		}

		queueTimeout = setTimeout(processQueue, 130);
	};

	document.addEventListener('wheel', (e) => {
		const gallery = document.querySelector('[data-testid="gallery-layer"]');
		if (!gallery) {
			return;
		}

		const delta = e.deltaY || e.deltaX;
		if (!delta) {
			return;
		}

		e.preventDefault();

		if (resetAccumulatorTimeout) {
			clearTimeout(resetAccumulatorTimeout);
		}

		resetAccumulatorTimeout = setTimeout(() => {
			accumulatedDelta = 0;
		}, 200);

		accumulatedDelta += delta;

		if (Math.abs(accumulatedDelta) >= SCROLL_THRESHOLD) {
			const direction = Math.sign(accumulatedDelta);
			pendingSlides = Math.min(5, Math.max(-5, pendingSlides + direction));
			accumulatedDelta = accumulatedDelta - (direction * SCROLL_THRESHOLD);
			if (Math.abs(accumulatedDelta) > SCROLL_THRESHOLD * 2) {
				accumulatedDelta = 0;
			}

			if (!queueTimeout) {
				processQueue();
			}
		}
	}, { capture: true, passive: false });

	document.addEventListener('click', (e) => {
		const gallery = document.querySelector('[data-testid="gallery-layer"]');
		if (!gallery) { return; }

		const isImageClick = e.target.tagName === 'IMG' && e.target.closest('[class*="mainSlidesContainer"]');
		if (isImageClick) {
			e.preventDefault();
			e.stopPropagation();
			document.body.classList.toggle('is24-enlarged-gallery');
		}
	});

	const initializeExposeUI = () => {
		const match = window.location.pathname.match(/\/expose\/(\d+)/);
		if (!match) {
			return;
		}

		const [, id] = match;
		const titleEl = document.getElementById('expose-title');
		if (titleEl && !document.getElementById(`is24-expose-note-${id}`)) {
			const container = document.createElement('div');
			container.id = `is24-expose-note-${id}`;
			container.className = 'is24-expose-note-container';

			const notes = getStoredNotes();
			const noteData = notes[id] || { text: '' };

			container.innerHTML = `
				<div class="is24-expose-note-header">
					<div style="display: flex; align-items: center; gap: 10px;">
						<span class="is24-expose-note-title">Persönliche Notiz</span>
						<button class="is24-expose-ignore-btn" style="padding: 2px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; background: #fff; font-family: inherit;"></button>
					</div>
					<span class="is24-note-saved-indicator">Gespeichert</span>
				</div>
				<textarea class="is24-expose-note-input" placeholder="Füge eine persönliche Notiz zu dieser Immobilie hinzu..."></textarea>
			`;

			const textarea = container.querySelector('.is24-expose-note-input');
			textarea.value = noteData.text || '';
			const savedIndicator = container.querySelector('.is24-note-saved-indicator');
			const ignoreBtn = container.querySelector('.is24-expose-ignore-btn');

			const updateIgnoreBtnState = () => {
				const store = getStoredData();
				const isIgnored = !!store[id];
				if (isIgnored) {
					ignoreBtn.textContent = '✕ Ignoriert';
					Object.assign(ignoreBtn.style, {
						backgroundColor: '#ffe6e6',
						borderColor: '#ff9999',
						color: '#cc0000'
					});
				} else {
					ignoreBtn.textContent = 'Ignorieren';
					Object.assign(ignoreBtn.style, {
						backgroundColor: '#ffffff',
						borderColor: '#cccccc',
						color: '#555555'
					});
				}
			};

			ignoreBtn.addEventListener('click', (e) => {
				e.preventDefault();
				const store = getStoredData();
				const isIgnored = !!store[id];
				setIgnoreState(id, !isIgnored);
				updateIgnoreBtnState();
			});

			updateIgnoreBtnState();
			attachNoteSaver(textarea, id, savedIndicator);

			titleEl.parentNode.insertBefore(container, titleEl.nextSibling);
		}
	};

	const autoExpandDescriptions = () => {
		document.querySelectorAll('.show-more a, .show-more button').forEach(el => {
			if (el.textContent && el.textContent.toLowerCase().includes('weiterlesen') && el.offsetParent !== null) {
				el.click();
			}
		});
	};

	injectStyles();

	const observer = new MutationObserver(() => {
		injectStyles();
		initializeUI();
		initializeExposeUI();
		autoExpandDescriptions();
		forceShowPrices();
		injectMapButton();
		if (!document.querySelector('[data-testid="gallery-layer"]')) {
			document.body.classList.remove('is24-enlarged-gallery');
		}
	});

	const start = () => {
		cleanStaleNotes();
		observer.observe(document.body, { childList: true, subtree: true });
		initializeUI();
		initializeExposeUI();
		autoExpandDescriptions();
		forceShowPrices();
		injectMapButton();
	};

	if (document.body) {
		start();
	} else {
		const checkBody = setInterval(() => {
			if (document.body) {
				clearInterval(checkBody);
				start();
			}
		}, 100);
	}
})();
