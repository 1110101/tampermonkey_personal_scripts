// ==UserScript==
// @name         Zoomout with right click for Leaflet or OpenLayers
// @namespace    1110101
// @version      1.6.0
// @description  Zoomout with right click for Leaflet or OpenLayers
// @author       1110101@oczc.de
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=leafletjs.com
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Leaflet-OpenLayers-Zoomout.user.js
// @updateURL    https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Leaflet-OpenLayers-Zoomout.user.js
// ==/UserScript==

(function () {
	'use strict';

	let lastRightClickTime = 0;
	let justDoubleRightClicked = false;
	const DOUBLE_CLICK_DELAY = 350;

	function getLegacyOpenLayersMap() {
		for (const k in window) {
			try {
				if (window[k] &&
					window[k].CLASS_NAME === 'OpenLayers.Map' &&
					typeof window[k].zoomTo === 'function') {
					return window[k];
				}
			} catch {
				// Ignored
			}
		}
		return null;
	}

	function findMapForElement(target) {
		if (!target || !target.closest) {
			return null;
		}

		// Leaflet container
		const leafletContainer = target.closest('.leaflet-container');
		if (leafletContainer) {
			for (const key in leafletContainer) {
				try {
					const val = leafletContainer[key];
					if (val && typeof val.zoomOut === 'function') {
						return { type: 'leaflet', map: val };
					}
				} catch {
					// Ignored
				}
			}
			if (window.map && typeof window.map.zoomOut === 'function') {
				return { type: 'leaflet', map: window.map };
			}
			if (window.karte && typeof window.karte.zoomOut === 'function') {
				return { type: 'leaflet', map: window.karte };
			}
		}

		// OpenLayers container (modern .ol-viewport or legacy .olMapViewport)
		const olContainer = target.closest('.olMapViewport, .ol-viewport, [id^="OpenLayers.Map_"]');
		if (olContainer) {
			if (window.map && typeof window.map.getView === 'function') {
				return { type: 'openlayers-modern', map: window.map };
			}
			const legacyMap = getLegacyOpenLayersMap();
			if (legacyMap) {
				return { type: 'openlayers-legacy', map: legacyMap };
			}
		}

		return null;
	}

	// Use event delegation on document so dynamic maps in SPAs are automatically supported
	document.addEventListener('mousedown', (e) => {
		if (e.button !== 2) {
			return;
		}

		const mapInfo = findMapForElement(e.target);
		if (!mapInfo) {
			return;
		}

		const now = Date.now();
		if (now - lastRightClickTime < DOUBLE_CLICK_DELAY) {
			justDoubleRightClicked = true;
			lastRightClickTime = 0;
			e.preventDefault();

			try {
				if (mapInfo.type === 'leaflet') {
					mapInfo.map.zoomOut();
				} else if (mapInfo.type === 'openlayers-modern') {
					const view = mapInfo.map.getView();
					if (view && typeof view.setZoom === 'function' && typeof view.getZoom === 'function') {
						view.setZoom(view.getZoom() - 1);
					}
				} else if (mapInfo.type === 'openlayers-legacy') {
					mapInfo.map.zoomTo(mapInfo.map.getZoom() - 1);
				}
			} catch (err) {
				console.error('[Zoomout Userscript] Error zooming out:', err);
			}
		} else {
			lastRightClickTime = now;
		}
	}, true);

	// Suppress context menu only when a double right click was performed
	document.addEventListener('contextmenu', (e) => {
		if (justDoubleRightClicked) {
			e.preventDefault();
			justDoubleRightClicked = false;
			return false;
		}
	}, true);

})();
