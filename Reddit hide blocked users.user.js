// ==UserScript==
// @name         Reddit hide blocked users
// @namespace    https://github.com/1110101/tampermonkey_personal_scripts
// @version      1.0
// @description  Completely hides comments and posts from blocked users on Reddit (old, new, sh)
// @author       1110101@oczc.de
// @match        https://*.reddit.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Reddit%20hide%20blocked%20users.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Reddit%20hide%20blocked%20users.user.js
// ==/UserScript==

(function () {
	'use strict';

	function hideAll(root = document) {
		const things = root.matches?.('.thing.collapsed-for-reason')
			? [root]
			: root.querySelectorAll('.thing.collapsed-for-reason');
		for (const thing of things) {
			const reason = thing.querySelector('.collapsed-reason');
			if (reason?.textContent.trim().toLowerCase() === 'blocked user') {
				thing.style.display = 'none';
			}
		}
		const comments = root.matches?.('shreddit-comment')
			? [root]
			: root.querySelectorAll('shreddit-comment');
		for (const comment of comments) {
			const blockedLabel = comment.querySelector('svg[icon-name="block"] + span');
			if (blockedLabel?.textContent.trim().toLowerCase() === 'blocked user') {
				comment.style.display = 'none';
			}
		}
	}

	hideAll();

	const observer = new MutationObserver(mutations => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				try {
					if (node.nodeType === Node.ELEMENT_NODE) {
						hideAll(node);
					}
				} catch (e) {
					console.error('[Reddit hide blocked users] observer error:', e);
				}
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
})();