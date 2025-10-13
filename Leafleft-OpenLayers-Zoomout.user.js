// ==UserScript==
// @name				Zoomout with right click for Leafleft or OpenLayers
// @namespace			1110101
// @version				1.5
// @description			Zoomout with right click for Leafleft or OpenLayers
// @author				1110101@oczc.de
// @match				*://*/*
// @icon				https://www.google.com/s2/favicons?sz=64&domain=leaflet.org
// @grant				none
// @run-at				document-idle
// @license				MIT
// @downloadURL			https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Leafleft-OpenLayers-Zoomout.user.js
// @updateURL			https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Leafleft-OpenLayers-Zoomout.user.js
// ==/UserScript==

(function () {
	'use strict';
	let lastRightClickTime = null;
	const doubleClickDelay = 350;

	function getLeafletMaps() {
		const maps = [];
		if (window.L && typeof window.L.Map === 'function') {
			for (const k in window) {
				try { if (window[k] instanceof window.L.Map) {maps.push(window[k]);} } catch (e) {}
			}
		}
		if (window.map && typeof window.map.zoomOut === 'function') {maps.push(window.map);}
		if (window.karte && typeof window.karte.zoomOut === 'function') {maps.push(window.karte);}
		document.querySelectorAll('.leaflet-container').forEach((elem) => {
			for (const key in elem) {
				try {
					if (elem[key] &&
                        typeof elem[key].zoomOut === 'function' &&
                        typeof elem[key].zoomIn === 'function') {
						maps.push(elem[key]);
					}
				} catch (e) {}
			}
		});
		return Array.from(new Set(maps));
	}

	function getOpenLayersMap() {
		for (const k in window) {
			try {
				if (window[k] &&
                    window[k].CLASS_NAME === 'OpenLayers.Map' &&
                    typeof window[k].zoomTo === 'function') {
					return window[k];
				}
			} catch (e) {}
		}
		return null;
	}

	function addDoubleRightClickListener(elem, cb) {
		elem.addEventListener('mousedown', (e) => {
			if (e.button === 2) {
				const now = Date.now();
				if (lastRightClickTime && (now - lastRightClickTime < doubleClickDelay)) {
					cb();
					lastRightClickTime = null;
				} else {
					lastRightClickTime = now;
				}
				e.preventDefault();
			}
		}, true);
		elem.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			return false;
		}, true);
	}

	function attachListeners() {
		// Leaflet
		document.querySelectorAll('.leaflet-container').forEach((elem) => {
			addDoubleRightClickListener(elem, () => {
				const maps = getLeafletMaps();
				maps.forEach(map => { try { map.zoomOut(); } catch (e) {} });
			});
		});

		// OpenLayers
		document.querySelectorAll('.olMapViewport, [id^="OpenLayers.Map_"]').forEach((elem) => {
			addDoubleRightClickListener(elem, () => {
				const map = getOpenLayersMap();
				if (map) {
					try { map.zoomTo(map.getZoom() - 1); } catch (e) {}
				}
			});
		});
	}

	window.addEventListener('DOMContentLoaded', attachListeners);
	setTimeout(attachListeners, 1000);

})();
