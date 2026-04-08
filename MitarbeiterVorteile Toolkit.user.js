// ==UserScript==
// @name         mitarbeitervorteile.de Toolkit
// @namespace    1110101
// @version      1.0.0
// @description  Sort and filter offers on employee benefits portal by discount percentage
// @author       1110101@oczc.de
// @match        https://*.mitarbeitervorteile.de/offers.action*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mitarbeitervorteile.de
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/MitarbeiterVorteile%20Toolkit.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/MitarbeiterVorteile%20Toolkit.user.js
// ==/UserScript==

(function () {
	'use strict';

	const CONFIG = {
		selectors: {
			offerCard: '.offer-card',
			offerDetails: '.offer-details',
			offerList: '.offer-list',
			discountBox: '.title .box .text',
			discountTitle: '.title',
			offersContainer: '.offers-list, .offers-grid, [class*="offers"]',
			mainContent: '#container, main, .main-content'
		},
		classes: {
			controlsContainer: 'discount-controls',
			sortButton: 'sort-btn',
			filterButton: 'filter-btn',
			active: 'active'
		}
	};

	const SORT_STATES = {
		desc: { icon: '↓', label: 'Höchste zuerst', active: true },
		asc: { icon: '↑', label: 'Niedrigste zuerst', active: true },
		off: { icon: '—', label: 'Sortierung aus', active: false }
	};

	const GLOBAL_STATE = {
		sortState: 'desc',
		filterState: 'all',
		filterRanges: null,
		initialized: false,
		pauseObserver: null // Temporarily disconnects the MutationObserver during DOM reordering to prevent feedback loops
	};

	const STATE_STORAGE_KEY = 'discountSorter_state';
	const STATE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

	function saveState() {
		try {
			const currentPage = getCurrentPage();
			const nativeSort = getNativeSortValue();
			const state = {
				sortState: GLOBAL_STATE.sortState,
				filterState: GLOBAL_STATE.filterState,
				currentPage,
				nativeSortValue: nativeSort,
				timestamp: Date.now(),
				url: window.location.pathname + window.location.search
			};
			sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
		} catch {
			// Silent fail
		}
	}

	/**
	 * @returns {Object|null} Saved state, or null if not found/expired
	 */
	function loadState() {
		try {
			const stored = sessionStorage.getItem(STATE_STORAGE_KEY);

			if (!stored) {return null;}

			const state = JSON.parse(stored);

			const age = Date.now() - state.timestamp;
			if (age > STATE_MAX_AGE) {
				sessionStorage.removeItem(STATE_STORAGE_KEY);
				return null;
			}

			const currentUrl = window.location.pathname + window.location.search;
			if (state.url !== currentUrl) {
				return null;
			}

			return state;
		} catch {
			return null;
		}
	}

	/**
	 * @returns {string|null} Current sort value (RANK, DATE, RATING, DISCOUNT)
	 */
	function getNativeSortValue() {
		const sortContainer = document.querySelector('.sort.advanced-filter');
		if (!sortContainer) {return null;}

		const activeOption = sortContainer.querySelector('.options.active');
		return activeOption?.getAttribute('data-value') || null;
	}

	/**
	 * Activate native "Rabatt" (discount) sort if not already active.
	 * Only auto-activates from the default RANK sort unless force=true.
	 * @param {boolean} force
	 */
	function activateNativeDiscountSort(force = false) {
		const sortContainer = document.querySelector('.sort.advanced-filter');
		if (!sortContainer) {
			return false;
		}

		const activeOption = sortContainer.querySelector('.options.active');
		const currentSort = activeOption?.getAttribute('data-value');
		const isDiscountActive = currentSort === 'DISCOUNT';

		if (isDiscountActive) {
			return true;
		}

		// Only activate if forced or if we're on the default (RANK)
		if (!force && currentSort !== 'RANK') {
			return false;
		}

		const discountOption = sortContainer.querySelector('.options[data-value="DISCOUNT"]');
		if (discountOption) {
			discountOption.click();
			return true;
		} else {
			return false;
		}
	}

	/**
	 * @returns {number} Current page, 0-indexed
	 */
	function getCurrentPage() {
		const activePage = document.querySelector('.pagination .page-item.active');
		if (!activePage) {
			return 0;
		}

		const text = activePage.textContent.trim();
		const pageNumber = parseInt(text);
		return isNaN(pageNumber) ? 0 : pageNumber - 1;
	}

	/**
	 * @param {number} pageIndex - 0-indexed
	 */
	function goToPage(pageIndex) {
		if (pageIndex === 0) {
			const currentPage = getCurrentPage();
			if (currentPage === 0) {
				return;
			}

			// Page 1 may not have a data-page attribute
			const page1Link = document.querySelector('.pagination a[aria-label*="Gehe zu 1 Seite"]');
			if (page1Link) {
				page1Link.click();
				return;
			}
		}

		// data-page is 0-indexed: data-page="0" = page 1, data-page="1" = page 2, etc.
		const pageLink = document.querySelector(`.pagination a[data-page="${pageIndex}"]`);
		if (pageLink) {
			pageLink.click();
		}
	}

	/**
	 * Parse discount text and return numeric value for sorting.
	 * @param {string} discountText - e.g. "-10 %", "10% Cashback", "-4,5 %"
	 * @returns {number}
	 */
	function parseDiscountValue(discountText) {
		if (!discountText) {return 0;}

		const text = discountText.trim();

		// "10% Cashback"
		const cashbackMatch = text.match(/(\d+[.,]?\d*)\s*%?\s*[Cc]ashback/);
		if (cashbackMatch) {
			const value = cashbackMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// "-10 %", "-4,5 %"
		const standardMatch = text.match(/-?\s*(\d+[.,]?\d*)\s*%/);
		if (standardMatch) {
			const value = standardMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// e.g. "Zalando 50€ + 15% Sports Coupon on top"
		const percentMatch = text.match(/(\d+[.,]?\d*)\s*%/);
		if (percentMatch) {
			const value = percentMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// "< 25%" or "> 7%"
		const comparisonMatch = text.match(/[<>]\s*(\d+[.,]?\d*)\s*%/);
		if (comparisonMatch) {
			const value = comparisonMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		const numberMatch = text.match(/(\d+[.,]?\d*)/);
		if (numberMatch) {
			const value = numberMatch[1].replace(',', '.');
			const parsed = parseFloat(value);
			// Reject implausibly large numbers that aren't a discount percentage
			return parsed <= 100 ? parsed : 0;
		}

		return 0;
	}

	/**
	 * @param {HTMLElement} offerCard
	 * @returns {number}
	 */
	function getOfferDiscountValue(offerCard) {
		const offerDetails = offerCard.querySelector(CONFIG.selectors.offerDetails);
		if (!offerDetails) {return 0;}

		const discountBox = offerDetails.querySelector(CONFIG.selectors.discountBox);
		if (discountBox) {
			const discountText = discountBox.textContent.trim();
			return parseDiscountValue(discountText);
		}

		const titleElement = offerDetails.querySelector(CONFIG.selectors.discountTitle);
		if (titleElement) {
			const discountText = titleElement.textContent.trim();
			return parseDiscountValue(discountText);
		}

		return 0;
	}

	function storeOriginalOrder() {
		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		offerCards.forEach((card, index) => {
			if (!card.dataset.originalIndex) {
				card.dataset.originalIndex = index;
			}
		});
	}

	/**
	 * @param {boolean} ascending
	 */
	function sortOffersByDiscount(ascending = false) {
		const offerCards = Array.from(document.querySelectorAll(CONFIG.selectors.offerCard));
		if (offerCards.length === 0) {return;}

		const offerList = document.querySelector(CONFIG.selectors.offerList);
		if (!offerList) {return;}

		offerCards.sort((a, b) => {
			const valueA = getOfferDiscountValue(a);
			const valueB = getOfferDiscountValue(b);

			if (ascending) {
				return valueA - valueB;
			} else {
				return valueB - valueA;
			}
		});

		offerCards.forEach(card => {
			offerList.appendChild(card);
		});
	}

	function restoreOriginalOrder() {
		const offerCards = Array.from(document.querySelectorAll(CONFIG.selectors.offerCard));
		if (offerCards.length === 0) {return;}

		const offerList = document.querySelector(CONFIG.selectors.offerList);
		if (!offerList) {return;}

		offerCards.sort((a, b) => {
			const indexA = parseInt(a.dataset.originalIndex) || 0;
			const indexB = parseInt(b.dataset.originalIndex) || 0;
			return indexA - indexB;
		});

		offerCards.forEach(card => {
			offerList.appendChild(card);
		});
	}

	/**
	 * @param {string} filterType - 'all', 'high', 'medium', 'low'
	 */
	function filterOffersByDiscount(filterType) {
		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		const ranges = GLOBAL_STATE.filterRanges;

		offerCards.forEach(card => {
			const discountValue = getOfferDiscountValue(card);
			let show = true;

			if (filterType === 'all') {
				show = true;
			} else if (ranges && filterType in ranges) {
				const [min, max] = ranges[filterType];
				show = discountValue >= min && discountValue <= max;
			}

			card.style.display = show ? '' : 'none';
		});
	}

	/**
	 * @returns {{ high: [number, number], medium: [number, number], low: [number, number] }}
	 */
	function calculateFilterRanges() {
		const allDiscounts = [];

		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		offerCards.forEach(card => {
			const discountValue = getOfferDiscountValue(card);
			if (discountValue > 0) {
				allDiscounts.push(discountValue);
			}
		});

		if (allDiscounts.length === 0) {
			return {
				high: [15, Infinity],
				medium: [10, 15],
				low: [0, 10]
			};
		}

		allDiscounts.sort((a, b) => a - b);

		const [min] = allDiscounts;
		const max = allDiscounts[allDiscounts.length - 1];

		// Split into three equal bands (tertiles)
		const tertile1Index = Math.floor(allDiscounts.length / 3);
		const tertile2Index = Math.floor((allDiscounts.length * 2) / 3);

		const tertile1 = allDiscounts[tertile1Index];
		const tertile2 = allDiscounts[tertile2Index];

		return {
			low: [min, tertile1],
			medium: [tertile1, tertile2],
			high: [tertile2, max]
		};
	}

	function applySortState() {
		if (GLOBAL_STATE.pauseObserver) {
			GLOBAL_STATE.pauseObserver();
		}

		if (GLOBAL_STATE.sortState === 'desc') {
			sortOffersByDiscount(false);
		} else if (GLOBAL_STATE.sortState === 'asc') {
			sortOffersByDiscount(true);
		} else {
			restoreOriginalOrder();
		}
	}

	function applyFilterState() {
		if (GLOBAL_STATE.pauseObserver) {
			GLOBAL_STATE.pauseObserver();
		}

		filterOffersByDiscount(GLOBAL_STATE.filterState);
	}

	/**
	 * Sort toggle button with 3 states.
	 * @returns {HTMLElement}
	 */
	function createSortToggleButton() {
		const button = document.createElement('button');
		const baseColor = '#007bff';
		button.dataset.buttonType = 'sort';

		const updateButtonUI = () => {
			const stateInfo = SORT_STATES[GLOBAL_STATE.sortState];
			button.textContent = `${stateInfo.icon} ${stateInfo.label}`;

			if (stateInfo.active) {
				button.style.background = baseColor;
				button.style.color = 'white';
				button.style.borderColor = baseColor;
			} else {
				button.style.background = 'white';
				button.style.color = baseColor;
				button.style.borderColor = baseColor;
			}
		};

		button.style.cssText = `
            padding: 6px 12px;
            border: 1px solid ${baseColor};
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            white-space: nowrap;
            font-weight: 500;
        `;

		button.addEventListener('click', () => {
			const currentState = GLOBAL_STATE.sortState;
			let newState;

			// Cycle: desc -> asc -> off -> desc
			if (currentState === 'desc') {
				newState = 'asc';
			} else if (currentState === 'asc') {
				newState = 'off';
			} else {
				newState = 'desc';
			}

			GLOBAL_STATE.sortState = newState;
			applySortState();
			updateAllSortButtons();
			saveState();
		});

		button.addEventListener('mouseenter', () => {
			if (!SORT_STATES[GLOBAL_STATE.sortState].active) {
				button.style.background = baseColor;
				button.style.color = 'white';
			}
		});

		button.addEventListener('mouseleave', () => {
			updateButtonUI();
		});

		updateButtonUI();

		return button;
	}

	/**
	 * @param {string} text
	 * @param {Function} onClick
	 * @param {string} filterType - 'all', 'high', 'medium', 'low'
	 * @returns {HTMLElement}
	 */
	function createFilterButton(text, onClick, filterType) {
		const button = document.createElement('button');
		button.textContent = text;
		button.dataset.buttonType = 'filter';
		button.dataset.filterType = filterType;

		const baseColor = '#28a745';

		button.style.cssText = `
            padding: 6px 12px;
            border: 1px solid ${baseColor};
            background: white;
            color: ${baseColor};
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            white-space: nowrap;
            font-weight: 500;
        `;

		button.addEventListener('mouseenter', () => {
			if (!button.classList.contains(CONFIG.classes.active)) {
				button.style.background = baseColor;
				button.style.color = 'white';
			}
		});

		button.addEventListener('mouseleave', () => {
			if (!button.classList.contains(CONFIG.classes.active)) {
				button.style.background = 'white';
				button.style.color = baseColor;
			}
		});

		button.addEventListener('click', onClick);
		return button;
	}

	/**
	 * @returns {HTMLElement}
	 */
	function createControlButtons() {
		const controlsContainer = document.createElement('div');
		controlsContainer.className = CONFIG.classes.controlsContainer;
		controlsContainer.style.cssText = `
            margin: 15px 0;
            padding: 12px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

		const sortBtn = createSortToggleButton();

		const filterLabel = document.createElement('span');
		filterLabel.textContent = 'Filtern:';
		filterLabel.style.fontWeight = 'bold';
		filterLabel.style.marginLeft = '10px';
		filterLabel.style.marginRight = '4px';
		filterLabel.style.fontSize = '13px';

		const ranges = GLOBAL_STATE.filterRanges;
		let lowLabel = 'Niedrig';
		let mediumLabel = 'Mittel';
		let highLabel = 'Hoch';

		if (ranges) {
			lowLabel = `${Math.round(ranges.low[0])}-${Math.round(ranges.low[1])}%`;
			mediumLabel = `${Math.round(ranges.medium[0])}-${Math.round(ranges.medium[1])}%`;
			highLabel = `${Math.round(ranges.high[0])}-${Math.round(ranges.high[1])}%`;
		}

		const filterAllBtn = createFilterButton('Alle', () => {
			GLOBAL_STATE.filterState = 'all';
			applyFilterState();
			updateAllFilterButtons('all');
			saveState();
		}, 'all');
		filterAllBtn.classList.add(CONFIG.classes.active);
		filterAllBtn.style.background = '#28a745';
		filterAllBtn.style.color = 'white';

		const filterLowBtn = createFilterButton(lowLabel, () => {
			GLOBAL_STATE.filterState = 'low';
			applyFilterState();
			updateAllFilterButtons('low');
			saveState();
		}, 'low');

		const filterMediumBtn = createFilterButton(mediumLabel, () => {
			GLOBAL_STATE.filterState = 'medium';
			applyFilterState();
			updateAllFilterButtons('medium');
			saveState();
		}, 'medium');

		const filterHighBtn = createFilterButton(highLabel, () => {
			GLOBAL_STATE.filterState = 'high';
			applyFilterState();
			updateAllFilterButtons('high');
			saveState();
		}, 'high');

		controlsContainer.appendChild(sortBtn);
		controlsContainer.appendChild(filterLabel);
		controlsContainer.appendChild(filterAllBtn);
		controlsContainer.appendChild(filterLowBtn);
		controlsContainer.appendChild(filterMediumBtn);
		controlsContainer.appendChild(filterHighBtn);

		return controlsContainer;
	}

	function updateAllSortButtons() {
		const allSortButtons = document.querySelectorAll('button[data-button-type="sort"]');
		const stateInfo = SORT_STATES[GLOBAL_STATE.sortState];
		const baseColor = '#007bff';

		allSortButtons.forEach(btn => {
			btn.textContent = `${stateInfo.icon} ${stateInfo.label}`;
			if (stateInfo.active) {
				btn.style.background = baseColor;
				btn.style.color = 'white';
				btn.style.borderColor = baseColor;
			} else {
				btn.style.background = 'white';
				btn.style.color = baseColor;
				btn.style.borderColor = baseColor;
			}
		});
	}

	/**
	 * @param {string} filterType - The active filter type
	 */
	function updateAllFilterButtons(filterType) {
		const allContainers = document.querySelectorAll(`.${CONFIG.classes.controlsContainer}`);
		const ranges = GLOBAL_STATE.filterRanges;

		allContainers.forEach(container => {
			const filterButtons = container.querySelectorAll('button[data-button-type="filter"]');
			const baseColor = '#28a745';

			filterButtons.forEach(btn => {
				const btnFilterType = btn.dataset.filterType;
				const isActive = btnFilterType === filterType;

				if (ranges && btnFilterType && btnFilterType !== 'all') {
					const [min, max] = ranges[btnFilterType];
					btn.textContent = `${Math.round(min)}-${Math.round(max)}%`;
				}

				btn.classList.toggle(CONFIG.classes.active, isActive);
				if (isActive) {
					btn.style.background = baseColor;
					btn.style.color = 'white';
					btn.style.borderColor = baseColor;
				} else {
					btn.style.background = 'white';
					btn.style.color = baseColor;
					btn.style.borderColor = baseColor;
				}
			});
		});
	}

	function addPaginationListeners() {
		const paginationLinks = document.querySelectorAll('.pagination a');
		paginationLinks.forEach(link => {
			if (link.dataset.paginationListener) {return;} // Skip if already added
			link.dataset.paginationListener = 'true';

			link.addEventListener('click', () => {
				// Short delay to let the page change before saving
				setTimeout(() => {
					saveState();
				}, 500);
			});
		});
	}

	/**
	 * Replace "Online" action buttons with real <a> links so middle-click and Ctrl+Click work.
	 */
	function makeOfferCardsMiddleClickable() {
		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);

		offerCards.forEach(card => {
			if (card.dataset.middleClickEnabled) {return;}
			card.dataset.middleClickEnabled = 'true';

			const url = card.getAttribute('data-url');
			if (!url) {return;}

			const onlineButton = card.querySelector('button.stamp-online, button.button-default');
			if (!onlineButton) {return;}

			const buttonText = onlineButton.textContent;
			const buttonClasses = onlineButton.className;

			const link = document.createElement('a');
			link.href = url;
			link.textContent = buttonText;
			link.className = buttonClasses;
			link.style.cssText = `
				display: inline-block;
				text-decoration: none;
				cursor: pointer;
			`;

			if (onlineButton.hasAttribute('aria-label')) {
				link.setAttribute('aria-label', onlineButton.getAttribute('aria-label'));
			}

			link.addEventListener('click', () => {
				saveState();
			});

			// Save state on middle-click and Ctrl+Click so it survives navigation
			link.addEventListener('mousedown', (e) => {
				if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
					saveState();
				}
			});

			onlineButton.parentNode.replaceChild(link, onlineButton);
		});
	}

	function initialize() {
		if (GLOBAL_STATE.initialized) {
			return;
		}

		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		if (offerCards.length === 0) {
			return;
		}

		const controlsExist = document.querySelector(`.${CONFIG.classes.controlsContainer}`);

		const offerList = document.querySelector(CONFIG.selectors.offerList);
		if (!offerList) {
			return;
		}

		const savedState = loadState();

		if (savedState) {
			GLOBAL_STATE.sortState = savedState.sortState;
			GLOBAL_STATE.filterState = savedState.filterState;

			if (savedState.nativeSortValue === 'DISCOUNT') {
				setTimeout(() => {
					activateNativeDiscountSort(true);
				}, 300);
			}
		} else {
			activateNativeDiscountSort(false);
		}

		if (!controlsExist) {
			storeOriginalOrder();
		}

		GLOBAL_STATE.filterRanges = calculateFilterRanges();

		if (!controlsExist) {
			const controls = createControlButtons();
			offerList.parentElement.insertBefore(controls, offerList);
		}

		applySortState();
		applyFilterState();

		updateAllSortButtons();
		updateAllFilterButtons(GLOBAL_STATE.filterState);

		makeOfferCardsMiddleClickable();
		addPaginationListeners();

		GLOBAL_STATE.initialized = true;

		// Navigate to saved page after a short delay to let the page settle
		if (savedState && savedState.currentPage > 0) {
			setTimeout(() => {
				const currentPage = getCurrentPage();
				if (currentPage !== savedState.currentPage) {
					goToPage(savedState.currentPage);
				}
			}, 500);
		}
	}

	function waitForContent() {
		let observer = null;

		// Temporarily disconnects the observer during DOM reordering to prevent feedback loops
		GLOBAL_STATE.pauseObserver = () => {
			if (observer) {
				observer.disconnect();
				setTimeout(() => {
					if (observer) {
						observer.observe(document.body, {
							childList: true,
							subtree: true
						});
					}
				}, 300);
			}
		};

		observer = new MutationObserver((mutations) => {
			let hasNewOfferCards = false;
			let hasReallyNewCards = false;

			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (node.classList?.contains('offer-card')) {
								hasNewOfferCards = true;
								// Distinguish freshly-added cards from re-sorted ones
								if (!node.dataset.originalIndex && !node.dataset.middleClickEnabled) {
									hasReallyNewCards = true;
								}
							} else if (node.querySelector?.(CONFIG.selectors.offerCard)) {
								const cards = node.querySelectorAll(CONFIG.selectors.offerCard);
								cards.forEach(card => {
									if (!card.dataset.originalIndex && !card.dataset.middleClickEnabled) {
										hasReallyNewCards = true;
										hasNewOfferCards = true;
									}
								});
							}
						}
					});
				}
			});

			if (hasNewOfferCards && !GLOBAL_STATE.initialized) {
				setTimeout(() => {
					initialize();
				}, 100);
			} else if (hasReallyNewCards && GLOBAL_STATE.initialized) {
				setTimeout(() => {
					const newCards = document.querySelectorAll(CONFIG.selectors.offerCard);
					newCards.forEach((card, index) => {
						if (!card.dataset.originalIndex) {
							card.dataset.originalIndex = index;
						}
					});

					applySortState();
					applyFilterState();

					makeOfferCardsMiddleClickable();
					addPaginationListeners();
				}, 100);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		// Small delay to ensure DOM is ready
		setTimeout(() => {
			initialize();
		}, 500);
	}

	waitForContent();

})();

