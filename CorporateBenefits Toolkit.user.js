// ==UserScript==
// @name         CorporateBenefits Toolkit
// @namespace    1110101
// @version      1.1.0
// @description  Sort and filter offers by discount, fix shop buttons to open directly
// @author       1110101@oczc.de
// @match        https://*.mitarbeiterangebote.de/overview/*
// @match        https://*.mitarbeiterangebote.de/offer/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mitarbeiterangebote.de
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/CorporateBenefits%20Toolkit.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/CorporateBenefits%20Toolkit.user.js
// ==/UserScript==

(function () {
	'use strict';

	// Hide ads
	GM_addStyle(`
		.cbg3-ad {
			display: none !important;
		}
	`);

	// Configuration
	const CONFIG = {
		selectors: {
			category: '.cbg3-category',
			categoryContent: '.cbg3-category--content',
			listItem: '.cbg3-list-item',
			discountElement: '.cbg3-list-item--discount p',
			categoryHead: '.cbg3-category--head'
		},
		classes: {
			controlsContainer: 'cb-discount-controls',
			sortButton: 'cb-sort-btn',
			filterButton: 'cb-filter-btn',
			active: 'active'
		}
	};

	// Global state for all categories
	const GLOBAL_STATE = {
		sortState: 'desc', // 'desc', 'asc', 'off'
		filterState: 'all', // 'all', 'high', 'medium', 'low'
		filterRanges: null // Will be calculated dynamically: { high: [min, max], medium: [min, max], low: [min, max] }
	};

	/**
     * Parse discount text and return numeric value for sorting
     * @param {string} discountText - The discount text like "< 25% Rabatt", "15% Rabatt", "> 7% Rabatt"
     * @returns {number} - Numeric value for sorting (higher = better discount)
     */
	function parseDiscountValue(discountText) {
		if (!discountText) {return 0;}

		// Remove "Rabatt" and clean up text
		const text = discountText.replace(/\s*Rabatt\s*$/, '').trim();

		// Handle different formats
		const lessThanMatch = text.match(/^<\s*(\d+)%?$/);
		if (lessThanMatch) {
			return parseInt(lessThanMatch[1]);
		}

		const greaterThanMatch = text.match(/^>\s*(\d+)%?$/);
		if (greaterThanMatch) {
			return parseInt(greaterThanMatch[1]);
		}

		const exactMatch = text.match(/^(\d+)%?$/);
		if (exactMatch) {
			return parseInt(exactMatch[1]);
		}

		// Handle ranges like "< 30%" - treat as the upper bound
		const rangeMatch = text.match(/(\d+)%?/);
		if (rangeMatch) {
			return parseInt(rangeMatch[1]);
		}

		return 0;
	}

	/**
     * Get discount value from a list item element
     * @param {HTMLElement} item - The list item element
     * @returns {number} - The discount value
     */
	function getItemDiscountValue(item) {
		const discountElement = item.querySelector(CONFIG.selectors.discountElement);
		if (!discountElement) {return 0;}

		const discountText = discountElement.textContent.trim();
		return parseDiscountValue(discountText);
	}

	/**
     * Sort items within a category by discount value
     * @param {HTMLElement} category - The category container
     * @param {boolean} ascending - Whether to sort ascending (default: false, descending)
     */
	function sortItemsByDiscount(category, ascending = false) {
		const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
		if (!contentContainer) {return;}

		const items = Array.from(contentContainer.querySelectorAll(CONFIG.selectors.listItem));

		// Filter out ad elements
		const offerItems = items.filter(item => !item.classList.contains('cbg3-ad'));

		// Sort by discount value
		offerItems.sort((a, b) => {
			const valueA = getItemDiscountValue(a);
			const valueB = getItemDiscountValue(b);

			if (ascending) {
				return valueA - valueB;
			} else {
				return valueB - valueA;
			}
		});

		// Re-append sorted items
		offerItems.forEach(item => {
			contentContainer.appendChild(item);
		});
	}

	/**
	 * Filter items by discount range
	 * @param {HTMLElement} category - The category container
	 * @param {string} filterType - The filter type ('all', 'high', 'medium', 'low')
	 */
	function filterItemsByDiscount(category, filterType) {
		const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
		if (!contentContainer) {return;}

		const items = contentContainer.querySelectorAll(CONFIG.selectors.listItem);
		const ranges = GLOBAL_STATE.filterRanges;

		items.forEach(item => {
			if (item.classList.contains('cbg3-ad')) {
				// Always show ads
				item.style.display = '';
				return;
			}

			const discountValue = getItemDiscountValue(item);
			let show = true;

			if (filterType === 'all') {
				show = true;
			} else if (ranges && filterType in ranges) {
				const [min, max] = ranges[filterType];
				show = discountValue >= min && discountValue <= max;
			}

			item.style.display = show ? '' : 'none';
		});
	}

	/**
	 * Create control buttons for a category
	 * @returns {HTMLElement} - The controls container
	 */
	function createControlButtons() {
		const controlsContainer = document.createElement('div');
		controlsContainer.className = CONFIG.classes.controlsContainer;
		controlsContainer.style.cssText = `
            margin: 10px 0;
            padding: 8px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            align-items: center;
        `;

		// Sort toggle button with 3 states (now global)
		const sortBtn = createSortToggleButton();

		// Filter buttons
		const filterLabel = document.createElement('span');
		filterLabel.textContent = 'Filtern:';
		filterLabel.style.fontWeight = 'bold';
		filterLabel.style.marginLeft = '10px';
		filterLabel.style.marginRight = '4px';
		filterLabel.style.fontSize = '12px';

		const filterAllBtn = createButton('Alle', () => {
			GLOBAL_STATE.filterState = 'all';
			applyFilterToAllCategories();
			updateAllFilterButtons('all');
		}, 'filter', 'all');
		filterAllBtn.classList.add(CONFIG.classes.active);
		filterAllBtn.style.background = '#28a745';
		filterAllBtn.style.color = 'white';

		// Create filter buttons with dynamic labels (will be updated after ranges are calculated)
		const ranges = GLOBAL_STATE.filterRanges;
		let lowLabel = 'Niedrig';
		let mediumLabel = 'Mittel';
		let highLabel = 'Hoch';

		if (ranges) {
			lowLabel = `${Math.round(ranges.low[0])}-${Math.round(ranges.low[1])}%`;
			mediumLabel = `${Math.round(ranges.medium[0])}-${Math.round(ranges.medium[1])}%`;
			highLabel = `${Math.round(ranges.high[0])}-${Math.round(ranges.high[1])}%`;
		}

		const filterLowBtn = createButton(lowLabel, () => {
			GLOBAL_STATE.filterState = 'low';
			applyFilterToAllCategories();
			updateAllFilterButtons('low');
		}, 'filter', 'low');

		const filterMediumBtn = createButton(mediumLabel, () => {
			GLOBAL_STATE.filterState = 'medium';
			applyFilterToAllCategories();
			updateAllFilterButtons('medium');
		}, 'filter', 'medium');

		const filterHighBtn = createButton(highLabel, () => {
			GLOBAL_STATE.filterState = 'high';
			applyFilterToAllCategories();
			updateAllFilterButtons('high');
		}, 'filter', 'high');

		controlsContainer.appendChild(sortBtn);
		controlsContainer.appendChild(filterLabel);
		controlsContainer.appendChild(filterAllBtn);
		controlsContainer.appendChild(filterLowBtn);
		controlsContainer.appendChild(filterMediumBtn);
		controlsContainer.appendChild(filterHighBtn);

		return controlsContainer;
	}

	/**
	 * Create a sort toggle button with 3 states (now global)
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
            padding: 4px 8px;
            border: 1px solid ${baseColor};
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            white-space: nowrap;
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
			applySortToAllCategories();
			updateAllSortButtons();
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
	 * Create a button element
	 * @param {string} text - Button text
	 * @param {Function} onClick - Click handler
	 * @param {string} buttonType - The button type ('sort' or 'filter')
	 * @param {string} filterType - The filter type identifier ('all', 'high', 'medium', 'low')
	 * @returns {HTMLElement} - The button element
	 */
	function createButton(text, onClick, buttonType, filterType = null) {
		const button = document.createElement('button');
		button.textContent = text;
		button.dataset.buttonType = buttonType;
		if (filterType) {
			button.dataset.filterType = filterType;
		}

		const baseColor = buttonType === 'filter' ? '#28a745' : '#007bff';

		button.style.cssText = `
            padding: 4px 8px;
            border: 1px solid ${baseColor};
            background: white;
            color: ${baseColor};
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            white-space: nowrap;
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
	 * Calculate dynamic filter ranges based on all discount values across all categories
	 * @returns {Object} - Filter ranges { high: [min, max], medium: [min, max], low: [min, max] }
	 */
	function calculateFilterRanges() {
		const allDiscounts = [];

		// Collect all discount values from all categories
		const categories = document.querySelectorAll('.cbg3-content');
		categories.forEach(category => {
			const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
			if (!contentContainer) {return;}

			const items = contentContainer.querySelectorAll(CONFIG.selectors.listItem);
			items.forEach(item => {
				if (item.classList.contains('cbg3-ad')) {return;}
				const discountValue = getItemDiscountValue(item);
				if (discountValue > 0) {
					allDiscounts.push(discountValue);
				}
			});
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

		const [min] = allDiscounts;
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
	 * Apply current global sort state to all categories
	 */
	function applySortToAllCategories() {
		const categories = document.querySelectorAll('.cbg3-content');
		categories.forEach(category => {
			if (GLOBAL_STATE.sortState === 'desc') {
				sortItemsByDiscount(category, false);
			} else if (GLOBAL_STATE.sortState === 'asc') {
				sortItemsByDiscount(category, true);
			} else {
				// Reset to original order
				const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
				if (contentContainer) {
					const items = Array.from(contentContainer.querySelectorAll(CONFIG.selectors.listItem));
					items.sort((a, b) => {
						const idA = parseInt(a.dataset.id) || 0;
						const idB = parseInt(b.dataset.id) || 0;
						return idA - idB;
					});
					items.forEach(item => {
						contentContainer.appendChild(item);
					});
				}
			}
		});
	}

	/**
	 * Apply current global filter state to all categories
	 */
	function applyFilterToAllCategories() {
		const categories = document.querySelectorAll('.cbg3-content');
		categories.forEach(category => {
			filterItemsByDiscount(category, GLOBAL_STATE.filterState);
		});
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
	 * Initialize all categories on the page
	 */
	function initializeAllCategories() {
		// Find all category containers
		const categoryContainers = document.querySelectorAll('.cbg3-category--content');

		// Calculate filter ranges first (only if not already calculated or if new categories were added)
		const needsRecalculation = !GLOBAL_STATE.filterRanges ||
			Array.from(categoryContainers).some(cc => {
				const prevSibling = cc.previousElementSibling;
				return !prevSibling?.classList?.contains(CONFIG.classes.controlsContainer);
			});

		if (needsRecalculation) {
			GLOBAL_STATE.filterRanges = calculateFilterRanges();
		}

		categoryContainers.forEach(contentContainer => {
			// Check if this content container has items and doesn't have controls yet
			const items = contentContainer.querySelectorAll(CONFIG.selectors.listItem);
			if (items.length === 0) {return;}

			// Check if controls already exist
			if (contentContainer.previousElementSibling?.classList?.contains(CONFIG.classes.controlsContainer)) {
				return;
			}

			// Find the category head (previous sibling or closest)
			const categoryHead = contentContainer.previousElementSibling;
			if (categoryHead && categoryHead.classList.contains('cbg3-category--head')) {
				// Create and insert controls
				const category = contentContainer.closest('.cbg3-content') || contentContainer.parentElement;
				const controls = createControlButtons();
				categoryHead.insertAdjacentElement('afterend', controls);

				// Apply current global states to this new category
				if (GLOBAL_STATE.sortState === 'desc') {
					sortItemsByDiscount(category, false);
				} else if (GLOBAL_STATE.sortState === 'asc') {
					sortItemsByDiscount(category, true);
				}
				// Filter state
				filterItemsByDiscount(category, GLOBAL_STATE.filterState);
			}
		});
	}

	/**
	 * Wait for dynamic content and initialize controls
	 */
	function waitForContent() {
		// Use MutationObserver to watch for changes
		const observer = new MutationObserver((mutations) => {
			let shouldReinitialize = false;

			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check if category content was added
							if (node.classList?.contains('cbg3-category--content') ||
								node.querySelector?.('.cbg3-category--content')) {
								shouldReinitialize = true;
							}
						}
					});
				}
			});

			// Reinitialize all categories if new content was detected
			if (shouldReinitialize) {
				setTimeout(() => {
					initializeAllCategories();
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
			initializeAllCategories();
		}, 500);
	}

	/**
	 * Fix shop buttons on offer pages to link directly without redirect overlay
	 */
	function fixShopButtons() {
		// Find all shop buttons (with shop icon) that have data-href attribute
		// Exclude code-request buttons
		const shopButtons = document.querySelectorAll('.cbg3-icon--shop button[data-href]:not(.cbg3-code-request)');
		
		shopButtons.forEach(button => {
			const url = button.getAttribute('data-href');
			if (!url) {return;}

			// Remove the overlay-related attributes from parent
			const parentDiv = button.closest('.cbg3-button--standard');
			if (parentDiv) {
				parentDiv.classList.remove('cbg3-overlay--open');
				parentDiv.removeAttribute('data-overlay-type');
				parentDiv.removeAttribute('data-overlay-id');
			}

			// Create a link element that looks like the original button
			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.className = button.className;
			link.innerHTML = button.innerHTML;

			// Replace the button with the link
			button.replaceWith(link);
		});
	}

	/**
	 * Wait for shop buttons on offer pages
	 */
	function waitForShopButtons() {
		// Use MutationObserver to watch for changes
		const observer = new MutationObserver((mutations) => {
			let shouldReinitialize = false;

			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							// Check if shop buttons were added
							if (node.classList?.contains('cbg3-salesoption') ||
								node.querySelector?.('.referrerShopButton')) {
								shouldReinitialize = true;
							}
						}
					});
				}
			});

			// Reinitialize if new buttons were detected
			if (shouldReinitialize) {
				setTimeout(() => {
					fixShopButtons();
				}, 100);
			}
		});

		// Start observing
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		// Initial fix with a small delay to ensure DOM is ready
		setTimeout(() => {
			fixShopButtons();
		}, 500);
	}

	// Start the script based on current page
	const currentPath = window.location.pathname;
	
	if (currentPath.includes('/overview/')) {
		// Overview page - sort and filter functionality
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', waitForContent);
		} else {
			waitForContent();
		}
	} else if (currentPath.includes('/offer/')) {
		// Offer page - fix shop buttons
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', waitForShopButtons);
		} else {
			waitForShopButtons();
		}
	}

})();
