// ==UserScript==
// @name         OpenStreetMap Direktlinks
// @namespace    1110101
// @version      6.3.0
// @description  Fügt Direktlinks zu Google Maps, Google Earth und OpenRailwayMap in OpenStreetMap hinzu.
// @author       1110101@oczc.de
// @match        *://www.openstreetmap.org/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openstreetmap.org
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/OpenStreetMap%20Direktlinks.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/OpenStreetMap%20Direktlinks.user.js
// ==/UserScript==

(function () {
	'use strict';

	// Inline SVG icons to prevent CSP issues and ensure crisp high-res rendering
	const ICONS = {
		maps: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
		earth: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
		railway: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M12 2c-4.42 0-8 .58-8 1.5V18c0 .75.43 1.39 1.05 1.76L3.5 21v1h2l1.64-1.64C8.04 20.8 9.68 21 11.5 21s3.46-.2 4.36-.64L17.5 22h2v-1l-1.55-1.24c.62-.37 1.05-1.01 1.05-1.76V3.5c0-.92-3.58-1.5-8-1.5zM12 4c3.87 0 6 .43 6 .75v1.25H6V4.75C6 4.43 8.13 4 12 4zm5 12H7V8h10v8zm-8.5-3.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm7 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/></svg>`
	};

	// CSS Injection
	const style = document.createElement('style');
	style.textContent = `
		.osm-geo-direct-link {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			color: #333 !important;
			text-decoration: none;
			transition: all 0.15s ease;
			font-weight: 600;
			font-size: 11px;
			padding: 4px 10px;
			border: 1px solid #ccc;
			border-radius: 4px;
			background: #fff;
			cursor: pointer;
		}
		.osm-geo-direct-link:hover {
			background: #f8f9fa;
			border-color: #aaa;
		}
		.osm-geo-direct-link svg {
			transition: transform 0.15s ease;
		}
		.osm-geo-direct-link:hover svg {
			transform: scale(1.1);
		}
		
		/* Custom Colors */
		.osm-geo-direct-link.gmaps { color: #0d6efd !important; border-color: #0d6efd; }
		.osm-geo-direct-link.gmaps:hover { background: #0d6efd; color: #fff !important; }

		.osm-geo-direct-link.railway { color: #dc3545 !important; border-color: #dc3545; }
		.osm-geo-direct-link.railway:hover { background: #dc3545; color: #fff !important; }

		.osm-geo-direct-link.earth { color: #198754 !important; border-color: #198754; }
		.osm-geo-direct-link.earth:hover { background: #198754; color: #fff !important; }

		#osm-ext-maps-group {
			display: inline-flex;
			gap: 4px;
			vertical-align: middle;
			height: fit-content;
			margin-left: 8px;
		}
	`;
	(document.head || document.documentElement).appendChild(style);

	const getCoords = () => {
		const { hash, search } = window.location;
		const m = hash.match(/map=(\d+(?:\.\d+)?)\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
		if (m) {
			return {
				zoom: parseFloat(m[1]),
				lat: m[2],
				lon: m[3]
			};
		}

		// Fallback: Check query parameters
		const params = new URLSearchParams(search);
		const lat = params.get('lat');
		const lon = params.get('lon');
		const zoom = params.get('zoom') || '15';
		if (lat && lon) {
			return {
				zoom: parseFloat(zoom),
				lat,
				lon
			};
		}

		return null;
	};

	function updateLinks(btnGroup) {
		const c = getCoords();
		if (!c) {
			return;
		}

		const gmaps = btnGroup.querySelector('.osm-geo-direct-link.gmaps');
		if (gmaps) {
			gmaps.href = `https://www.google.com/maps/@${c.lat},${c.lon},${c.zoom}z`;
		}

		const railway = btnGroup.querySelector('.osm-geo-direct-link.railway');
		if (railway) {
			railway.href = `https://www.openrailwaymap.app/?style=standard&lat=${c.lat}&lon=${c.lon}&zoom=${Math.round(c.zoom)}`;
		}

		const earth = btnGroup.querySelector('.osm-geo-direct-link.earth');
		if (earth) {
			const range = Math.round(150 * Math.pow(2, (19 - c.zoom)));
			earth.href = `https://earth.google.com/web/@${c.lat},${c.lon},${range}d,35y,0h,0t,0r`;
		}
	}

	/**
	 * Creates a direct link anchor element.
	 *
	 * @param {string} label Button label
	 * @param {string} svgIcon Inline SVG icon
	 * @param {string} title Tooltip text
	 * @param {string} type CSS class suffix for color styling
	 * @returns {HTMLAnchorElement} The anchor element
	 */
	function createDirectLink(label, svgIcon, title, type) {
		const a = document.createElement('a');
		a.className = `osm-geo-direct-link ${type}`;
		a.title = title;
		a.target = '_blank';
		a.rel = 'noopener noreferrer';
		a.href = '#';
		a.innerHTML = `${svgIcon}<span>${label}</span>`;
		return a;
	}

	let observer = null;

	function init() {
		if (document.getElementById('osm-ext-maps-group')) {
			if (observer) {
				observer.disconnect();
			}
			return true;
		}

		const ref = document.querySelector('button[data-bs-target="#select_language_dialog"]');
		if (!ref) {
			return false;
		}

		const btnGroup = document.createElement('div');
		btnGroup.id = 'osm-ext-maps-group';

		const gBtn = createDirectLink('G-Maps', ICONS.maps, 'Ort in Google Maps öffnen', 'gmaps');
		const rBtn = createDirectLink('Railway', ICONS.railway, 'Ort in OpenRailwayMap öffnen', 'railway');
		const eBtn = createDirectLink('Earth', ICONS.earth, 'Ort in Google Earth öffnen', 'earth');

		btnGroup.appendChild(gBtn);
		btnGroup.appendChild(rBtn);
		btnGroup.appendChild(eBtn);

		updateLinks(btnGroup);

		// Update link URLs on user interaction and map movements
		btnGroup.addEventListener('mouseenter', () => updateLinks(btnGroup));
		window.addEventListener('hashchange', () => updateLinks(btnGroup));

		ref.after(btnGroup);

		if (observer) {
			observer.disconnect();
		}
		return true;
	}

	if (!init()) {
		observer = new MutationObserver(() => {
			if (init()) {
				observer.disconnect();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}
})();
