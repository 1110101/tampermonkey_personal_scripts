// ==UserScript==
// @name         MyDealz Ignore Helper
// @namespace    1110101
// @version      4.3
// @description  Ignore articles by keyword or manually, track read articles with visual markers
// @author       1110101
// @match        https://www.mydealz.de/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mydealz.de
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

/*
 * CHANGELOG
 *
 * v4.3 (2025-10-05)
 * - Added title ignore button with edit popup - extract keywords from article titles
 * - Added exact match toggle for keywords (whole word vs substring matching)
 * - Improved keyword matching with regex support for whole word matching
 * - Better button styling with emoji indicators
 *
 * v4.2 (2024-10-05)
 * - Initial public release
 * - Keyword filtering with management UI
 * - Manual article ignore button
 * - Read tracking with visual green markers
 * - Reset functionality
 * - Persistent storage with GM API
 */

(function () {
	'use strict';

	// mostly vibe coded, but it works

	// ===== Function Definitions =====

	function cleanupOldIgnoredArticles() {
		const objIgnoreList = GM_getValue('ignorelist', {});
		const iNow = Date.now();
		const iSevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
		let bCleaned = false;

		// Handle old format (array) - convert to new format
		if (Array.isArray(objIgnoreList)) {
			const objNewIgnoreList = {};
			objIgnoreList.forEach(id => {
				objNewIgnoreList[id] = iNow; // Set current time for old entries
			});
			GM_setValue('ignorelist', objNewIgnoreList);
			return;
		}

		// Clean up old entries
		const objUpdatedIgnoreList = {};
		for (const [articleId, timestamp] of Object.entries(objIgnoreList)) {
			if (iNow - timestamp < iSevenDaysInMs) {
				objUpdatedIgnoreList[articleId] = timestamp;
			} else {
				bCleaned = true;
			}
		}

		if (bCleaned) {
			GM_setValue('ignorelist', objUpdatedIgnoreList);
		}
	}

	function showNotification(strMessage, strType = 'success') {
		const elNotification = document.createElement('div');
		elNotification.className = `gm-notification gm-notification--${strType}`;
		elNotification.textContent = strMessage;
		document.body.appendChild(elNotification);

		// Trigger animation
		setTimeout(() => elNotification.classList.add('gm-notification--show'), 10);

		// Remove after 3 seconds
		setTimeout(() => {
			elNotification.classList.remove('gm-notification--show');
			setTimeout(() => elNotification.remove(), 300);
		}, 3000);
	}

	function addResetButton() {
		const elMenuBar = document.querySelector('#tour-expired');
		if (!elMenuBar) {
			setTimeout(addResetButton, 500);
			return;
		}

		// Toggle button to hide/show seen articles
		const elToggleSeenButton = document.createElement('button');
		elToggleSeenButton.classList.add('button', 'button--shape-circle', 'button--type-secondary', 'button--mode-default', 'button--square');

		function updateToggleButton() {
			const bIsHidden = GM_getValue('hideSeenArticles', false);
			elToggleSeenButton.classList.toggle('button--selected', bIsHidden);
			if (bIsHidden) {
				// Eye with slash (hidden)
				elToggleSeenButton.innerHTML = `
	      <span title="Gelesene Artikel anzeigen" class="flex--inline boxAlign-ai--all-c">
	          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
	            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
	            <line x1="1" y1="1" x2="23" y2="23"></line>
	          </svg>
	      </span>`;
			} else {
				// Normal eye (visible)
				elToggleSeenButton.innerHTML = `
	      <span title="Gelesene Artikel verstecken" class="flex--inline boxAlign-ai--all-c">
	          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
	            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
	            <circle cx="12" cy="12" r="3"></circle>
	          </svg>
	      </span>`;
			}
		}

		updateToggleButton();

		elToggleSeenButton.addEventListener('click', () => {
			const bCurrentState = GM_getValue('hideSeenArticles', false);
			GM_setValue('hideSeenArticles', !bCurrentState);
			showNotification(!bCurrentState ? 'Gelesene Artikel werden versteckt' : 'Gelesene Artikel werden angezeigt', 'info');
			setTimeout(() => location.reload(), 500);
		});

		elMenuBar.insertAdjacentElement('afterEnd', elToggleSeenButton);

		// Reset button
		const elResetIgnore = document.createElement('button');
		elResetIgnore.classList.add('button', 'button--shape-circle', 'button--type-secondary', 'button--mode-default', 'button--square');
		elResetIgnore.addEventListener('click', () => {
			GM_deleteValue('seenArticles');
			showNotification('Gelesene Artikel wurden zurückgesetzt!', 'success');
			setTimeout(() => location.reload(), 1000);
		});
		elResetIgnore.innerHTML = `
	      <span title="Reset ignore list" class="flex--inline boxAlign-ai--all-c">
	          <svg width="16" height="20" class="icon icon--bookmark">
	            <use xlink:href="/assets/img/ico_38c79.svg#cross"></use>
	          </svg>
	      </span>`;
		elToggleSeenButton.insertAdjacentElement('afterEnd', elResetIgnore);
	}

	function insertIgnoreButton(elElement) {
		// Check if button already exists
		if (elElement.querySelector('.gm-ignore-button')) {
			return;
		}

		const elIgnoreButton = document.createElement('button');
		elIgnoreButton.classList.add('gm-ignore-button');
		elIgnoreButton.title = 'Artikel ignorieren';

		elIgnoreButton.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();

			// Find the article element using closest()
			const elArticleElement = elElement.closest('article[id^="thread_"]');
			if (!elArticleElement) {
				return;
			}

			const strArticleId = elArticleElement.id;
			if (!strArticleId) {
				return;
			}

			// Remove article from DOM
			elArticleElement.remove();

			// Add to ignore list with timestamp
			const objCurrentIgnoreList = GM_getValue('ignorelist', {});
			if (!objCurrentIgnoreList[strArticleId]) {
				objCurrentIgnoreList[strArticleId] = Date.now();
				GM_setValue('ignorelist', objCurrentIgnoreList);
				showNotification('Artikel ignoriert (7 Tage)', 'success');
			}
		});

		elIgnoreButton.innerHTML = `
	    <svg width="16" height="20" class="icon icon--bookmark" viewBox="0 0 16 20">
	      <use xlink:href="/assets/img/ico_38c79.svg#cross"></use>
	    </svg>`;
		elElement.appendChild(elIgnoreButton);
	}

	function addTitleIgnoreButton(elArticle) {
		const elTitleElement = elArticle.querySelector('.thread-title');
		if (!elTitleElement || elArticle.querySelector('.gm-title-ignore-btn')) {
			return;
		}

		// Check if wrapper already exists
		if (elTitleElement.parentElement.classList.contains('gm-title-wrapper')) {
			return;
		}

		const elButton = document.createElement('button');
		elButton.className = 'gm-title-ignore-btn';
		elButton.title = 'Keyword aus Titel hinzufügen';
		elButton.innerHTML = '🚫';
		elButton.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			showTitleEditPrompt(elArticle);
		});

		// Create wrapper and move title into it
		const elWrapper = document.createElement('div');
		elWrapper.className = 'gm-title-wrapper';

		// Insert wrapper before the title element
		elTitleElement.parentElement.insertBefore(elWrapper, elTitleElement);

		// Move title into wrapper and add button
		elWrapper.appendChild(elTitleElement);
		elWrapper.appendChild(elButton);
	}


	function markArticleAsSeenAfterDelay(arrEntries, observerObserver) {
		arrEntries.forEach(objEntry => {
			if (objEntry.isIntersecting) {
				setTimeout(() => {
					if (objEntry.isIntersecting && isElementFullyVisible(objEntry.target)) {
						const strArticleId = objEntry.target.id;
						if (!strArticleId) {
							return;
						}

						const arrArticleIds = GM_getValue('seenArticles', []);
						if (!arrArticleIds.includes(strArticleId)) {
							const elThreadListCard = objEntry.target.querySelector('.threadListCard');
							if (elThreadListCard) {
								const elLeftBackground = document.createElement('div');
								elLeftBackground.classList.add('left-background');
								elThreadListCard.insertAdjacentElement('afterbegin', elLeftBackground);
							}
							arrArticleIds.push(strArticleId);
							GM_setValue('seenArticles', arrArticleIds);
							observerObserver.unobserve(objEntry.target);
						}
					}
				}, 2000);
			}
		});
	}

	function isElementFullyVisible(elElement) {
		const objRect = elElement.getBoundingClientRect();
		return (objRect.top >= 0 && objRect.left >= 0
			&& objRect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
			&& objRect.right <= (window.innerWidth || document.documentElement.clientWidth));
	}

	function observeArticlesOnFirstScroll() {
		if (!bScrolled) {
			document.querySelectorAll('article').forEach(elArticle => {
				observerMain.observe(elArticle);
			});
			bScrolled = true;
			window.removeEventListener('scroll', observeArticlesOnFirstScroll);
		}
	}

	function processNewArticle(elNode, observerObserver) {
		// Check if article should be hidden by keyword
		const elTitleElement = elNode.querySelector('.thread-title');
		if (elTitleElement) {
			const strTitle = elTitleElement.textContent.trim();
			if (articleMatchesKeyword(strTitle)) {
				elNode.style.display = 'none';
				return;
			}
		}

		const arrSeenArticles = GM_getValue('seenArticles', []);
		if (elNode.id && arrSeenArticles.includes(elNode.id)) {
			// Check if we should hide seen articles
			const bHideSeenArticles = GM_getValue('hideSeenArticles', false);
			if (bHideSeenArticles) {
				elNode.style.display = 'none';
				return;
			}

			// Otherwise just mark with green background
			const elThreadListCard = elNode.querySelector('.threadListCard');
			if (elThreadListCard) {
				const elLeftBackground = document.createElement('div');
				elLeftBackground.classList.add('left-background');
				elThreadListCard.insertAdjacentElement('afterbegin', elLeftBackground);
			}
		}
		observerObserver.observe(elNode);
	}

	function processDOMNode(elNode, observerObserver) {
		if (elNode.nodeType === Node.ELEMENT_NODE) {
			// Handle new articles
			if (elNode.tagName === 'ARTICLE') {
				processNewArticle(elNode, observerObserver);
				addTitleIgnoreButton(elNode);
			}
			// Handle vote boxes
			else if (elNode.matches && elNode.matches('.vote-box')) {
				insertIgnoreButton(elNode);
			}
			// Check children for vote boxes
			else if (elNode.querySelectorAll) {
				elNode.querySelectorAll('.vote-box').forEach(elVoteBox => {
					insertIgnoreButton(elVoteBox);
				});
				elNode.querySelectorAll('article').forEach(elArticle => {
					addTitleIgnoreButton(elArticle);
				});
			}
		}
	}

	function addSeenMarkerToArticle(strArticleId) {
		const elArticle = document.getElementById(strArticleId);
		if (elArticle) {
			const elThreadListCard = elArticle.querySelector('.threadListCard');
			if (elThreadListCard) {
				const elLeftBackground = document.createElement('div');
				elLeftBackground.classList.add('left-background');
				elThreadListCard.insertAdjacentElement('afterbegin', elLeftBackground);
			}
		}
	}

	function articleMatchesKeyword(strTitle) {
		const arrKeywords = GM_getValue('ignoreKeywords', []);

		return arrKeywords.some(objKeyword => {
			const strKeyword = typeof objKeyword === 'string' ? objKeyword : objKeyword.keyword;
			const bExactMatch = typeof objKeyword === 'string' ? false : objKeyword.exactMatch;

			const strLowerTitle = strTitle.toLowerCase();
			const strLowerKeyword = strKeyword.toLowerCase();

			if (bExactMatch) {
				// Match whole words only
				const regexPattern = new RegExp(`\\b${strLowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
				return regexPattern.test(strTitle);
			} else {
				// Match anywhere in title
				return strLowerTitle.includes(strLowerKeyword);
			}
		});
	}


	function hideArticlesMatchingKeywords() {
		document.querySelectorAll('article[id^="thread_"]').forEach(elArticle => {
			const elTitleElement = elArticle.querySelector('.thread-title');
			if (elTitleElement) {
				const strTitle = elTitleElement.textContent.trim();
				if (articleMatchesKeyword(strTitle)) {
					elArticle.style.display = 'none';
				}
			}
		});
	}

	function showTitleEditPrompt(elArticle) {
		const elTitleElement = elArticle.querySelector('.thread-title');
		if (!elTitleElement) {
			return;
		}

		const strFullTitle = elTitleElement.textContent.trim();
		const elModal = document.createElement('div');
		elModal.id = 'gm-title-prompt-modal';
		elModal.innerHTML = `
			<div class="gm-modal-overlay">
				<div class="gm-modal-content">
					<div class="gm-modal-header">
						<h2>Keyword hinzufügen</h2>
						<button class="gm-modal-close">&times;</button>
					</div>
					<div class="gm-modal-body">
						<p style="margin-bottom: 10px; color: #666;">Bearbeite den Titel oder extrahiere ein Keyword:</p>
						<textarea id="gm-title-edit" style="width: 100%; min-height: 100px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical;">${strFullTitle}</textarea>
						<div class="gm-toggle-group" style="margin-top: 15px;">
							<label class="gm-toggle-label" title="Nur ganze Wörter matchen (z.B. 'VW' matched nicht 'VWL')">
								<input type="checkbox" id="gm-title-exact-match" />
								<span>🎯 Nur ganzes Wort matchen</span>
							</label>
						</div>
						<div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
							<button id="gm-cancel-title" class="gm-secondary-button">Abbrechen</button>
							<button id="gm-add-title" class="gm-primary-button">Hinzufügen</button>
						</div>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(elModal);

		const elTextarea = elModal.querySelector('#gm-title-edit');
		const elExactMatchCheckbox = elModal.querySelector('#gm-title-exact-match');
		const elAddBtn = elModal.querySelector('#gm-add-title');
		const elCancelBtn = elModal.querySelector('#gm-cancel-title');
		const elCloseBtn = elModal.querySelector('.gm-modal-close');

		const fnCloseModal = () => elModal.remove();

		elCloseBtn.addEventListener('click', fnCloseModal);
		elCancelBtn.addEventListener('click', fnCloseModal);
		elModal.querySelector('.gm-modal-overlay').addEventListener('click', (e) => {
			if (e.target.classList.contains('gm-modal-overlay')) {
				fnCloseModal();
			}
		});

		elAddBtn.addEventListener('click', () => {
			const strKeyword = elTextarea.value.trim();
			if (strKeyword) {
				const arrKeywords = GM_getValue('ignoreKeywords', []);
				const objKeyword = {
					keyword: strKeyword,
					exactMatch: elExactMatchCheckbox.checked
				};

				// Check if keyword already exists
				const bExists = arrKeywords.some(k => {
					const strKw = typeof k === 'string' ? k : k.keyword;
					return strKw === strKeyword;
				});

				if (!bExists) {
					arrKeywords.push(objKeyword);
					GM_setValue('ignoreKeywords', arrKeywords);
					hideArticlesMatchingKeywords();
					showNotification(`Keyword "${strKeyword}" hinzugefügt`, 'success');
				} else {
					showNotification(`Keyword "${strKeyword}" existiert bereits`, 'info');
				}
			}
			fnCloseModal();
		});

		// Select all text for easy editing
		elTextarea.select();
	}

	function openKeywordManagementModal() {
		const elModal = document.createElement('div');
		elModal.id = 'gm-keyword-modal';
		elModal.innerHTML = `
			<div class="gm-modal-overlay">
				<div class="gm-modal-content gm-modal-content--large">
					<div class="gm-modal-header">
						<h2>Filter verwalten</h2>
						<button class="gm-modal-close">&times;</button>
					</div>
					<div class="gm-modal-body">
						<div class="gm-input-group">
							<input type="text" id="gm-keyword-input" placeholder="Keyword eingeben..." />
							<label class="gm-inline-checkbox" title="Nur ganze Wörter matchen (z.B. 'VW' matched nicht 'VWL')">
								<input type="checkbox" id="gm-exact-match-toggle" />
								<span>🎯 Nur ganzes Wort</span>
							</label>
							<button id="gm-add-keyword">Hinzufügen</button>
						</div>
						<div class="gm-keywords-list" id="gm-keywords-list"></div>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(elModal);

		// Event listeners
		elModal.querySelector('.gm-modal-close').addEventListener('click', () => elModal.remove());
		elModal.querySelector('.gm-modal-overlay').addEventListener('click', (e) => {
			if (e.target.classList.contains('gm-modal-overlay')) {
				elModal.remove();
			}
		});

		const elInput = elModal.querySelector('#gm-keyword-input');
		const elExactMatchToggle = elModal.querySelector('#gm-exact-match-toggle');
		const elAddButton = elModal.querySelector('#gm-add-keyword');

		function addKeyword() {
			const strKeyword = elInput.value.trim();
			if (strKeyword) {
				const arrKeywords = GM_getValue('ignoreKeywords', []);
				const objKeyword = {
					keyword: strKeyword,
					exactMatch: elExactMatchToggle.checked
				};

				// Check if keyword already exists
				const bExists = arrKeywords.some(k => {
					const strKw = typeof k === 'string' ? k : k.keyword;
					return strKw === strKeyword;
				});

				if (!bExists) {
					arrKeywords.push(objKeyword);
					GM_setValue('ignoreKeywords', arrKeywords);
					renderKeywords();
					hideArticlesMatchingKeywords();
					showNotification(`Keyword "${strKeyword}" hinzugefügt`, 'success');
				} else {
					showNotification(`Keyword "${strKeyword}" existiert bereits`, 'info');
				}
				elInput.value = '';
				elExactMatchToggle.checked = false;
			}
		}

		elAddButton.addEventListener('click', addKeyword);
		elInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				addKeyword();
			}
		});

		function renderKeywords() {
			const arrKeywords = GM_getValue('ignoreKeywords', []);
			const elList = elModal.querySelector('#gm-keywords-list');
			elList.innerHTML = '';

			if (arrKeywords.length === 0) {
				elList.innerHTML = '<p class="gm-empty-state">Noch keine Keywords hinzugefügt</p>';
				return;
			}

			arrKeywords.forEach((objKeyword, index) => {
				const strKeyword = typeof objKeyword === 'string' ? objKeyword : objKeyword.keyword;
				const bExactMatch = typeof objKeyword === 'string' ? false : objKeyword.exactMatch;

				const elItem = document.createElement('div');
				elItem.className = 'gm-keyword-item';
				elItem.innerHTML = `
					<div class="gm-keyword-content">
						<span class="gm-keyword-text">${strKeyword}</span>
						${bExactMatch ? '<span class="gm-keyword-badge">🎯 Ganzes Wort</span>' : '<span class="gm-keyword-badge gm-keyword-badge--partial">📝 Teilwort</span>'}
					</div>
					<div class="gm-keyword-actions">
						<label class="gm-keyword-toggle" title="Nur ganze Wörter matchen">
							<input type="checkbox" ${bExactMatch ? 'checked' : ''} data-index="${index}" />
							<span class="gm-toggle-switch"></span>
						</label>
						<button class="gm-keyword-delete" data-index="${index}">Löschen</button>
					</div>
				`;

				// Toggle exact match
				const elCheckbox = elItem.querySelector('input[type="checkbox"]');
				elCheckbox.addEventListener('change', () => {
					const arrUpdatedKeywords = GM_getValue('ignoreKeywords', []);
					const strKw = arrUpdatedKeywords[index];
					if (typeof strKw === 'string') {
						arrUpdatedKeywords[index] = { keyword: strKw, exactMatch: elCheckbox.checked };
					} else {
						arrUpdatedKeywords[index].exactMatch = elCheckbox.checked;
					}
					GM_setValue('ignoreKeywords', arrUpdatedKeywords);
					showNotification(`"${strKeyword}" ${elCheckbox.checked ? 'matched nur ganze Wörter' : 'matched Teilwörter'}`, 'info');
					renderKeywords(); // Re-render to update badge
					hideArticlesMatchingKeywords(); // Re-apply filters
				});

				// Delete keyword
				elItem.querySelector('.gm-keyword-delete').addEventListener('click', () => {
					const strDeletedKeyword = strKeyword;
					const arrUpdatedKeywords = arrKeywords.filter((_, i) => i !== index);
					GM_setValue('ignoreKeywords', arrUpdatedKeywords);
					renderKeywords();
					showNotification(`Keyword "${strDeletedKeyword}" gelöscht`, 'success');
					hideArticlesMatchingKeywords(); // Re-apply filters
				});
				elList.appendChild(elItem);
			});
		}

		renderKeywords();
	}

	// ===== Main Execution =====

	// Clean up old ignored articles (7 days)
	cleanupOldIgnoredArticles();

	// Initialize ignore list and apply styles
	const objIgnoreList = GM_getValue('ignorelist', {});
	const arrIgnoreList = Array.isArray(objIgnoreList) ? objIgnoreList : Object.keys(objIgnoreList);
	let strIgnoreString = `
		.threadListCard { position: relative;}
		.left-background { position: absolute; top: 0; left: 0; width: 1%; height: 100%; background-color: green; z-index: 1;}

		/* Notifications */
		.gm-notification {
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 15px 20px;
			border-radius: 8px;
			font-size: 14px;
			font-weight: 500;
			box-shadow: 0 4px 12px rgba(0,0,0,0.15);
			z-index: 10001;
			opacity: 0;
			transform: translateX(400px);
			transition: all 0.3s ease;
		}
		.gm-notification--show {
			opacity: 1;
			transform: translateX(0);
		}
		.gm-notification--success {
			background: #4caf50;
			color: white;
		}
		.gm-notification--info {
			background: #2196f3;
			color: white;
		}
		.gm-notification--error {
			background: #f44336;
			color: white;
		}

		/* Ignore Button Styles */
		.gm-ignore-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 96px;
			height: 32px;
			padding: 0;
			background: transparent;
			border: none;
			border-radius: 16px;
			cursor: pointer;
			transition: all 0.2s ease;
			flex-shrink: 0;
			vertical-align: middle;
		}
		.gm-ignore-button svg {
			width: 16px;
			height: 16px;
			fill: #999;
			transition: fill 0.2s ease;
		}
		.gm-ignore-button:hover {
			background: rgba(255, 68, 68, 0.1);
		}
		.gm-ignore-button:hover svg {
			fill: #ff4444;
		}
		.gm-ignore-button:active {
			transform: scale(0.95);
		}
		.vote-box {
			display: flex;
			align-items: center;
			gap: 0;
		}

		/* Title Ignore Button */
		.gm-title-wrapper {
			display: flex !important;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			gap: 10px;
		}
		.gm-title-wrapper .thread-title {
			flex: 1;
			min-width: 0;
			display: inline-block;
		}
		.gm-title-ignore-btn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 6px 10px;
			background: transparent;
			border: 1px solid #ddd;
			border-radius: 6px;
			cursor: pointer;
			font-size: 16px;
			line-height: 1;
			transition: all 0.2s ease;
			flex-shrink: 0;
		}
		.gm-title-ignore-btn:hover {
			background: #ff4444;
			border-color: #ff4444;
			transform: scale(1.1);
		}

		/* Modal Styles */
		#gm-keyword-modal, #gm-title-prompt-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; }
		.gm-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; }
		.gm-modal-content { background: white; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80vh; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
		.gm-modal-content--large { max-width: 700px; }
		.gm-modal-header { padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
		.gm-modal-header h2 { margin: 0; font-size: 20px; color: #333; }
		.gm-modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #999; line-height: 1; padding: 0; width: 30px; height: 30px; }
		.gm-modal-close:hover { color: #333; }
		.gm-modal-body { padding: 20px; max-height: calc(80vh - 80px); overflow-y: auto; }

		/* Toggle */
		.gm-toggle-group { margin-bottom: 20px; padding: 12px; background: #f5f5f5; border-radius: 6px; }
		.gm-toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; color: #333; }
		.gm-toggle-label input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }

		/* Buttons */
		.gm-primary-button { padding: 10px 20px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
		.gm-primary-button:hover { background: #e55a00; }
		.gm-secondary-button { padding: 10px 20px; background: #f0f0f0; color: #333; border: none; border-radius: 6px; cursor: pointer; }
		.gm-secondary-button:hover { background: #e0e0e0; }
		.gm-input-group { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; }
		.gm-input-group input[type="text"] { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
		.gm-input-group input[type="text"]:focus { outline: none; border-color: #ff6600; }
		.gm-input-group button { padding: 10px 20px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
		.gm-input-group button:hover { background: #e55a00; }
		.gm-inline-checkbox { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #666; white-space: nowrap; }
		.gm-inline-checkbox input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
		.gm-keywords-list { display: flex; flex-direction: column; gap: 10px; }
		.gm-keyword-item { display: flex; justify-content: space-between; align-items: center; padding: 14px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0; }
		.gm-keyword-content { display: flex; flex-direction: column; gap: 6px; flex: 1; }
		.gm-keyword-text { color: #333; font-size: 15px; font-weight: 500; }
		.gm-keyword-badge { display: inline-block; padding: 3px 10px; background: #4caf50; color: white; border-radius: 12px; font-size: 11px; font-weight: 600; }
		.gm-keyword-badge--partial { background: #2196f3; }
		.gm-keyword-actions { display: flex; align-items: center; gap: 12px; }
		.gm-keyword-toggle { display: flex; align-items: center; cursor: pointer; position: relative; }
		.gm-keyword-toggle input[type="checkbox"] { position: absolute; opacity: 0; width: 0; height: 0; }
		.gm-toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; background: #ccc; border-radius: 24px; transition: background 0.3s; }
		.gm-toggle-switch::after { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: transform 0.3s; }
		.gm-keyword-toggle input[type="checkbox"]:checked + .gm-toggle-switch { background: #4caf50; }
		.gm-keyword-toggle input[type="checkbox"]:checked + .gm-toggle-switch::after { transform: translateX(20px); }
		.gm-keyword-delete { padding: 6px 14px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.2s; }
		.gm-keyword-delete:hover { background: #c82333; }
		.gm-empty-state { text-align: center; color: #999; padding: 40px 20px; font-style: italic; }
	`;
	if (arrIgnoreList.length > 0) {
		strIgnoreString += ` article#${arrIgnoreList.join(', article#')} { display:none !important;}`;
	}
	GM_addStyle(strIgnoreString);

	// Add reset button
	addResetButton();

	// Setup observers
	const observerMain = new IntersectionObserver(markArticleAsSeenAfterDelay, { root: null, threshold: 0.75 });

	const observerDOM = new MutationObserver(arrMutations => {
		arrMutations.forEach(objMutation => {
			objMutation.addedNodes.forEach(elNode => {
				processDOMNode(elNode, observerMain);
			});
		});
	});

	// Start DOM observer
	if (document.body) {
		observerDOM.observe(document.body, { childList: true, subtree: true });
	} else {
		document.addEventListener('DOMContentLoaded', () => {
			observerDOM.observe(document.body, { childList: true, subtree: true });
		});
	}

	// Setup scroll handler
	let bScrolled = false;
	window.addEventListener('scroll', observeArticlesOnFirstScroll);

	// Mark already seen articles on page load
	const arrVisibleArticles = GM_getValue('seenArticles', []);
	arrVisibleArticles.forEach(addSeenMarkerToArticle);

	// Hide seen articles if toggle is enabled (only previously seen ones)
	const bHideSeenArticles = GM_getValue('hideSeenArticles', false);
	if (bHideSeenArticles) {
		arrVisibleArticles.forEach(strArticleId => {
			const elArticle = document.getElementById(strArticleId);
			if (elArticle) {
				elArticle.style.display = 'none';
			}
		});
	}

	// Hide articles by keywords on page load
	hideArticlesMatchingKeywords();

	// Add ignore buttons to existing articles
	document.querySelectorAll('article').forEach(elArticle => {
		addTitleIgnoreButton(elArticle);
	});

	// Register Tampermonkey menu command
	GM_registerMenuCommand('⚙️ Filter verwalten', openKeywordManagementModal);

})();
