// ==UserScript==
// @name         Wikipedia Koordinaten Direktlinks
// @namespace    1110101
// @version      1.0
// @description  Fügt Direktlinks zu Google Maps, Google Earth, OpenRailwayMap und OpenStreetMap bei den Wikipedia-Koordinaten hinzu.
// @author       1110101@oczc.de
// @match        *://de.wikipedia.org/wiki/*
// @match        *://de.wikipedia.org/w/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wikipedia.org
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Wikipedia%20Koordinaten%20Direktlinks.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Wikipedia%20Koordinaten%20Direktlinks.user.js
// ==/UserScript==

(function () {
	'use strict';

	// Inline SVG icons to prevent CSP issues and ensure crisp high-res rendering
	const ICONS = {
		maps: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
		earth: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
		railway: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M12 2c-4.42 0-8 .58-8 1.5V18c0 .75.43 1.39 1.05 1.76L3.5 21v1h2l1.64-1.64C8.04 20.8 9.68 21 11.5 21s3.46-.2 4.36-.64L17.5 22h2v-1l-1.55-1.24c.62-.37 1.05-1.01 1.05-1.76V3.5c0-.92-3.58-1.5-8-1.5zM12 4c3.87 0 6 .43 6 .75v1.25H6V4.75C6 4.43 8.13 4 12 4zm5 12H7V8h10v8zm-8.5-3.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm7 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/></svg>`,
		osm: `<svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>`
	};

	// CSS Injection
	const style = document.createElement('style');
	style.textContent = `
		.wiki-geo-direct-link {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			color: #36b !important;
			text-decoration: none;
			transition: color 0.15s ease, opacity 0.15s ease;
			font-weight: normal;
		}
		.wiki-geo-direct-link:hover {
			text-decoration: underline !important;
			color: #248 !important;
		}
		.wiki-geo-direct-link svg {
			transition: transform 0.15s ease;
		}
		.wiki-geo-direct-link:hover svg {
			transform: scale(1.1);
		}
	`;
	document.head.appendChild(style);

	/**
	 * Parses the GeoHack query parameters to extract latitude and longitude.
	 * Supports Decimal degrees, DM (Degrees-Minutes), and DMS (Degrees-Minutes-Seconds).
	 *
	 * @param {string} paramsString GeoHack params string
	 * @returns {{lat: number, lon: number}|null} Coordinates object, or null if parsing fails
	 */
	function parseGeoHackParams(paramsString) {
		if (!paramsString) {
			return null;
		}

		// Match up to 3 groups of numbers (deg, min, sec) followed by N/S (lat) or E/W/O (lon)
		const latMatch = paramsString.match(/(\d+(?:\.\d+)?)(?:_(\d+(?:\.\d+)?))?(?:_(\d+(?:\.\d+)?))?_(N|S)/i);
		const lonMatch = paramsString.match(/(\d+(?:\.\d+)?)(?:_(\d+(?:\.\d+)?))?(?:_(\d+(?:\.\d+)?))?_(E|W|O)/i);

		if (!latMatch || !lonMatch) {
			// Fallback: try parsing direct decimal values separated by semicolon or underscore
			// e.g. "49.215222_3.994361" or "49.215222;3.994361"
			const simpleMatch = paramsString.match(/(-?\d+\.\d+)[;_](-?\d+\.\d+)/);
			if (simpleMatch) {
				return {
					lat: parseFloat(simpleMatch[1]),
					lon: parseFloat(simpleMatch[2])
				};
			}
			return null;
		}

		const convertToDecimal = (deg, min, sec, hem) => {
			let val = parseFloat(deg);
			if (min) {
				val += parseFloat(min) / 60;
			}
			if (sec) {
				val += parseFloat(sec) / 3600;
			}
			if (hem === 'S' || hem === 'W') {
				val = -val;
			}
			return val;
		};

		const lat = convertToDecimal(latMatch[1], latMatch[2], latMatch[3], latMatch[4].toUpperCase());
		let lonHem = lonMatch[4].toUpperCase();
		if (lonHem === 'O') {
			lonHem = 'E'; // Standardize German 'O' (Ost) to 'E' (East)
		}
		const lon = convertToDecimal(lonMatch[1], lonMatch[2], lonMatch[3], lonHem);

		return { lat, lon };
	}

	/**
	 * Creates a direct link element.
	 *
	 * @param {string} url Target URL
	 * @param {string} label Link label
	 * @param {string} svgIcon Inline SVG icon
	 * @param {string} title Tooltip text
	 * @returns {HTMLAnchorElement} The anchor element
	 */
	function createDirectLink(url, label, svgIcon, title) {
		const a = document.createElement('a');
		a.href = url;
		a.target = '_blank';
		a.rel = 'noopener noreferrer';
		a.className = 'wiki-geo-direct-link';
		a.title = title;
		a.innerHTML = `${svgIcon}<span>${label}</span>`;
		return a;
	}

	function init() {
		const coordContainer = document.getElementById('coordinates');
		if (!coordContainer) {
			return;
		}

		const geoHackLink = coordContainer.querySelector('a[href*="geohack.toolforge.org"]');
		if (!geoHackLink) {
			return;
		}

		try {
			const url = new URL(geoHackLink.href);
			const params = url.searchParams.get('params');
			const coords = parseGeoHackParams(params);

			if (!coords) {
				console.warn('[Wikipedia Direct Links] Could not parse coordinates from GeoHack URL:', geoHackLink.href);
				return;
			}

			const { lat, lon } = coords;

			// Extract 'dim' from GeoHack parameters (default to 2000 for standard landmarks)
			const dimMatch = params ? params.match(/dim:(\d+)/i) : null;
			const dim = dimMatch ? parseInt(dimMatch[1], 10) : 2000;
			const earthRange = dim * 10;

			// Define map URLs matching Wikipedia and OSM standards
			const mapsUrl = `https://www.google.com/maps?ll=${lat},${lon}&z=14&t=m&q=${lat},${lon}&hl=de`;
			const earthUrl = `https://earth.google.com/web/@${lat},${lon},0a,${earthRange}d,1y,0h,60t,0r`;
			const railwayUrl = `https://www.openrailwaymap.org/?style=standard&lat=${lat}&lon=${lon}&zoom=15`;
			const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=14`;

			// Create links
			const links = [
				{ url: mapsUrl, label: 'Google Maps', icon: ICONS.maps, title: 'Ort in Google Maps öffnen' },
				{ url: earthUrl, label: 'Earth', icon: ICONS.earth, title: 'Ort in Google Earth öffnen' },
				{ url: railwayUrl, label: 'Railway', icon: ICONS.railway, title: 'Ort in OpenRailwayMap öffnen' },
				{ url: osmUrl, label: 'OSM', icon: ICONS.osm, title: 'Ort in OpenStreetMap öffnen' }
			];

			// Append links to the coordinates container
			links.forEach(linkInfo => {
				// Add separator
				const separator = document.createElement('span');
				separator.className = 'noprint coordinates-separator';
				separator.textContent = ' | ';
				coordContainer.appendChild(separator);

				// Add direct link
				const linkEl = createDirectLink(linkInfo.url, linkInfo.label, linkInfo.icon, linkInfo.title);
				coordContainer.appendChild(linkEl);
			});

		} catch (err) {
			console.error('[Wikipedia Direct Links] Error setting up direct links:', err);
		}
	}

	init();
})();
