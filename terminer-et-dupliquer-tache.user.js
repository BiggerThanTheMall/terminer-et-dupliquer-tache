// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      1.8.0
// @description  Ajoute un bouton pour terminer une tâche et en créer une nouvelle avec les mêmes infos
// @author       Sheana KRIEF - LTOA Assurances
// @match        https://courtage.modulr.fr/*
// @icon         https://courtage.modulr.fr/images/favicons/favicon-32x32.png
// @grant        none
// @updateURL    https://github.com/BiggerThanTheMall/terminer-et-dupliquer-tache/raw/main/terminer-et-dupliquer-tache.user.js
// @downloadURL  https://github.com/BiggerThanTheMall/terminer-et-dupliquer-tache/raw/main/terminer-et-dupliquer-tache.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'ltoa_task_duplicate_data';

    // Fonction utilitaire pour attendre qu'un élément apparaisse
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`[LTOA] Timeout: élément "${selector}" non trouvé après ${timeout}ms`));
            }, timeout);
        });
    }

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

        newCell.querySelector('.ltoa-dupliquer-btn').addEventListener('click', async (e) => {
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

            // Description - nettoyage amélioré des retours à la ligne
            const descP = taskContainer.querySelector('table.table_list tbody tr:nth-child(2) p');
            if (descP) {
                data.description = descP.innerHTML
                    .replace(/<br\s*\/?>/gi, '\n')  // <br> → saut de ligne
                    .replace(/<[^>]*>/g, '')         // Supprimer autres balises HTML
                    .replace(/\n{3,}/g, '\n\n')      // Max 2 sauts de ligne consécutifs
                    .replace(/^\s+|\s+$/g, '')       // Trim début/fin
                    .replace(/[ \t]+\n/g, '\n')      // Espaces avant saut de ligne
                    .replace(/\n[ \t]+/g, '\n');     // Espaces après saut de ligne
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

            console.log('[LTOA] Données extraites:', data);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            // Terminer la tâche
            console.log('[LTOA] Clic sur Terminer...');
            btnTerminee.click();

            // Attendre et ouvrir nouvelle tâche
            try {
                console.log('[LTOA] Attente du bouton "Ajouter tâche"...');
                const btnAdd = await waitForElement('a.task_manage[id^="task:0:"]', 3000);
                console.log('[LTOA] Bouton trouvé, clic...');
                btnAdd.click();

                console.log('[LTOA] Attente du label "Ajouter une tâche"...');
                const labelTache = await waitForElement('label[for="task_mode_from_scratch"]', 3000);
                console.log('[LTOA] Label trouvé, clic...');
                labelTache.click();

                console.log('[LTOA] Formulaire ouvert, remplissage en cours...');
            } catch (error) {
                console.error(error.message);
                alert('Erreur lors de la duplication. Vérifiez la console (F12) pour plus de détails.');
            }
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
                // 1. Trouver la bonne valeur user:XX
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
                    
                    // 2. Mettre la valeur dans le select caché
                    selectAssignee.value = userValue;
                    
                    // 3. Trouver le ms-parent associé et mettre à jour le bouton
                    const msParent = selectAssignee.nextElementSibling;
                    if (msParent && msParent.classList.contains('ms-parent')) {
                        const msChoice = msParent.querySelector('.ms-choice');
                        const msSpan = msChoice?.querySelector('span');
                        if (msSpan) {
                            msSpan.textContent = ' ' + userName;
                            msChoice.setAttribute('title', ' ' + userName);
                        }
                        
                        // 4. Cocher le bon radio dans le dropdown
                        const radio = msParent.querySelector(`input[type="radio"][value="${userValue}"]`);
                        if (radio) {
                            // Décocher tous les autres
                            msParent.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
                            msParent.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
                            
                            // Cocher celui-ci
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
