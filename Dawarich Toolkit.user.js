// ==UserScript==
// @name         Dawarich Toolkit
// @namespace    1110101
// @version      2.0
// @description  Adds a date range dropdown to the Dawarich map
// @author       1110101@oczc.de
// @match        https://dawarich.*.de/map/v2*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=dawarich.app
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Dawarich%20Toolkit.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Dawarich%20Toolkit.user.js
// ==/UserScript==

(function () {
	'use strict';

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	// === Utilities ===

	const pad = (n) => String(n).padStart(2, '0');

	const toLocalISOString = (date) => {
		const tzOffset = -date.getTimezoneOffset();
		const sign = tzOffset >= 0 ? '+' : '-';
		const abs = Math.abs(tzOffset);
		const tz = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
			`T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${tz}`;
	};

	const buildRangeUrl = (start, end) =>
		`/map/v2?start_at=${encodeURIComponent(toLocalISOString(start))}&end_at=${encodeURIComponent(toLocalISOString(end))}`;

	const getRefDate = () => {
		const input = document.getElementById('start_at');
		if (input?.value) {
			const d = new Date(input.value);
			if (!isNaN(d)) { return d; }
		}
		return new Date();
	};

	// === Range builders ===
	// All follow (ref: Date, offset: number) -> { start: Date, end: Date, label: string }

	const yearRange = (ref, offset) => {
		const y = ref.getFullYear() + offset;
		return { start: new Date(y, 0, 1, 0, 0, 0), end: new Date(y, 11, 31, 23, 59, 59), label: String(y) };
	};

	const halfRange = (ref, offset) => {
		const total = ref.getFullYear() * 2 + Math.floor(ref.getMonth() / 6) + offset;
		const y = Math.floor(total / 2);
		const h = ((total % 2) + 2) % 2;
		const sm = h * 6;
		return {
			start: new Date(y, sm, 1, 0, 0, 0),
			end: new Date(y, sm + 6, 0, 23, 59, 59),
			label: `H${h + 1} ${String(y).slice(-2)}`
		};
	};

	const monthRange = (ref, offset) => {
		const total = ref.getFullYear() * 12 + ref.getMonth() + offset;
		const y = Math.floor(total / 12);
		const m = ((total % 12) + 12) % 12;
		return {
			start: new Date(y, m, 1, 0, 0, 0),
			end: new Date(y, m + 1, 0, 23, 59, 59),
			label: `${MONTH_NAMES[m]} ${String(y).slice(-2)}`
		};
	};

	const isoWeekNumber = (date) => {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const day = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - day);
		const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return { week: Math.ceil((((d - jan1) / 86400000) + 1) / 7), year: d.getUTCFullYear() };
	};

	const weekRange = (ref, offset) => {
		const day = ref.getDay() || 7;
		const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - (day - 1) + offset * 7, 0, 0, 0);
		const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);
		const { week, year } = isoWeekNumber(monday);
		return { start: monday, end: sunday, label: `KW${week}/${String(year).slice(-2)}` };
	};

	const days7Range = (ref, offset) => {
		const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + offset * 7, 0, 0, 0);
		const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
		return { start, end, label: `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}` };
	};

	// === DOM helpers ===

	const makeBtn = (text, url, highlight = false, size = 'sm') => {
		const a = document.createElement('a');
		a.className = highlight
			? `btn btn-${size} btn-primary btn-outline`
			: `btn btn-${size} border border-base-300 hover:btn-ghost`;
		a.href = url;
		a.textContent = text;
		return a;
	};

	const makeNavRow = (label, rangeFn, ref) => {
		const prev = rangeFn(ref, -1);
		const curr = rangeFn(ref, 0);
		const next = rangeFn(ref, 1);

		const row = document.createElement('div');
		row.className = 'flex items-center gap-1';

		const lbl = document.createElement('span');
		lbl.className = 'text-xs opacity-50 w-12 shrink-0 text-right pr-1';
		lbl.textContent = label;
		row.appendChild(lbl);

		row.appendChild(makeBtn(`◄ ${prev.label}`, buildRangeUrl(prev.start, prev.end), false, 'xs'));
		row.appendChild(makeBtn(curr.label, buildRangeUrl(curr.start, curr.end), true, 'xs'));
		row.appendChild(makeBtn(`${next.label} ►`, buildRangeUrl(next.start, next.end), false, 'xs'));

		return row;
	};

	// === Injection ===

	const injectDropdown = (flexRow, ref) => {
		if (document.getElementById('dtk-dropdown')) { return; }

		const ROWS = [
			{ label: 'Year',   fn: yearRange },
			{ label: '6 Mo',   fn: halfRange },
			{ label: 'Month',  fn: monthRange },
			{ label: '7 Days', fn: days7Range },
			{ label: 'KW',     fn: weekRange }
		];

		const panel = document.createElement('div');
		panel.className = 'bg-base-200 rounded-box shadow-xl border border-base-300 p-3 flex flex-col gap-2';
		panel.style.cssText = 'position:absolute; top:100%; right:0; z-index:9999; min-width:22rem; display:none;';

		for (const { label, fn } of ROWS) {
			panel.appendChild(makeNavRow(label, fn, ref));
		}

		const trigger = document.createElement('button');
		trigger.type = 'button';
		trigger.className = 'btn btn-sm border border-base-300 hover:btn-ghost';
		trigger.textContent = 'Ranges';

		trigger.addEventListener('click', (e) => {
			e.stopPropagation();
			panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
		});

		document.addEventListener('click', () => { panel.style.display = 'none'; }, { capture: true, passive: true });

		const dd = document.createElement('div');
		dd.id = 'dtk-dropdown';
		dd.style.position = 'relative';
		dd.appendChild(trigger);
		dd.appendChild(panel);

		flexRow.appendChild(dd);
	};

	const injectButtons = () => {
		const form = document.querySelector('[data-controller="map-controls"] form');
		if (!form) { return; }

		const flexRow = form.querySelector('.flex.flex-col.space-y-4');
		if (!flexRow) { return; }

		const ref = getRefDate();
		injectDropdown(flexRow, ref);
	};

	document.addEventListener('turbo:render', injectButtons);

	if (document.querySelector('[data-controller="map-controls"] form')) {
		injectButtons();
	} else {
		const observer = new MutationObserver(() => {
			if (document.querySelector('[data-controller="map-controls"] form')) {
				observer.disconnect();
				injectButtons();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}
})();
