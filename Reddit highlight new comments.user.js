// ==UserScript==
// @name				Reddit highlight new comments
// @namespace			https://github.com/Farow/userscripts
// @version				3.0.1
// @description			Highlights new comments since your last visit
// @author				Farow, 1110101, Claude, Gemini
// @include				/https?:\/\/[a-z]+\.reddit\.com\/r\/[\w:+-]+\/comments\/[\da-z]/
// @require				https://raw.githubusercontent.com/bgrins/TinyColor/master/tinycolor.js
// @icon				https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @grant				GM_getValue
// @grant				GM_setValue
// @grant				GM_addStyle
// @run-at				document-idle
// @license				MIT
// ==/UserScript==

'use strict';

/*

    based on https://github.com/Farow/userscripts

	changelog:

		2025-01-27 - 3.0.1 (Vibe coded with Cursor)
			- Added quick action buttons for common time periods (5min, 30min, 1h, ½ post age, ¼ post age).
			- Added +/− buttons to adjust highlight time by 10min (or 1h with Shift key).
		2025-09-01 - 3.0.0 (Vibe coded with Gemini)
			- Upgraded code to modern ES6+ standards (const/let, arrow functions, template literals).
			- Replaced inefficient DOM selections with querySelector for better performance and readability.
			- Removed obsolete helper functions by utilizing modern JavaScript features.
			- General code cleanup and refactoring for better maintenance.
		2020-03-14 - 2.0.2 - fixed exception on comments with no live timestamps
		2019-02-12 - 2.0.1 - fixed issue with media threads
		2016-02-16 - 2.0.0
			- removed better/worse comments
			- removed option to use reddit's new comment highlighting, it is now removed
			- added support for Chromium
			- all visits within the past 7 days are show in a dropdown (similar to reddit's highlighting),
			  you can still choose a custom time
			- added UI for settings with a preview, settings won't be reset on every update
			- you can now select which part of the comment is highlighted
			  available options: whole comment, text and time
		2015-02-20 - 1.0.2 - added option to use either this script's or reddit's comment highlighting
		2014-09-10 - 1.0.1 - no longer highlights your own comments
		2014-08-31 - 1.0.0 - initial release
*/

const HNC = {
	init() {
		if (!document.getElementById('siteTable')) {
			return;
		}

		const linkThing = document.querySelector('.thing.link');
		if (!linkThing) {
			return;
		}

		const threadMatch = linkThing.className.match(/id-(t3_[^ ]+)/);
		if (!threadMatch) {
			return;
		}

		const [, thread] = threadMatch;
		const now = Date.now();

		this.config = this.cfg.load();
		this.clear_history();

		this.config.history[thread] = this.config.history[thread] || [];
		this.config.history[thread].unshift(now);

		/* check for comments */
		if (!document.getElementById('noresults')) {
			/* add UI */
			this.ui.create_comment_highlighter(this.config.history[thread]);
			this.ui.create_config_dialog();
			GM_addStyle(this.data.config_style);
		}

		this.cfg.save();
	},

	highlight(since) {
		const comments = document.getElementsByClassName('comment');
		const loggedInUser = document.body.classList.contains('loggedin') ?
			document.querySelector('.user a')?.textContent :
			null;

		// Cache frequently used selectors
		const authorSelector = '.author';
		const taglineSelector = '.tagline';
		const usertextSelector = '.usertext-body > .md';
		const timestampSelector = '.live-timestamp';

		for (const comment of comments) {
			/* skip removed or deleted comments */
			if (comment.classList.contains('deleted') || comment.classList.contains('spam')) {
				continue;
			}

			/* skip our own comments */
			const authorElement = comment.querySelector(authorSelector);
			if (!authorElement) {
				continue;
			}

			const author = authorElement.textContent;
			if (loggedInUser && loggedInUser === author) {
				continue;
			}

			/* select original or edited comment time */
			const tagline = comment.querySelector(taglineSelector);
			if (!tagline) {
				continue;
			}

			const times = tagline.getElementsByTagName('time');
			if (times.length === 0) {
				continue; // Skip comments with no timestamp (e.g., some mod comments)
			}

			const timeElement = times[this.config.prefer_edited_time ? times.length - 1 : 0];
			const time = Date.parse(timeElement.getAttribute('datetime'));
			if (isNaN(time)) {
				continue; // Skip if time parsing failed
			}

			/* add styles */
			if (time > since) {
				comment.classList.add('hnc_new');

				const elements = {
					'comment': comment,
					'text': comment.querySelector(usertextSelector),
					'time': comment.querySelector(timestampSelector)
				};

				const elementToStyle = elements[this.config.apply_on];
				if (elementToStyle) {
					elementToStyle.setAttribute('style', this.generate_comment_style(time, since));
				}
			}
		}
	},

	reset_highlighting() {
		const comments = document.getElementsByClassName('hnc_new');

		// Loop backwards since we're removing classes from a live HTMLCollection
		for (let i = comments.length - 1; i >= 0; i--) {
			const comment = comments[i];
			comment.classList.remove('hnc_new');

			const elements = {
				'comment': comment,
				'text': comment.querySelector('.usertext-body > .md'),
				'time': comment.querySelector('time')
			};

			for (const key in elements) {
				if (elements[key]) {
					elements[key].removeAttribute('style');
				}
			}
		}
	},

	clear_history() {
		const now = Date.now();
		const expiration = this.config.history_expiration * 24 * 60 * 60 * 1000;

		for (const thread in this.config.history) {
			if (Object.prototype.hasOwnProperty.call(this.config.history, thread)) {
				this.config.history[thread] = this.config.history[thread].filter(visit => now - visit <= expiration);

				if (this.config.history[thread].length === 0) {
					delete this.config.history[thread];
				}
			}
		}
	},

	generate_comment_style(comment_time, since) {
		if (!this.config.comment_style) {
			return '';
		}

		const style = this.config.comment_style.replace(/\s+/g, ' ');
		const color = this.get_color(Date.now() - comment_time, Date.now() - since);
		return style.replace(/%color/g, color);
	},

	get_color(comment_age, highlighting_since) {
		if (!this.config.use_color_gradient) {
			return this.config.color_newer || '#80bfff';
		}

		if (comment_age > highlighting_since - 1) {
			return this.config.color_older || '#cce5ff';
		}

		const time_diff = 1 - comment_age / highlighting_since;
		const color_newer = window.tinycolor(this.config.color_newer || '#80bfff').toHsl();
		const color_older = window.tinycolor(this.config.color_older || '#cce5ff').toHsl();

		const color_final = window.tinycolor({
			h: color_older.h + (color_newer.h - color_older.h) * time_diff,
			s: color_older.s + (color_newer.s - color_older.s) * time_diff,
			l: color_older.l + (color_newer.l - color_older.l) * time_diff
		});

		return color_final.toHslString();
	}
};

HNC.ui = {
	custom_pos: 0,

	create_comment_highlighter(visits) {
		/* create element */
		const highlighter = document.createElement('div');
		highlighter.innerHTML = HNC.data.comment_highlighter;
		highlighter.classList.add('rounded', 'gold-accent', 'comment-visits-box');

		const commentarea = document.querySelector('.commentarea');
		const sitetable = commentarea.querySelector('.sitetable');
		const firstComment = sitetable.querySelector('.comment');
		if (!firstComment) {
			return; // No comments to work with
		}

		const comment_margin = window.getComputedStyle(firstComment).getPropertyValue('margin-left');
		const gold_highlighter = document.querySelector('.comment-visits-box');

		/* remove default comment highlighter */
		if (gold_highlighter) {
			gold_highlighter.remove();
		}

		/* properly place */
		highlighter.style.setProperty('margin-left', comment_margin);
		commentarea.insertBefore(highlighter, sitetable);

		/* generate visits */
		const select = document.getElementById('comment-visits');
		for (const visit of visits) {
			const option = document.createElement('option');
			option.textContent = time_ago(visit);
			option.value = visit;
			select.appendChild(option);
		}

		if (visits.length > 1) {
			select.selectedIndex = 2; // index 2 is the first actual visit
			// Trigger highlighting for the default selection
			HNC.highlight(visits[1]);
		}

		/* add listeners */
		select.addEventListener('change', this.update_highlighting);

		const custom = document.getElementById('hnc_custom_visit');
		custom.style.setProperty('width', `${select.getBoundingClientRect().width}px`);
		custom.addEventListener('keydown', this.custom_visit_key_monitor);
		custom.addEventListener('blur', this.set_custom_visit);

		/* config button */
		const config_button = document.getElementById('hnc_config_icon');
		config_button.style.setProperty('background-image', HNC.data.config_icon.replace(/\s/g, ''));
		config_button.addEventListener('click', this.show_config_dialog);

		/* quick time buttons */
		const quickTimeButtons = document.querySelectorAll('.hnc_quick_time');
		for (const button of quickTimeButtons) {
			button.addEventListener('click', this.quick_time_click);
		}

		/* adjust time buttons */
		document.getElementById('hnc_time_add').addEventListener('click', this.adjust_time_click);
		document.getElementById('hnc_time_subtract').addEventListener('click', this.adjust_time_click);
	},

	currentHighlightTime: null,

	update_time_display(highlightTime) {
		const display = document.getElementById('hnc_time_display');

		if (!highlightTime || highlightTime >= Date.now() - 1000) {
			// No highlight time or very recent (within 1 second)
			display.style.display = 'none';
			return;
		}

		// Calculate time difference
		const diffMs = Date.now() - highlightTime;
		const diffMinutes = Math.floor(diffMs / (60 * 1000));
		const diffHours = Math.floor(diffMinutes / 60);
		const diffDays = Math.floor(diffHours / 24);

		let timeText;
		if (diffDays > 0) {
			timeText = `${diffDays}d ${diffHours % 24}h ago`;
		} else if (diffHours > 0) {
			timeText = `${diffHours}h ${diffMinutes % 60}m ago`;
		} else {
			timeText = `${diffMinutes}m ago`;
		}

		display.textContent = timeText;
		display.style.display = '';
	},

	quick_time_click(event) {
		const button = event.target;
		const select = document.getElementById('comment-visits');
		let highlightTime;

		if (button.dataset.minutes) {
			// Fixed time (5min, 30min, 1h)
			const minutes = parseInt(button.dataset.minutes, 10);
			highlightTime = Date.now() - minutes * 60 * 1000;
		} else if (button.dataset.postRatio) {
			// Dynamic time based on post age (½ age, ¼ age)
			const postTime = HNC.ui.get_post_time();
			if (!postTime) {
				return; // Can't determine post age
			}
			const postAge = Date.now() - postTime;
			const ratio = parseFloat(button.dataset.postRatio);
			highlightTime = Date.now() - (postAge * ratio);
		}

		// Store the current highlight time for +/- buttons
		HNC.ui.currentHighlightTime = highlightTime;

		// Reset highlighting and apply new time
		HNC.reset_highlighting();
		HNC.highlight(highlightTime);

		// Update select to show it's a custom time
		select.selectedIndex = 0; // "no highlighting" to indicate custom quick time

		// Update time display
		HNC.ui.update_time_display(highlightTime);
	},

	adjust_time_click(event) {
		const isAdd = event.target.id === 'hnc_time_add';
		const isShift = event.shiftKey;

		// Determine adjustment: 10min normal, 1h with shift
		const adjustMinutes = isShift ? 60 : 10;
		const adjustMs = adjustMinutes * 60 * 1000;

		// If no current highlight time, start from now
		if (!HNC.ui.currentHighlightTime) {
			HNC.ui.currentHighlightTime = Date.now();
		}

		// Calculate new highlight time
		// Adding means going further back in time (older comments)
		// Subtracting means going forward in time (newer comments)
		let newHighlightTime;
		if (isAdd) {
			newHighlightTime = HNC.ui.currentHighlightTime - adjustMs;
		} else {
			newHighlightTime = HNC.ui.currentHighlightTime + adjustMs;
			// Don't go into the future
			if (newHighlightTime > Date.now()) {
				newHighlightTime = Date.now();
			}
		}

		// Store and apply
		HNC.ui.currentHighlightTime = newHighlightTime;
		HNC.reset_highlighting();
		HNC.highlight(newHighlightTime);

		// Update select and display
		const select = document.getElementById('comment-visits');
		select.selectedIndex = 0;
		HNC.ui.update_time_display(newHighlightTime);
	},

	get_post_time() {
		// Get the post submission time from the page
		const linkThing = document.querySelector('.thing.link');
		if (!linkThing) {
			return null;
		}

		const timeElement = linkThing.querySelector('.tagline time');
		if (!timeElement) {
			return null;
		}

		const postTime = Date.parse(timeElement.getAttribute('datetime'));
		return isNaN(postTime) ? null : postTime;
	},

	update_highlighting(event) {
		/* no highlighting */
		if (event.target.value === '') {
			HNC.reset_highlighting();
			HNC.ui.currentHighlightTime = null;
			HNC.ui.update_time_display(null);
		}
		/* custom */
		else if (event.target.value === 'custom') {
			document.getElementById('comment-visits').style.display = 'none';
			const custom = document.getElementById('hnc_custom_visit');
			custom.style.display = '';
			custom.focus();
			custom.setSelectionRange(0, 2);
		}
		/* previous visit */
		else {
			const visitTime = parseInt(event.target.value, 10);
			HNC.ui.currentHighlightTime = visitTime;
			HNC.reset_highlighting();
			HNC.highlight(visitTime);
			HNC.ui.update_time_display(visitTime);
		}
	},

	custom_visit_key_monitor(event) {
		if (event.altKey || event.ctrlKey || (event.shiftKey && event.key !== 'Tab')) {
			return;
		}

		if (event.key === 'Tab') {
			const match = event.target.value.match(/^(\d+?:)\d+?$/);
			if (match) {
				event.preventDefault();
				event.stopPropagation();
				HNC.ui.custom_pos += event.shiftKey ? -1 : 1;

				if (HNC.ui.custom_pos % 2 === 0) {
					event.target.setSelectionRange(0, match.length - 1);
				} else {
					event.target.setSelectionRange(match.length, match.length);
				}
			}
		} else if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			event.target.blur();
		}
	},

	set_custom_visit(event) {
		const select = document.getElementById('comment-visits');
		const match = event.target.value.match(/^(\d+?):(\d+?)$/);

		if (match) {
			const hours = parseInt(match[1], 10);
			const minutes = parseInt(match[2], 10);
			// Calculate total minutes and convert to milliseconds
			const totalMinutes = hours * 60 + minutes;
			const customVisitTime = Date.now() - totalMinutes * 60 * 1000;
			const option = document.createElement('option');

			option.value = customVisitTime;
			// Simple inline time calculation instead of using time_ago function
			const diffMinutes = Math.floor((Date.now() - customVisitTime) / (60 * 1000));
			if (diffMinutes < 60) {
				option.textContent = `${diffMinutes} minutes ago`;
			} else {
				const diffHours = Math.floor(diffMinutes / 60);
				option.textContent = `${diffHours} hours ago`;
			}

			select.add(option, 2);
			select.selectedIndex = 2;

			// Store and manually trigger highlighting
			HNC.ui.currentHighlightTime = customVisitTime;
			HNC.reset_highlighting();
			HNC.highlight(customVisitTime);
			HNC.ui.update_time_display(customVisitTime);
		} else {
			select.selectedIndex = 0;
		}

		event.target.value = '00:00';
		event.target.style.display = 'none';
		select.style.display = '';
	},

	create_config_dialog() {
		/* create wrapper */
		const wrapper = document.createElement('div');
		document.body.appendChild(wrapper);
		wrapper.id = 'hnc_dialog_wrapper';
		wrapper.innerHTML = HNC.data.config_dialog;

		/* add preview */
		const comment_preview = document.getElementById('hnc_comment_preview');
		const first_comment = document.querySelector('.comment');
		if (!first_comment) {
			return;
		}

		const cloned_comment = first_comment.cloneNode(true);
		const child_element = cloned_comment.querySelector('.child');
		if (child_element) {
			child_element.remove();
		}
		cloned_comment.style.setProperty('margin-left', '0');
		comment_preview.appendChild(cloned_comment);

		wrapper.style.display = 'none';
		wrapper.addEventListener('click', this.hide_config_dialog);

		this.load_config_values();
		this.add_listeners();
	},

	show_config_dialog() {
		document.getElementById('hnc_dialog_wrapper').style.display = '';
	},

	hide_config_dialog(event) {
		if (event.target.id !== 'hnc_dialog_wrapper' && event.target.id !== 'hnc_close_button') {
			return;
		}

		document.getElementById('hnc_dialog_wrapper').style.display = 'none';

		HNC.reset_highlighting();
		const selectedVisit = document.getElementById('comment-visits').value;
		if (selectedVisit && selectedVisit !== 'custom') {
			HNC.highlight(parseInt(selectedVisit, 10));
		}
		HNC.cfg.save();
	},

	load_config_values() {
		const dialog_settings = document.getElementsByClassName('hnc_setting');

		for (const element of dialog_settings) {
			const name = element.id.slice(4);
			if (element.tagName === 'INPUT' && element.type === 'checkbox') {
				element.checked = HNC.config[name];
				if (element.dataset.disable) {
					document.getElementById(element.dataset.disable).disabled = !element.checked;
				}
			} else {
				element.value = HNC.config[name];
			}
		}
		this.update_preview();
	},

	add_listeners() {
		const dialog_settings = document.getElementsByClassName('hnc_setting');
		for (const element of dialog_settings) {
			element.addEventListener('change', this.setting_change);
		}
		document.getElementById('hnc_clear_history_button').addEventListener('click', this.clear_all_history);
		document.getElementById('hnc_reset_button').addEventListener('click', this.reset_config);
		document.getElementById('hnc_close_button').addEventListener('click', this.hide_config_dialog);
	},

	setting_change(event) {
		const name = event.target.id.slice(4);

		if (event.target.tagName === 'INPUT' && event.target.type === 'text' && !event.target.validity.valid) {
			event.target.value = HNC.config[name];
			return;
		}

		if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
			HNC.config[name] = event.target.checked;
			if (event.target.dataset.disable) {
				document.getElementById(event.target.dataset.disable).disabled = !event.target.checked;
			}
		} else {
			HNC.config[name] = event.target.value;
		}
		HNC.ui.update_preview();
	},

	reset_config() {
		const { history } = HNC.config; // keep history
		HNC.config = HNC.cfg.default();
		HNC.config.history = history;
		HNC.ui.load_config_values();
	},

	clear_all_history() {
		HNC.config.history = {};
	},

	update_preview() {
		const preview = document.getElementById('hnc_comment_preview').firstElementChild;
		const elements = {
			'comment': preview,
			'text': preview.querySelector('.usertext-body > .md'),
			'time': preview.querySelector('.live-timestamp')
		};

		for (const [, element] of Object.entries(elements)) {
			if (element) {
				element.removeAttribute('style');
			}
		}

		if (!elements.time) {
			return;
		}

		const comment_age = Date.parse(elements.time.getAttribute('dateTime'));
		if (isNaN(comment_age)) {
			return;
		}

		const double_comment_age = comment_age - (Date.now() - comment_age) * 2;

		const elementToStyle = elements[HNC.config.apply_on];
		if (elementToStyle) {
			elementToStyle.setAttribute('style', HNC.generate_comment_style(comment_age, double_comment_age));
		}
	}
};

HNC.data = {
	comment_highlighter: `
		<div class="title" style="line-height: 24px; padding: 5px 0;">
			<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
				<span>Highlight comments since:</span>
				<select id="comment-visits">
					<option value="">no highlighting</option>
					<option value="custom">custom</option>
				</select>
				<input id="hnc_custom_visit" type="text" value="00:00" pattern="\\d+?:\\d+?" style="display: none;" />
				<span id="hnc_time_display" style="display: none; font-weight: bold; color: #369; padding: 2px 8px; background: #e8f4ff; border-radius: 3px;"></span>
				<div style="flex-basis: 100%; height: 0;"></div>
				<span style="color: #ccc;">|</span>
				<button class="hnc_quick_time" data-minutes="5">5min</button>
				<button class="hnc_quick_time" data-minutes="30">30min</button>
				<button class="hnc_quick_time" data-minutes="60">1h</button>
				<button class="hnc_quick_time" data-post-ratio="0.5">½ age</button>
				<button class="hnc_quick_time" data-post-ratio="0.25">¼ age</button>
				<span style="color: #ccc;">|</span>
				<button id="hnc_time_subtract" class="hnc_adjust_time" title="−10min (Shift: −1h)">−</button>
				<button id="hnc_time_add" class="hnc_adjust_time" title="+10min (Shift: +1h)">+</button>
				<span id="hnc_config_icon"></span>
			</div>
		</div>`,

	config_dialog: `
		<div id="hnc_dialog">
			<div>
				<label><input id="hnc_prefer_edited_time" class="hnc_setting" type="checkbox">Highlight edited comments</label>
			</div>
			<hr />
			<div>
				<label><input type="checkbox" id="hnc_use_color_gradient" class="hnc_setting" data-disable="hnc_color_older">Use time based color gradient</label>
			</div>
			<div>
				<label class="hnc_fixed_width" for="hnc_color_newer">Newer comments color</label><input type="text" id="hnc_color_newer" class="hnc_setting" title="Supported formats:&#13;#80bfff&#13;rgba(128, 191, 255, 1)&#13;hsla(210, 100%, 75%, 1)" pattern="(#(?:[\\da-fA-F]{3}){1,2}|rgb\\((?:\\d{1,3},\\s*){2}\\d{1,3}\\)|rgba\\((?:\\d{1,3},\\s*){3}\\d*\\.?\\d+\\)|hsl\\(\\d{1,3}(?:,\\s*\\d{1,3}%){2}\\)|hsla\\(\\d{1,3}(?:,\\s*\\d{1,3}%){2},\\s*\\d*\\.?\\d+\\))">
			</div>
			<div>
				<label class="hnc_fixed_width" for="hnc_color_older">Older comments color</label><input type="text" id="hnc_color_older" class="hnc_setting" title="Supported formats:&#13;#cce5ff&#13;rgba(204, 229, 255, 1)&#13;hsla(210, 100%, 90%, 1)" pattern="(#(?:[\\da-fA-F]{3}){1,2}|rgb\\((?:\\d{1,3},\\s*){2}\\d{1,3}\\)|rgba\\((?:\\d{1,3},\\s*){3}\\d*\\.?\\d+\\)|hsl\\(\\d{1,3}(?:,\\s*\\d{1,3}%){2}\\)|hsla\\(\\d{1,3}(?:,\\s*\\d{1,3}%){2},\\s*\\d*\\.?\\d+\\))">
			</div>
			<hr />
			<div>
				<label class="hnc_fixed_width" for="hnc_apply_on">Apply styles on</label><select id="hnc_apply_on" class="hnc_setting"><option>text</option><option>comment</option><option>time</option></select>
			</div>
			<div>
				<label for="hnc_comment_style">Comment style</label>
				<textarea id="hnc_comment_style" class="hnc_setting"></textarea>
			</div>
			<hr />
			<div>
				<label for="hnc_comment_preview">Preview</label>
				<div id="hnc_comment_preview"></div>
			</div>
			<hr />
			<div style="float: right">
				<button id="hnc_clear_history_button">Clear history</button>
				<button id="hnc_reset_button">Reset</button>
				<button id="hnc_close_button">Close</button>
			<div>
		</div>`,

	config_style: `
		input.hnc_setting[pattern]:invalid, #hnc_custom_visit:invalid {
			box-shadow: 0 0 5px 0 #FF4060;
			background-color: #FF4060;
		}
		.hnc_quick_time {
			padding: 2px 8px;
			margin: 0 2px;
			font-size: 11px;
			cursor: pointer;
			background-color: #5f99cf;
			color: white;
			border: 1px solid #4a7ba7;
			border-radius: 3px;
			vertical-align: middle;
		}
		.hnc_quick_time:hover {
			background-color: #4a7ba7;
		}
		.hnc_quick_time:active {
			background-color: #3a5f7f;
		}
		.hnc_adjust_time {
			padding: 2px 10px;
			margin: 0 2px;
			font-size: 14px;
			font-weight: bold;
			cursor: pointer;
			background-color: #369;
			color: white;
			border: 1px solid #258;
			border-radius: 3px;
			vertical-align: middle;
		}
		.hnc_adjust_time:hover {
			background-color: #258;
		}
		.hnc_adjust_time:active {
			background-color: #147;
		}
		#hnc_config_icon {
			display: inline-block;
			width: 20px;
			height: 20px;
			vertical-align: top;
			cursor: pointer;
			margin-left: 5px;
		}
		#hnc_dialog_wrapper {
			display: flex;
			justify-content: center;
			align-items: center;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 2147483647;
			background-color: rgba(192, 192, 192, 0.7);
			font-size: 12px;
		}
		#hnc_dialog {
			align-self: flex-start;
			margin-top: 80px;
			padding: 5px 0;
			width: 900px;
			max-height: 95%;
			overflow-y: auto;
			box-shadow: 0 0 20px 5px rgb(64, 64, 64);
			background-color: #F5F5F5;
			color: #333;
		}
		#hnc_dialog > div { margin: 5px 10px; }
		#hnc_dialog > hr {
			margin: 0;
			height: 1px;
			border: none;
			background-color: grey;
		}
		label.hnc_fixed_width { width: 148px; }
		#hnc_dialog label { display: inline-block; }
		#hnc_dialog label > input:not([type=checkbox]) { margin-left: 5px; }
		#hnc_dialog label > input[type=checkbox] {
			margin-right: 5px;
			vertical-align: top;
		}
		#hnc_comment_style {
			box-sizing: border-box;
			width: 100% !important;
			height: 50px;
			max-height: 400px;
			font-family: monospace;
		}`,

	config_icon: `
		url(data:image/png;base64,
		iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxIAAAsSAdLdfvwA
		AAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuNvyMY98AAAIfSURBVDhPnZQ9SBxRFIXHaIgg2Agm2GhhofiDsCAYiwV1ZQnM/rIGUmStFtLY
		hkjCdoKKtU1S2PmDyGLAThAEC8HKQhsFFSwFE0yCuua7b+9bXtbZoB44zLxzzr3z3ps34/0P+Xz+WSKRKMAbYTKZXFXraYjH48M0KcI7ZTGVSg2q
		/XAwmyY4C/84zSx/on+ORCINGg8GoQEYomACXjgNqvGEFbzj2k1dv7YpAWEMw12aIfoVLHA/BWe43+R6bX2HshVvTbNoNPqC4GlAaD2TybwyIQfp
		dLqL/F5lHu1MeplAgFmgWa32uAcKG8nsV9Yxyw7xaxgsWZHgD67NphLIU9krH74Jh8N1KssJeE2uvE3ULSDXGJPBB2vAZSOCUCj0HG/bKdpALhWV
		JnLoeCnVTcNP1oBfVBY97OiGzKxPbfEXHe+9yp7HYNIahPIqS4Eco3IzWPR9v11tqVu2HtmsysaQs2eNgsoCWdY8LKLfwmnVzWeJfmzrysdG3ibB
		79aAvzBbjamIxWItzOylDg2oGXVqZCIr5mSwJz2uoeZWNput19p7kPNJrjw7p67Ty+Vy8iaPAswdeZj2sJAtGArKwyPpZVIs0Sckv6d/Qmi3XHfh
		N+4XuB5Yz6XWxkwzC76YXoxOjI/w0oarkew5ExlnFW2Mu7VNMGSPKPhKMOhH8BvOyeen8YeDp/sVzeSvMqL246FnbV32SPdpTa0q8Ly/60amOe0Z
		Tw0AAAAASUVORK5CYII=)`
};

HNC.cfg = {
	load() {
		const config = GM_getValue('config');
		// Merge saved config with defaults to ensure all keys exist after an update
		return config ? { ...this.default(), ...JSON.parse(config) } : this.default();
	},
	save() {
		GM_setValue('config', JSON.stringify(HNC.config));
	},
	default() {
		return {
			'prefer_edited_time': true,
			'use_color_gradient': true,
			'color_newer': 'hsl(210, 100%, 65%)',
			'color_older': 'hsl(210, 100%, 90%)',
			'apply_on': 'text',
			'comment_style': 'background-color: %color !important;\npadding: 0 5px;',
			'history': {},
			'history_expiration': 7 // in days
		};
	}
};

/* original authored by TheBrain, at http://stackoverflow.com/a/12475270 - slightly modified for ES6 */
function time_ago(time, _precision = 2) {
	if (!time) {
		return 'unknown time';
	}

	let timeInput = time;
	switch (typeof timeInput) {
		case 'string': timeInput = +new Date(timeInput); break;
		case 'object': if (timeInput.constructor === Date) {
			timeInput = timeInput.getTime();
		} break;
		case 'number':
			// timeInput is already a number (timestamp), use it as-is
			break;
		default:
			timeInput = +new Date();
	}

	if (isNaN(timeInput)) {
		return 'invalid time';
	}

	const time_formats = [
		[60, 'seconds', 1],
		[120, '1 minute ago', '1 minute from now'],
		[3600, 'minutes', 60],
		[7200, '1 hour ago', '1 hour from now'],
		[86400, 'hours', 3600],
		[172800, 'Yesterday', 'Tomorrow'],
		[604800, 'days', 86400],
		[1209600, 'Last week', 'Next week'],
		[2419200, 'weeks', 604800],
		[4838400, 'Last month', 'Next month'],
		[29030400, 'months', 2419200],
		[58060800, 'Last year', 'Next year'],
		[2903040000, 'years', 29030400]
	];

	const seconds = (Date.now() - timeInput) / 1000;
	const token = 'ago';
	const list_choice = 1;

	if (seconds < 5) {
		return 'just now';
	}

	let i = 0;
	let format;
	while ((format = time_formats[i++])) {
		if (seconds < format[0]) {
			// If format[2] is undefined, it's a fixed string format (e.g., "1 minute ago")
			if (typeof format[2] === 'undefined') {
				return format[list_choice];
			}
			// Otherwise, calculate the time (e.g., "5 minutes ago")
			return `${Math.floor(seconds / format[2])} ${format[1]} ${token}`;
		}
	}
	return 'a very long time ago';
}

try {
	HNC.init();
} catch (error) {
	// eslint-disable-next-line no-console
	console.error('[Reddit highlight new comments]', error);
}
