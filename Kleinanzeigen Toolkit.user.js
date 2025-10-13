// ==UserScript==
// @name				Kleinanzeigen.de Toolkit
// @namespace			1110101
// @version				5.3
// @description			Save all data including text and images on Kleinanzeigen.de to quickly reupload them
// @author				1110101@oczc.de
// @match				https://www.kleinanzeigen.de/p-anzeige-aufgeben-schritt2.html*
// @match				https://www.kleinanzeigen.de/p-anzeige-bearbeiten.html*
// @icon				https://www.google.com/s2/favicons?sz=64&domain=kleinanzeigen.de
// @grant				GM_setValue
// @grant				GM_getValue
// @grant				GM_deleteValue
// @grant				GM_addStyle
// @run-at				document-idle
// @license				MIT
// @downloadURL			https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Kleinanzeigen%20Toolkit.user.js
// @updateURL			https://raw.githubusercontent.com/1110101/tampermonkey_personal_scripts/main/Kleinanzeigen%20Toolkit.user.js
// ==/UserScript==

(function () {
	'use strict';

	const CONFIG = {
		TEMPLATES_KEY: 'kleinanzeigen_ad_templates',
		IMAGE_DB_NAME: 'KleinanzeigenImageDB',
		IMAGE_STORE_NAME: 'saved_images',
		DB_VERSION: 2
	};

	const STYLES = `
        .tm-manager { margin: 20px 0; padding: 15px; border: 1px solid #ccc; border-radius: 5px; background-color: #f9f9f9; }
        .tm-manager h3 { margin-top: 0; margin-bottom: 10px; }
        .tm-manager p { font-size: 12px; margin: 0; margin-bottom: 10px; }
        .tm-controls > * { margin: 5px; vertical-align: middle; }
        .tm-button { display: inline-block; padding: 8px 12px; border: 1px solid #005663; color: #005663; background-color: white; border-radius: 4px; cursor: pointer; user-select: none; transition: transform 0.1s ease; }
        .tm-button:hover { background-color: #f0f8ff; }
        .tm-button:active { transform: scale(0.97); background-color: #e0f0ff; }
        .tm-button.delete { border-color: #c82333; color: #c82333; }
        .gm-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center; }
        .gm-modal { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); min-width: 350px; z-index: 10002; }
        .gm-modal h3 { margin-top: 0; }
        .gm-modal input { width: 100%; padding: 8px; margin: 10px 0; box-sizing: border-box; }
        .gm-modal-buttons { margin-top: 20px; text-align: right; }
        .gm-modal-buttons button { margin-left: 10px; padding: 8px 15px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; }
        .gm-modal-buttons .confirm { background-color: #005663; color: white; border-color: #005663; }
        .gm-toast { position: fixed; bottom: 20px; right: 20px; background-color: #28a745; color: white; padding: 15px; border-radius: 5px; z-index: 10002; opacity: 0; transition: all 0.5s; font-size: 16px; }
        .tm-image-group { margin-bottom: 15px; }
        .tm-image-group-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
        .tm-image-group-title { font-weight: bold; font-size: 14px; }
        .tm-image-thumbnails { display: flex; flex-wrap: wrap; gap: 10px; }
        .img-thumbnail-wrapper { position: relative; }
        .img-thumbnail { width: 96px; height: 96px; object-fit: cover; border-radius: 4px; cursor: pointer; }
        .img-thumbnail-delete { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background-color: #c82333; color: white; border-radius: 50%; font-size: 16px; text-align: center; line-height: 24px; cursor: pointer; font-weight: bold; border: 2px solid white; display: none; z-index: 1; }
        .img-thumbnail-wrapper:hover .img-thumbnail-delete { display: block; }
        .tm-dialog-button { margin-left: auto !important; margin-right: 10px !important; }
    `;

	// Module for handling IndexedDB and GM storage
	const Storage = {
		getText: () => GM_getValue(CONFIG.TEMPLATES_KEY, {}),
		setText: (templates) => GM_setValue(CONFIG.TEMPLATES_KEY, templates),
		db: null,
		async initDB() {
			if (this.db) {return this.db;}
			return new Promise((resolve, reject) => {
				const request = indexedDB.open(CONFIG.IMAGE_DB_NAME, CONFIG.DB_VERSION);
				request.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(CONFIG.IMAGE_STORE_NAME)) { const store = db.createObjectStore(CONFIG.IMAGE_STORE_NAME, { keyPath: 'id', autoIncrement: true }); store.createIndex('group', 'group', { unique: false }); }};
				request.onsuccess = e => { this.db = e.target.result; resolve(this.db); };
				request.onerror = e => reject(e.target.error);
			});
		},
		async execDB(type, ...args) {
			const db = await this.initDB();
			const transaction = db.transaction(CONFIG.IMAGE_STORE_NAME, type === 'getAll' ? 'readonly' : 'readwrite');
			const request = transaction.objectStore(CONFIG.IMAGE_STORE_NAME)[type](...args);
			return new Promise((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		},
		async deleteByGroup(groupName) {
			const db = await this.initDB();
			const transaction = db.transaction(CONFIG.IMAGE_STORE_NAME, 'readwrite');
			const index = transaction.objectStore(CONFIG.IMAGE_STORE_NAME).index('group');
			const request = index.openKeyCursor(IDBKeyRange.only(groupName));
			request.onsuccess = () => {
				const cursor = request.result;
				if (cursor) { transaction.objectStore(CONFIG.IMAGE_STORE_NAME).delete(cursor.primaryKey); cursor.continue(); }
			};
			return new Promise(resolve => transaction.oncomplete = resolve);
		}
	};

	const escapeHTML = (str) => {
		if (!str) {return '';}
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	};

	// Module for creating UI elements like toasts and modals
	const UI = {
		toast: (message) => {
			const toast = document.createElement('div');
			toast.className = 'gm-toast';
			toast.textContent = message;
			document.body.appendChild(toast);
			setTimeout(() => toast.style.opacity = '1', 10);
			setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
		},
		modal: (html) => new Promise(resolve => {
			const overlay = document.createElement('div');
			overlay.className = 'gm-overlay';
			overlay.innerHTML = `<div class="gm-modal">${html}</div>`;
			const cleanup = (value) => { overlay.remove(); resolve(value); };
			overlay.onclick = e => { if (e.target === overlay) {cleanup(null);} };
			overlay.querySelector('#gm-cancel-btn')?.addEventListener('click', () => cleanup(null));
			overlay.querySelector('#gm-confirm-btn')?.addEventListener('click', () => {
				const input = overlay.querySelector('input');
				cleanup(input ? input.value : true);
			});
			document.body.appendChild(overlay);
			overlay.querySelector('input')?.focus();
		}),
		prompt: (title, val = '') => UI.modal(`<h3>${title}</h3><input type="text" value="${val}"><div class="gm-modal-buttons"><button id="gm-cancel-btn">Abbrechen</button><button id="gm-confirm-btn" class="confirm">OK</button></div>`),
		confirm: (title) => UI.modal(`<h3>${title}</h3><div class="gm-modal-buttons"><button id="gm-cancel-btn">Nein</button><button id="gm-confirm-btn" class="confirm">Ja</button></div>`)
	};

	// Module for interacting with the page's DOM
	const DOM = {
		setFieldValue: (el, val) => {
			if (!el) {return;}
			const prototype = Object.getPrototypeOf(el);
			const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
			if (setter) {
				setter.call(el, val);
			} else {
				el.value = val;
			}
			el.dispatchEvent(new Event('input', { bubbles: true }));
		},
		getFields: () => ({
			title: document.getElementById('postad-title'),
			price: document.getElementById('micro-frontend-price'),
			description: document.getElementById('pstad-descrptn'),
			fileInput: document.querySelector('#plupld input[type="file"]')
		})
	};

	// =========================================================================
	//  APP: The core logic of the script
	// =========================================================================

	const App = {
		Text: {
			async save() {
				const fields = DOM.getFields();
				const currentTitle = fields.title.value;
				const name = await UI.prompt('Name für die Vorlage:', currentTitle);
				if (!name) {return;}
				const templates = Storage.getText();
				templates[name] = { title: currentTitle, price: fields.price.value, description: fields.description.value };
				Storage.setText(templates);
				this.renderDropdown();
				document.getElementById('tm-select').value = name;
				UI.toast('Vorlage gespeichert!');
			},
			load() {
				const select = document.getElementById('tm-select');
				const template = Storage.getText()[select.value];
				if (!template) {return;}
				const fields = DOM.getFields();
				DOM.setFieldValue(fields.title, template.title);
				DOM.setFieldValue(fields.price, template.price);
				DOM.setFieldValue(fields.description, template.description);
				UI.toast('Vorlage geladen!');
			},
			async rename() {
				const select = document.getElementById('tm-select');
				const oldName = select.value;
				if (!Storage.getText()[oldName]) {return;}
				const newName = await UI.prompt('Neuer Name:', oldName);
				if (newName && newName !== oldName) {
					const templates = Storage.getText();
					templates[newName] = templates[oldName];
					delete templates[oldName];
					Storage.setText(templates);
					this.renderDropdown();
					select.value = newName;
					UI.toast('Vorlage umbenannt!');
				}
			},
			async delete() {
				const select = document.getElementById('tm-select');
				const name = select.value;
				if (!Storage.getText()[name]) {return;}
				if (await UI.confirm(`Vorlage "${name}" wirklich löschen?`)) {
					const templates = Storage.getText();
					delete templates[name];
					Storage.setText(templates);
					this.renderDropdown();
					UI.toast('Vorlage gelöscht!');
				}
			},
			renderDropdown() {
				const select = document.getElementById('tm-select');
				const names = Object.keys(Storage.getText()).sort();
				select.innerHTML = names.length ? names.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('') : `<option disabled>Keine Vorlagen</option>`;
			}
		},
		Image: {
			async render() {
				const container = document.getElementById('image-manager-container');
				if (!container) {return;}
				const images = await Storage.execDB('getAll');
				const groups = images.reduce((acc, image) => {
					const group = image.group || 'Unsortierte Bilder';
					(acc[group] = acc[group] || []).push(image);
					return acc;
				}, {});

				let html = `
                    <h3>Gespeicherte Bilder</h3>
                    <p>Klicke auf ein Bild, um es hinzuzufügen. Klicke auf ein hochgeladenes Bild, um es zu bearbeiten und hier zu sichern.</p>`;

				if (Object.keys(groups).length > 0) {
					for (const groupName in groups) {
						const safeGroupName = escapeHTML(groupName); // Escape the group name once
						html += `
                        <div class="tm-image-group">
                            <div class="tm-image-group-header">
                                <span class="tm-image-group-title">${safeGroupName}</span>
                                <span class="tm-button delete" data-action="delete-group" data-group-name="${safeGroupName}">Gruppe löschen</span>
                            </div>
                            <div class="tm-image-thumbnails">
                                ${groups[groupName].map(img => `
                                    <div class="img-thumbnail-wrapper">
                                        <img src="${URL.createObjectURL(img.blob)}" class="img-thumbnail" data-action="add-image" data-img-id="${img.id}">
                                        <span class="img-thumbnail-delete" data-action="delete-image" data-img-id="${img.id}">&times;</span>
                                    </div>`).join('')}
                            </div>
                        </div>`;
					}
				} else {
					html += `<p>Noch keine Bilder gespeichert.</p>`;
				}

				html += `<hr style="margin: 15px 0;"><span class="tm-button" data-action="save-all">Alle hochgeladenen Bilder sichern</span>`;
				container.innerHTML = html;
			},
			async handleEvent(e) {
				const { action } = e.target.dataset;
				if (!action) {return;}

				if (action.startsWith('delete')) {
					const { groupName } = e.target.dataset;
					if (groupName && await UI.confirm(`Gruppe "${groupName}" und alle Bilder darin löschen?`)) {
						await Storage.deleteByGroup(groupName);
						UI.toast(`Gruppe "${groupName}" gelöscht.`);
					} else if (!groupName) {
						await Storage.execDB('delete', parseInt(e.target.dataset.imgId, 10));
					}
					await this.render();
				} else if (action === 'add-image') {
					const id = parseInt(e.target.dataset.imgId, 10);
					const imgData = (await Storage.execDB('getAll')).find(img => img.id === id);
					if (!imgData) {return;}
					UI.toast('Füge Bild hinzu...');
					const { fileInput } = DOM.getFields();
					if (!fileInput) {return UI.toast('Fehler: Upload-Feld nicht gefunden.');}
					const file = new File([imgData.blob], `kleinanzeigen-bild-${Date.now()}.jpg`, { type: 'image/jpeg' });
					const dataTransfer = new DataTransfer();
					dataTransfer.items.add(file);
					fileInput.files = dataTransfer.files;
					fileInput.dispatchEvent(new Event('change', { bubbles: true }));
				} else if (action === 'save-all') {
					this.saveAll(e.target);
				}
			},
			injectSaveButton(imageEl) {
				const saveBtnSpan = Array.from(document.querySelectorAll('#popup-image-edit button span')).find(s => s.textContent === 'Speichern');
				if (!saveBtnSpan) {return;}
				const toolbar = saveBtnSpan.closest('div[class*="Toolbar--Group"]');
				if (!toolbar || toolbar.querySelector('.tm-dialog-button')) {return;}
				const ourButton = document.createElement('button');
				ourButton.className = `${saveBtnSpan.closest('button').className} tm-dialog-button`;
				ourButton.innerHTML = '<span>Für Vorlage sichern</span>';
				ourButton.type = 'button';
				ourButton.onclick = async (e) => {
					e.stopImmediatePropagation();
					UI.toast('Speichere Bild...');
					const adTitle = DOM.getFields().title.value || 'Unbenannte Gruppe';
					const blob = await fetch(imageEl.src).then(res => res.blob());
					await Storage.execDB('add', { group: adTitle, blob });
					await this.render();
					UI.toast('Bild gesichert!');
				};
				toolbar.prepend(ourButton);
			},
			async saveAll(button) {
				const originalText = button.textContent;
				button.style.pointerEvents = 'none'; button.style.opacity = '0.6';
				const editButtons = Array.from(document.querySelectorAll('.pictureupload-thumbnails-edit'));
				if (editButtons.length === 0) { UI.toast('Keine Bilder zum Sichern gefunden.'); button.style.pointerEvents = 'auto'; button.style.opacity = '1'; return; }
				const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
				const waitFor = (selector, scope = document) => new Promise((resolve, reject) => {
					const i = setInterval(() => {
						const el = scope.querySelector(selector); if (el) { clearInterval(i); resolve(el); } }, 100);
					setTimeout(() => { clearInterval(i); reject(); }, 5000);
				});
				for (let i = 0; i < editButtons.length; i++) {
					button.textContent = `Speichere Bild ${i + 1} von ${editButtons.length}...`;
					editButtons[i].click();
					try {
						const dialog = await waitFor('dialog[open]');
						this.injectSaveButton(await waitFor('#image-to-edit', dialog));
						(await waitFor('.tm-dialog-button', dialog)).click();
						await waitFor('.gm-toast');
						(await waitFor('button[aria-label="Schließen"]', dialog)).click();
						await wait(500);
					} catch (error) {
						UI.toast(`Fehler bei Bild ${i + 1}. Überspringe...`);
						const openDialog = document.querySelector('dialog[open]');
						if (openDialog) {openDialog.querySelector('button[aria-label="Schließen"]')?.click();}
						await wait(500);
					}
				}
				button.textContent = originalText;
				button.style.pointerEvents = 'auto'; button.style.opacity = '1';
				UI.toast('Alle Bilder wurden gesichert!');
			}
		}
	};

	// =========================================================================
	//  INITIALIZATION
	// =========================================================================

	function main() {
		// Guard clause: Prevents re-initialization if UI already exists.
		if (document.getElementById('tm-text-manager')) {
			return;
		}

		const textAnchor = document.querySelector('legend.formlegend.headline-medium');
		const imageAnchor = document.querySelector('#pstad-pictureupload');

		// Only proceed if the page anchors are ready.
		if (!textAnchor || !imageAnchor) {
			return;
		}

		console.log('KA Manager: Initializing UI...');
		GM_addStyle(STYLES);

		// --- Text Manager UI ---
		const textManagerNode = document.createElement('div');
		textManagerNode.id = 'tm-text-manager';
		textManagerNode.className = 'tm-manager';
		textManagerNode.innerHTML = `
            <h3>Text-Vorlagen Manager</h3>
            <div class="tm-controls">
                <select id="tm-select" style="min-width:200px; padding: 8px; border-radius: 4px; border: 1px solid #ccc;"></select>
                <span class="tm-button" data-action="load">Laden</span>
                <span class="tm-button" data-action="rename">Umbenennen</span>
                <span class="tm-button delete" data-action="delete">Löschen</span>
            </div>
            <hr style="margin: 10px 0;">
            <div class="tm-controls">
                <span class="tm-button" data-action="save">Aktuellen Entwurf als Vorlage speichern</span>
            </div>`;
		textAnchor.insertAdjacentElement('afterend', textManagerNode);
		textManagerNode.addEventListener('click', e => {
			const { action } = e.target.dataset;
			if (action && App.Text[action]) {App.Text[action]();}
		});

		// --- Image Manager UI ---
		const imageManagerNode = document.createElement('div');
		imageManagerNode.id = 'image-manager-container';
		imageManagerNode.className = 'tm-manager';
		imageAnchor.insertAdjacentElement('beforebegin', imageManagerNode);
		imageManagerNode.addEventListener('click', e => App.Image.handleEvent(e));

		// Initial render of content
		App.Text.renderDropdown();
		App.Image.render();
	}

	// This watcher survives "Turbo-Reloads" and re-initializes the UI if needed.
	setInterval(main, 500);

	// This separate watcher handles the image dialog injection.
	setInterval(() => {
		const dialog = Array.from(document.querySelectorAll('dialog')).find(d => d.querySelector('#image-to-edit') && d.hasAttribute('open'));
		if (dialog && !dialog.querySelector('.tm-dialog-button')) {
			App.Image.injectSaveButton(dialog.querySelector('#image-to-edit'));
		}
	}, 500);

})();
