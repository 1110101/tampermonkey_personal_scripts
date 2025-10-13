// ==UserScript==
// @name				mitarbeitervorteile.de Toolkit
// @namespace			1110101
// @version				1.0.0
// @description			Sort and filter offers on employee benefits portal by discount percentage
// @author				1110101@oczc.de
// @match				https://*.mitarbeitervorteile.de/offers.action*
// @icon				https://www.google.com/s2/favicons?sz=64&domain=mitarbeitervorteile.de
// @grant				GM_addStyle
// @run-at				document-idle
// @license				MIT
// ==/UserScript==

(function () {
	'use strict';

	// Configuration
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

	// Global state
	const GLOBAL_STATE = {
		sortState: 'desc', // 'desc', 'asc', 'off'
		filterState: 'all', // 'all', 'high', 'medium', 'low'
		filterRanges: null, // Will be calculated dynamically
		originalOrder: new Map(), // Store original order of offers
		initialized: false, // Track if initialization is complete
		pauseObserver: null // Function to pause MutationObserver during sorting
	};

	// Session storage key for state persistence
	const STATE_STORAGE_KEY = 'discountSorter_state';
	const STATE_MAX_AGE = 5 * 60 * 1000; // 5 minutes in milliseconds

	/**
	 * Save current state to sessionStorage
	 */
	function saveState() {
		try {
			const currentPage = getCurrentPage();
			const nativeSort = getNativeSortValue();
			const state = {
				sortState: GLOBAL_STATE.sortState,
				filterState: GLOBAL_STATE.filterState,
				currentPage: currentPage,
				nativeSortValue: nativeSort,
				timestamp: Date.now(),
				url: window.location.pathname + window.location.search
			};
			sessionStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
		} catch (e) {
			// Silent fail
		}
	}

	/**
	 * Load state from sessionStorage
	 * @returns {Object|null} - Saved state or null if not found/expired
	 */
	function loadState() {
		try {
			const stored = sessionStorage.getItem(STATE_STORAGE_KEY);
			
			if (!stored) return null;

			const state = JSON.parse(stored);

			// Check if state is too old
			const age = Date.now() - state.timestamp;
			if (age > STATE_MAX_AGE) {
				sessionStorage.removeItem(STATE_STORAGE_KEY);
				return null;
			}

			// Check if we're on the same URL
			const currentUrl = window.location.pathname + window.location.search;
			if (state.url !== currentUrl) {
				return null;
			}

			return state;
		} catch (e) {
			return null;
		}
	}

	/**
	 * Get current native sort selection
	 * @returns {string|null} - Current sort value (RANK, DATE, RATING, DISCOUNT)
	 */
	function getNativeSortValue() {
		const sortContainer = document.querySelector('.sort.advanced-filter');
		if (!sortContainer) return null;
		
		const activeOption = sortContainer.querySelector('.options.active');
		return activeOption?.getAttribute('data-value') || null;
	}

	/**
	 * Activate native "Rabatt" (discount) sorting if not already active
	 * @param {boolean} force - Force activation even if another sort is active
	 */
	function activateNativeDiscountSort(force = false) {
		// Find the sort dropdown
		const sortContainer = document.querySelector('.sort.advanced-filter');
		if (!sortContainer) {
			return false;
		}

		// Check if "Rabatt" is already active
		const activeOption = sortContainer.querySelector('.options.active');
		const currentSort = activeOption?.getAttribute('data-value');
		const isDiscountActive = currentSort === 'DISCOUNT';
		
		if (isDiscountActive) {
			return true;
		}

		// Only activate if forced or if we're on default (RANK)
		if (!force && currentSort !== 'RANK') {
			return false;
		}

		// Find and click the "Rabatt" option
		const discountOption = sortContainer.querySelector('.options[data-value="DISCOUNT"]');
		if (discountOption) {
			discountOption.click();
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Get current page number from pagination
	 * @returns {number} - Current page (0-indexed)
	 */
	function getCurrentPage() {
		const activePage = document.querySelector('.pagination .page-item.active');
		if (!activePage) {
			return 0;
		}

		const text = activePage.textContent.trim();
		const pageNumber = parseInt(text);
		const result = isNaN(pageNumber) ? 0 : pageNumber - 1; // Convert to 0-indexed
		return result;
	}

	/**
	 * Navigate to a specific page
	 * @param {number} pageIndex - Page index (0-indexed)
	 */
	function goToPage(pageIndex) {
		if (pageIndex === 0) {
			// Page 1 might not have a data-page attribute, check for active
			const currentPage = getCurrentPage();
			if (currentPage === 0) {
				return; // Already on page 1
			}
			
			// Find the link for page 1 (might have data-page="0" or no data-page)
			const page1Link = document.querySelector('.pagination a[aria-label*="Gehe zu 1 Seite"]');
			if (page1Link) {
				page1Link.click();
				return;
			}
		}

		// For other pages, look for data-page attribute
		// data-page="0" = page 1, data-page="1" = page 2, etc.
		// So if pageIndex=2 (we want page 3), we need data-page="2"
		const pageLink = document.querySelector(`.pagination a[data-page="${pageIndex}"]`);
		if (pageLink) {
			pageLink.click();
		}
	}

	/**
	 * Parse discount text and return numeric value for sorting
	 * @param {string} discountText - The discount text like "-10 %", "10% Cashback", "-4,5 %"
	 * @returns {number} - Numeric value for sorting (higher = better discount)
	 */
	function parseDiscountValue(discountText) {
		if (!discountText) return 0;

		// Clean up text
		let text = discountText.trim();

		// Handle cashback format: "10% Cashback"
		const cashbackMatch = text.match(/(\d+[.,]?\d*)\s*%?\s*[Cc]ashback/);
		if (cashbackMatch) {
			const value = cashbackMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// Handle standard discount format: "-10 %", "-4,5 %"
		const standardMatch = text.match(/-?\s*(\d+[.,]?\d*)\s*%/);
		if (standardMatch) {
			const value = standardMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// Try to extract any percentage from complex strings
		// e.g., "Zalando 50€ + 15% Sports Coupon on top"
		const percentMatch = text.match(/(\d+[.,]?\d*)\s*%/);
		if (percentMatch) {
			const value = percentMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// Handle "< 25%" or "> 7%" format
		const comparisonMatch = text.match(/[<>]\s*(\d+[.,]?\d*)\s*%/);
		if (comparisonMatch) {
			const value = comparisonMatch[1].replace(',', '.');
			return parseFloat(value);
		}

		// Try to extract any number as last resort
		const numberMatch = text.match(/(\d+[.,]?\d*)/);
		if (numberMatch) {
			const value = numberMatch[1].replace(',', '.');
			const parsed = parseFloat(value);
			// If the number is very large, it's probably not a discount percentage
			return parsed <= 100 ? parsed : 0;
		}

		return 0;
	}

	/**
	 * Get discount value from an offer card element
	 * @param {HTMLElement} offerCard - The offer-card element
	 * @returns {number} - The discount value
	 */
	function getOfferDiscountValue(offerCard) {
		// Find the offer-details inside the card
		const offerDetails = offerCard.querySelector(CONFIG.selectors.offerDetails);
		if (!offerDetails) return 0;

		// Try to find discount in .title .box .text first
		const discountBox = offerDetails.querySelector(CONFIG.selectors.discountBox);
		if (discountBox) {
			const discountText = discountBox.textContent.trim();
			return parseDiscountValue(discountText);
		}

		// Fall back to .title element
		const titleElement = offerDetails.querySelector(CONFIG.selectors.discountTitle);
		if (titleElement) {
			const discountText = titleElement.textContent.trim();
			return parseDiscountValue(discountText);
		}

		return 0;
	}

	/**
	 * Store original order of offer cards
	 */
	function storeOriginalOrder() {
		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		offerCards.forEach((card, index) => {
			if (!card.dataset.originalIndex) {
				card.dataset.originalIndex = index;
				GLOBAL_STATE.originalOrder.set(card, index);
			}
		});
	}

	/**
	 * Sort all offer cards by discount value
	 * @param {boolean} ascending - Whether to sort ascending (default: false, descending)
	 */
	function sortOffersByDiscount(ascending = false) {
		const offerCards = Array.from(document.querySelectorAll(CONFIG.selectors.offerCard));
		if (offerCards.length === 0) return;

		// Get the parent container (offer-list)
		const offerList = document.querySelector(CONFIG.selectors.offerList);
		if (!offerList) return;

		// Sort by discount value
		offerCards.sort((a, b) => {
			const valueA = getOfferDiscountValue(a);
			const valueB = getOfferDiscountValue(b);

			if (ascending) {
				return valueA - valueB;
			} else {
				return valueB - valueA;
			}
		});

		// Re-append sorted offer cards to the list
		offerCards.forEach(card => {
			offerList.appendChild(card);
		});
	}

	/**
	 * Restore original order of offer cards
	 */
	function restoreOriginalOrder() {
		const offerCards = Array.from(document.querySelectorAll(CONFIG.selectors.offerCard));
		if (offerCards.length === 0) return;

		const offerList = document.querySelector(CONFIG.selectors.offerList);
		if (!offerList) return;

		// Sort by original index
		offerCards.sort((a, b) => {
			const indexA = parseInt(a.dataset.originalIndex) || 0;
			const indexB = parseInt(b.dataset.originalIndex) || 0;
			return indexA - indexB;
		});

		// Re-append in original order
		offerCards.forEach(card => {
			offerList.appendChild(card);
		});
	}

	/**
	 * Filter offer cards by discount range
	 * @param {string} filterType - The filter type ('all', 'high', 'medium', 'low')
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

			// Hide or show the entire offer card
			card.style.display = show ? '' : 'none';
		});
	}

	/**
	 * Calculate dynamic filter ranges based on all discount values
	 * @returns {Object} - Filter ranges { high: [min, max], medium: [min, max], low: [min, max] }
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
			// Fallback to fixed ranges if no discounts found
			return {
				high: [15, Infinity],
				medium: [10, 15],
				low: [0, 10]
			};
		}

		// Sort discounts to find percentiles
		allDiscounts.sort((a, b) => a - b);

		const min = allDiscounts[0];
		const max = allDiscounts[allDiscounts.length - 1];

		// Calculate tertiles (33rd and 66th percentile)
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

	/**
	 * Apply current global sort state
	 */
	function applySortState() {
		// Pause observer during sorting
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

	/**
	 * Apply current global filter state
	 */
	function applyFilterState() {
		// Pause observer during filtering
		if (GLOBAL_STATE.pauseObserver) {
			GLOBAL_STATE.pauseObserver();
		}
		
		filterOffersByDiscount(GLOBAL_STATE.filterState);
	}

	/**
	 * Create a sort toggle button with 3 states
	 * @returns {HTMLElement} - The button element
	 */
	function createSortToggleButton() {
		const button = document.createElement('button');
		const baseColor = '#007bff';
		button.dataset.buttonType = 'sort';

		// State icons and labels
		const states = {
			desc: { icon: '↓', label: 'Höchste zuerst', active: true },
			asc: { icon: '↑', label: 'Niedrigste zuerst', active: true },
			off: { icon: '—', label: 'Sortierung aus', active: false }
		};

		const updateButtonUI = () => {
			const stateInfo = states[GLOBAL_STATE.sortState];
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

			// Cycle through states: desc -> asc -> off -> desc
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
			saveState(); // Save state after sorting
		});

		button.addEventListener('mouseenter', () => {
			if (!states[GLOBAL_STATE.sortState].active) {
				button.style.background = baseColor;
				button.style.color = 'white';
			}
		});

		button.addEventListener('mouseleave', () => {
			updateButtonUI();
		});

		// Initial UI
		updateButtonUI();

		return button;
	}

	/**
	 * Create a filter button
	 * @param {string} text - Button text
	 * @param {Function} onClick - Click handler
	 * @param {string} filterType - The filter type identifier ('all', 'high', 'medium', 'low')
	 * @returns {HTMLElement} - The button element
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
	 * Create control buttons
	 * @returns {HTMLElement} - The controls container
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

		// Sort toggle button
		const sortBtn = createSortToggleButton();

		// Filter label
		const filterLabel = document.createElement('span');
		filterLabel.textContent = 'Filtern:';
		filterLabel.style.fontWeight = 'bold';
		filterLabel.style.marginLeft = '10px';
		filterLabel.style.marginRight = '4px';
		filterLabel.style.fontSize = '13px';

		// Get dynamic labels
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
			saveState(); // Save state after filtering
		}, 'all');
		filterAllBtn.classList.add(CONFIG.classes.active);
		filterAllBtn.style.background = '#28a745';
		filterAllBtn.style.color = 'white';

		const filterLowBtn = createFilterButton(lowLabel, () => {
			GLOBAL_STATE.filterState = 'low';
			applyFilterState();
			updateAllFilterButtons('low');
			saveState(); // Save state after filtering
		}, 'low');

		const filterMediumBtn = createFilterButton(mediumLabel, () => {
			GLOBAL_STATE.filterState = 'medium';
			applyFilterState();
			updateAllFilterButtons('medium');
			saveState(); // Save state after filtering
		}, 'medium');

		const filterHighBtn = createFilterButton(highLabel, () => {
			GLOBAL_STATE.filterState = 'high';
			applyFilterState();
			updateAllFilterButtons('high');
			saveState(); // Save state after filtering
		}, 'high');

		controlsContainer.appendChild(sortBtn);
		controlsContainer.appendChild(filterLabel);
		controlsContainer.appendChild(filterAllBtn);
		controlsContainer.appendChild(filterLowBtn);
		controlsContainer.appendChild(filterMediumBtn);
		controlsContainer.appendChild(filterHighBtn);

		return controlsContainer;
	}

	/**
	 * Update all sort buttons UI to match global state
	 */
	function updateAllSortButtons() {
		const allSortButtons = document.querySelectorAll('button[data-button-type="sort"]');
		const states = {
			desc: { icon: '↓', label: 'Höchste zuerst', active: true },
			asc: { icon: '↑', label: 'Niedrigste zuerst', active: true },
			off: { icon: '—', label: 'Sortierung aus', active: false }
		};
		const stateInfo = states[GLOBAL_STATE.sortState];
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
	 * Update all filter buttons UI to match global state
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

				// Update button label with dynamic ranges
				if (ranges && btnFilterType && btnFilterType !== 'all') {
					const [min, max] = ranges[btnFilterType];
					if (btnFilterType === 'low') {
						btn.textContent = `${Math.round(min)}-${Math.round(max)}%`;
					} else if (btnFilterType === 'medium') {
						btn.textContent = `${Math.round(min)}-${Math.round(max)}%`;
					} else if (btnFilterType === 'high') {
						btn.textContent = `${Math.round(min)}-${Math.round(max)}%`;
					}
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

	/**
	 * Add listeners to pagination links to save state AFTER navigation
	 */
	function addPaginationListeners() {
		const paginationLinks = document.querySelectorAll('.pagination a');
		paginationLinks.forEach(link => {
			if (link.dataset.paginationListener) return; // Skip if already added
			link.dataset.paginationListener = 'true';
			
			link.addEventListener('click', () => {
				// Save state after a short delay to let the page change
				setTimeout(() => {
					saveState();
				}, 500);
			});
		});
	}

	/**
	 * Convert "Online" buttons to links for native browser link behavior
	 */
	function makeOfferCardsMiddleClickable() {
		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		
		offerCards.forEach(card => {
			// Skip if already processed
			if (card.dataset.middleClickEnabled) return;
			card.dataset.middleClickEnabled = 'true';
			
			const url = card.getAttribute('data-url');
			if (!url) return;
			
			// Find the "Online" button (or similar action button)
			const onlineButton = card.querySelector('button.stamp-online, button.button-default');
			if (!onlineButton) return;
			
			// Get button properties before replacing
			const buttonText = onlineButton.textContent;
			const buttonClasses = onlineButton.className;
			
			// Create a link that looks like the button
			const link = document.createElement('a');
			link.href = url;
			link.textContent = buttonText;
			link.className = buttonClasses;
			link.style.cssText = `
				display: inline-block;
				text-decoration: none;
				cursor: pointer;
			`;
			
			// Copy relevant attributes
			if (onlineButton.hasAttribute('aria-label')) {
				link.setAttribute('aria-label', onlineButton.getAttribute('aria-label'));
			}
			
			// Save state when link is clicked (before navigation)
			link.addEventListener('click', () => {
				saveState();
			});
			
			// Also save state on middle-click and Ctrl+Click
			link.addEventListener('mousedown', (e) => {
				if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
					saveState();
				}
			});
			
			// Replace button with link
			onlineButton.parentNode.replaceChild(link, onlineButton);
		});
	}

	/**
	 * Initialize the controls
	 */
	function initialize() {
		// Prevent multiple initializations
		if (GLOBAL_STATE.initialized) {
			return;
		}

		// Check if offer cards exist
		const offerCards = document.querySelectorAll(CONFIG.selectors.offerCard);
		if (offerCards.length === 0) {
			return;
		}

		// Check if controls already exist
		const controlsExist = document.querySelector(`.${CONFIG.classes.controlsContainer}`);
		
		// Get the offer list container
		const offerList = document.querySelector(CONFIG.selectors.offerList);
		if (!offerList) {
			return;
		}

		// Try to restore saved state
		const savedState = loadState();
		
		if (savedState) {
			// Restore state values
			GLOBAL_STATE.sortState = savedState.sortState;
			GLOBAL_STATE.filterState = savedState.filterState;
			
			// Restore native sort if it was saved
			if (savedState.nativeSortValue === 'DISCOUNT') {
				setTimeout(() => {
					activateNativeDiscountSort(true); // Force it since it was saved
				}, 300);
			}
		} else {
			// No saved state - activate discount sort only if still on default (RANK)
			activateNativeDiscountSort(false); // Don't force
		}

		// Store original order if not already stored
		if (!controlsExist) {
			storeOriginalOrder();
		}

		// Calculate filter ranges
		GLOBAL_STATE.filterRanges = calculateFilterRanges();

		// Create controls if they don't exist
		if (!controlsExist) {
			const controls = createControlButtons();
			offerList.parentElement.insertBefore(controls, offerList);
		}

		// Apply sort and filter (either restored state or default)
		applySortState();
		applyFilterState();
		
		// Update button UI to reflect current state
		updateAllSortButtons();
		updateAllFilterButtons(GLOBAL_STATE.filterState);

		// Make offer cards middle-clickable
		makeOfferCardsMiddleClickable();

		// Add listeners to pagination links to save state
		addPaginationListeners();

		// Mark as initialized
		GLOBAL_STATE.initialized = true;

		// Navigate to saved page if needed (after a delay to let page settle)
		if (savedState && savedState.currentPage > 0) {
			setTimeout(() => {
				const currentPage = getCurrentPage();
				if (currentPage !== savedState.currentPage) {
					goToPage(savedState.currentPage);
				}
			}, 500);
		}
	}

	/**
	 * Wait for content and initialize
	 */
	function waitForContent() {
		let observer = null;
		
		// Store reference to observer for temporary disconnect
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
		
		// Use MutationObserver to watch for changes
		observer = new MutationObserver((mutations) => {
			let hasNewOfferCards = false;
			let hasReallyNewCards = false;

			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check if this is an offer-card
							if (node.classList?.contains('offer-card')) {
								hasNewOfferCards = true;
								// Check if it's really new (no originalIndex yet)
								if (!node.dataset.originalIndex && !node.dataset.middleClickEnabled) {
									hasReallyNewCards = true;
								}
							}
							// Or if it contains offer-cards
							else if (node.querySelector?.(CONFIG.selectors.offerCard)) {
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

			// If we haven't initialized yet and found offer cards, initialize
			if (hasNewOfferCards && !GLOBAL_STATE.initialized) {
				setTimeout(() => {
					initialize();
				}, 100);
			} else if (hasReallyNewCards && GLOBAL_STATE.initialized) {
				// Only if we found REALLY new cards (not just re-sorted)
				setTimeout(() => {
					// Store original order for new cards
					const newCards = document.querySelectorAll(CONFIG.selectors.offerCard);
					newCards.forEach((card, index) => {
						if (!card.dataset.originalIndex) {
							card.dataset.originalIndex = index;
						}
					});
					
					// Re-apply current sort and filter (will pause observer automatically)
					applySortState();
					applyFilterState();
					
					// Make new cards clickable
					makeOfferCardsMiddleClickable();
					
					// Update pagination listeners
					addPaginationListeners();
				}, 100);
			}
		});

		// Start observing
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		// Initial initialization with a small delay to ensure DOM is ready
		setTimeout(() => {
			initialize();
		}, 500);

		// Backup initialization after longer delay
		setTimeout(() => {
			initialize();
		}, 2000);
	}

	// Start the script
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', waitForContent);
	} else {
		waitForContent();
	}

})();

