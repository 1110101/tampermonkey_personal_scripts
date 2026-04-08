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

	const SORT_STATES = {
		desc: { icon: '↓', label: 'Highest first', active: true },
		asc: { icon: '↑', label: 'Lowest first', active: true },
		off: { icon: '—', label: 'Sort off', active: false }
	};

	const GLOBAL_STATE = {
		sortState: 'desc',
		filterState: 'all',
		filterRanges: null
	};

	/**
     * Parse discount text and return numeric value for sorting
     * @param {string} discountText - e.g. "< 25% Rabatt", "15% Rabatt", "> 7% Rabatt"
     * @returns {number}
     */
	function parseDiscountValue(discountText) {
		if (!discountText) {
			return 0;
		}

		const text = discountText.replace(/\s*Rabatt\s*$/, '').trim();

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

		const rangeMatch = text.match(/(\d+)%?/);
		if (rangeMatch) {
			return parseInt(rangeMatch[1]);
		}

		return 0;
	}

	/**
	 * @param {HTMLElement} item
	 * @returns {number}
	 */
	function getItemDiscountValue(item) {
		const discountElement = item.querySelector(CONFIG.selectors.discountElement);
		if (!discountElement) {
			return 0;
		}

		const discountText = discountElement.textContent.trim();
		return parseDiscountValue(discountText);
	}

	/**
     * @param {HTMLElement} category
     * @param {boolean} ascending
     */
	function sortItemsByDiscount(category, ascending = false) {
		const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
		if (!contentContainer) {
			return;
		}

		const items = Array.from(contentContainer.querySelectorAll(CONFIG.selectors.listItem));

		const offerItems = items.filter(item => !item.classList.contains('cbg3-ad'));

		offerItems.sort((a, b) => {
			const valueA = getItemDiscountValue(a);
			const valueB = getItemDiscountValue(b);

			if (ascending) {
				return valueA - valueB;
			} else {
				return valueB - valueA;
			}
		});

		offerItems.forEach(item => {
			contentContainer.appendChild(item);
		});
	}

	/**
	 * @param {HTMLElement} category
	 * @param {string} filterType - 'all', 'high', 'medium', 'low'
	 */
	function filterItemsByDiscount(category, filterType) {
		const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
		if (!contentContainer) {
			return;
		}

		const items = contentContainer.querySelectorAll(CONFIG.selectors.listItem);
		const ranges = GLOBAL_STATE.filterRanges;

		items.forEach(item => {
			if (item.classList.contains('cbg3-ad')) {
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
	 * @returns {HTMLElement}
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

		// Sort toggle button with 3 states (global — affects all categories at once)
		const sortBtn = createSortToggleButton();

		const filterLabel = document.createElement('span');
		filterLabel.textContent = 'Filter:';
		filterLabel.style.fontWeight = 'bold';
		filterLabel.style.marginLeft = '10px';
		filterLabel.style.marginRight = '4px';
		filterLabel.style.fontSize = '12px';

		const filterAllBtn = createButton('All', () => {
			GLOBAL_STATE.filterState = 'all';
			applyFilterToAllCategories();
			updateAllFilterButtons('all');
		}, 'filter', 'all');
		filterAllBtn.classList.add(CONFIG.classes.active);
		filterAllBtn.style.background = '#28a745';
		filterAllBtn.style.color = 'white';

		// Create filter buttons with dynamic labels (updated after ranges are calculated)
		const ranges = GLOBAL_STATE.filterRanges;
		let lowLabel = 'Low';
		let mediumLabel = 'Medium';
		let highLabel = 'High';

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
	 * Sort toggle button with 3 states, shared across all category toolbars.
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

			// Cycle: desc -> asc -> off -> desc			if (currentState === 'desc') {
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
	 * @param {string} buttonType - 'sort' or 'filter'
	 * @param {string} filterType - 'all', 'high', 'medium', 'low'
	 * @returns {HTMLElement}
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
	 * Calculate dynamic filter ranges based on all discount values across all categories.
	 * @returns {{ high: [number, number], medium: [number, number], low: [number, number] }}
	 */
	function calculateFilterRanges() {
		const allDiscounts = [];

		const categories = document.querySelectorAll('.cbg3-content');
		categories.forEach(category => {
			const contentContainer = category.querySelector(CONFIG.selectors.categoryContent);
			if (!contentContainer) {
				return;
			}

			const items = contentContainer.querySelectorAll(CONFIG.selectors.listItem);
			items.forEach(item => {
				if (item.classList.contains('cbg3-ad')) {
					return;
				}
				const discountValue = getItemDiscountValue(item);
				if (discountValue > 0) {
					allDiscounts.push(discountValue);
				}
			});
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

	function applySortToAllCategories() {
		const categories = document.querySelectorAll('.cbg3-content');
		categories.forEach(category => {
			if (GLOBAL_STATE.sortState === 'desc') {
				sortItemsByDiscount(category, false);
			} else if (GLOBAL_STATE.sortState === 'asc') {
				sortItemsByDiscount(category, true);
			} else {
				// Restore original DOM order using stored data-id
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

	function applyFilterToAllCategories() {
		const categories = document.querySelectorAll('.cbg3-content');
		categories.forEach(category => {
			filterItemsByDiscount(category, GLOBAL_STATE.filterState);
		});
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

	function initializeAllCategories() {
		const categoryContainers = document.querySelectorAll('.cbg3-category--content');

		// Recalculate filter ranges if not yet done or if new categories were added
		const needsRecalculation = !GLOBAL_STATE.filterRanges ||
			Array.from(categoryContainers).some(cc => {
				const prevSibling = cc.previousElementSibling;
				return !prevSibling?.classList?.contains(CONFIG.classes.controlsContainer);
			});

		if (needsRecalculation) {
			GLOBAL_STATE.filterRanges = calculateFilterRanges();
		}

		categoryContainers.forEach(contentContainer => {
			const items = contentContainer.querySelectorAll(CONFIG.selectors.listItem);
			if (items.length === 0) {
				return;
			}

			if (contentContainer.previousElementSibling?.classList?.contains(CONFIG.classes.controlsContainer)) {
				return;
			}

			const categoryHead = contentContainer.previousElementSibling;
			if (categoryHead && categoryHead.classList.contains('cbg3-category--head')) {
				const category = contentContainer.closest('.cbg3-content') || contentContainer.parentElement;
				const controls = createControlButtons();
				categoryHead.insertAdjacentElement('afterend', controls);

				if (GLOBAL_STATE.sortState === 'desc') {
					sortItemsByDiscount(category, false);
				} else if (GLOBAL_STATE.sortState === 'asc') {
					sortItemsByDiscount(category, true);
				}
				filterItemsByDiscount(category, GLOBAL_STATE.filterState);
			}
		});
	}

	function waitForContent() {
		const observer = new MutationObserver((mutations) => {
			let shouldReinitialize = false;

			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (node.classList?.contains('cbg3-category--content') ||
								node.querySelector?.('.cbg3-category--content')) {
								shouldReinitialize = true;
							}
						}
					});
				}
			});

			if (shouldReinitialize) {
				setTimeout(() => {
					initializeAllCategories();
				}, 100);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		// Small delay to ensure DOM is ready
		setTimeout(() => {
			initializeAllCategories();
		}, 500);
	}

	/**
	 * Fix shop buttons on offer pages to link directly without redirect overlay
	 */
	function fixShopButtons() {
		const shopButtons = document.querySelectorAll('.cbg3-icon--shop button[data-href]:not(.cbg3-code-request)');

		shopButtons.forEach(button => {
			const url = button.getAttribute('data-href');
			if (!url) {
				return;
			}

			const parentDiv = button.closest('.cbg3-button--standard');
			if (parentDiv) {
				parentDiv.classList.remove('cbg3-overlay--open');
				parentDiv.removeAttribute('data-overlay-type');
				parentDiv.removeAttribute('data-overlay-id');
			}

			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			link.className = button.className;
			link.innerHTML = button.innerHTML;

			button.replaceWith(link);
		});
	}

	function waitForShopButtons() {
		const observer = new MutationObserver((mutations) => {
			let shouldReinitialize = false;

			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (node.classList?.contains('cbg3-salesoption') ||
								node.querySelector?.('.referrerShopButton')) {
								shouldReinitialize = true;
							}
						}
					});
				}
			});

			if (shouldReinitialize) {
				setTimeout(() => {
					fixShopButtons();
				}, 100);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});

		// Small delay to ensure DOM is ready
		setTimeout(() => {
			fixShopButtons();
		}, 500);
	}

	const currentPath = window.location.pathname;

	if (currentPath.includes('/overview/')) {
		waitForContent();
	} else if (currentPath.includes('/offer/')) {
		waitForShopButtons();
	}

})();
