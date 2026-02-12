// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      1.9.3.1
// @description  Ajoute un bouton pour terminer une tâche et en créer une nouvelle avec les mêmes infos
// @author       Sheana KRIEF - LTOA Assurances
// @match        https://courtage.modulr.fr/*
// @icon         https://courtage.modulr.fr/images/favicons/favicon-32x32.png
// @grant        none
// @updateURL    https://raw.githubusercontent.com/BiggerThanTheMall/terminer-et-dupliquer-tache/raw/main/terminer-et-dupliquer-tache.user.js
// @downloadURL  https://raw.githubusercontent.com/BiggerThanTheMall/terminer-et-dupliquer-tache/raw/main/terminer-et-dupliquer-tache.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'ltoa_task_duplicate_data';

    const observer = new MutationObserver(() => {
        const taskContainer = document.querySelector('#task_container[data-task_id]');
        if (taskContainer && !taskContainer.querySelector('.ltoa-dupliquer-btn')) {
            ajouterBoutonDupliquer(taskContainer);
        }

        // Si on a des données à remplir et que le formulaire est visible
        if (localStorage.getItem(STORAGE_KEY)) {
            const taskName = document.querySelector('#task_name');
            if (taskName && taskName.offsetParent !== null) {
                remplirFormulaire();
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Attendre qu’un élément existe ET soit visible
    function waitForVisible(selector, timeoutMs = 8000, intervalMs = 100) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                const visible = el && el.offsetParent !== null;
                if (visible) {
                    clearInterval(timer);
                    resolve(el);
                    return;
                }
                if (Date.now() - start > timeoutMs) {
                    clearInterval(timer);
                    reject(new Error('Timeout: ' + selector));
                }
            }, intervalMs);
        });
    }

    // Trouver la cible cliquable pour "Ajouter une tâche"
    function findClickableAddFromScratch() {
        const byFor = document.querySelector('label[for="task_mode_from_scratch"]');
        if (byFor && byFor.offsetParent !== null) return byFor;

        const input = document.querySelector('#task_mode_from_scratch');
        if (input && input.offsetParent !== null) return input;

        const labels = Array.from(document.querySelectorAll('label'));
        const byText = labels.find(l => (l.textContent || '').trim().toLowerCase().includes('ajouter une tâche'));
        if (byText && byText.offsetParent !== null) return byText;

        return null;
    }

    // Ouvrir l’écran de création de tâche de manière fiable
    async function workflowOpenNewTask() {
        const btnAdd = await waitForVisible('a.task_manage[id^="task:0:"]', 8000, 100);
        console.log('[LTOA] Bouton "Ajouter tâche" trouvé, clic...');
        btnAdd.click();

        const start = Date.now();
        while (Date.now() - start < 8000) {
            const clickable = findClickableAddFromScratch();
            if (clickable) {
                console.log('[LTOA] Cible "Ajouter une tâche" trouvée, clic...');
                clickable.click();
                return;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        console.error('[LTOA] Cible "Ajouter une tâche" introuvable après attente');
    }

    function ajouterBoutonDupliquer(taskContainer) {
        const btnBar = taskContainer.querySelector('.bg_silverlight table tbody tr');
        if (!btnBar) return;

        const btnTerminee = btnBar.querySelector('a[data-status="close"]');
        if (!btnTerminee) return;

        const newCell = document.createElement('td');
        newCell.className = 'medium_padding align_center four_tenths_width border_thin_silver_right';
        newCell.innerHTML = `
            <a href="#" class="preventDefault fa_touch ltoa-dupliquer-btn">
                <span class="fa fa-check-double valign_middle"></span><span class="medium_margin_left valign_middle font_size_higher">Terminer + Dupliquer</span>
            </a>
        `;

        btnTerminee.closest('td').parentNode.insertBefore(newCell, btnTerminee.closest('td'));

        newCell.querySelector('.ltoa-dupliquer-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Extraire les données
            const data = {
                entityId: taskContainer.dataset.entity_id,
                entityClassName: taskContainer.dataset.entity_class_name || 'Client',
                libelle: taskContainer.querySelector('h2.no_margin')?.textContent.trim() || '',
                description: '',
                assignee: ''
            };

            // Description - nettoyage des retours à la ligne
            const descP = taskContainer.querySelector('table.table_list tbody tr:nth-child(2) p');
            if (descP) {
                data.description = descP.innerHTML
                    .replace(/\r?\n/g, ' ')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]*>/g, '')
                    .replace(/[ \t]+/g, ' ')
                    .replace(/ ?\n ?/g, '\n')
                    .replace(/\n{2,}/g, '\n\n')
                    .trim();
            }

            // Assignée à
            taskContainer.querySelectorAll('.task_details label').forEach(label => {
                if (label.textContent.trim() === 'Assignée à') {
                    const p = label.closest('p');
                    if (p) {
                        data.assignee = p.textContent.replace('Assignée à', '').trim();
                    }
                }
            });

            console.log('[LTOA] Données:', data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            // Terminer la tâche
            btnTerminee.click();

            // Ouvrir nouvelle tâche de manière robuste (sans setTimeout fixes)
            workflowOpenNewTask().catch(err => {
                console.error('[LTOA] Erreur ouverture nouvelle tâche:', err);
            });
        });
    }

    function remplirFormulaire() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;

        const data = JSON.parse(savedData);
        console.log('[LTOA] Remplissage:', data);

        // Libellé
        const inputLibelle = document.querySelector('#task_name');
        if (inputLibelle) {
            inputLibelle.value = data.libelle;
            inputLibelle.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Description
        const textareaDesc = document.querySelector('#task_note');
        if (textareaDesc) {
            textareaDesc.value = data.description;
            textareaDesc.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Assigné - approche directe
        if (data.assignee) {
            const selectAssignee = document.querySelector('#task_actor');
            if (selectAssignee) {
                // Trouver la bonne valeur user:XX
                let userValue = null;
                let userName = null;
                for (const opt of selectAssignee.options) {
                    if (opt.value.startsWith('user:') &&
                        opt.textContent.trim().toLowerCase().includes(data.assignee.toLowerCase())) {
                        userValue = opt.value;
                        userName = opt.textContent.trim();
                        break;
                    }
                }

                if (userValue) {
                    console.log('[LTOA] Assigné trouvé:', userName, '=', userValue);

                    // Mettre la valeur dans le select caché
                    selectAssignee.value = userValue;

                    // Mettre à jour le bouton du multi-select
                    const msParent = selectAssignee.nextElementSibling;
                    if (msParent && msParent.classList.contains('ms-parent')) {
                        const msChoice = msParent.querySelector('.ms-choice');
                        const msSpan = msChoice?.querySelector('span');
                        if (msSpan) {
                            msSpan.textContent = ' ' + userName;
                            msChoice.setAttribute('title', ' ' + userName);
                        }

                        // Cocher le bon radio dans le dropdown
                        const radio = msParent.querySelector(`input[type="radio"][value="${userValue}"]`);
                        if (radio) {
                            msParent.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
                            msParent.querySelectorAll('li').forEach(li => li.classList.remove('selected'));

                            radio.checked = true;
                            radio.closest('li')?.classList.add('selected');
                        }
                    }

                    console.log('[LTOA] Assigné sélectionné !');
                } else {
                    console.log('[LTOA] Assigné non trouvé:', data.assignee);
                }
            }
        }

        localStorage.removeItem(STORAGE_KEY);
        console.log('[LTOA] Terminé !');
    }

})();
