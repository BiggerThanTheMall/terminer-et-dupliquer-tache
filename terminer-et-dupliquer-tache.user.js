// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      1.6.0
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

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const taskContainer = node.querySelector?.('#task_container') || 
                                         (node.id === 'task_container' ? node : null);
                    if (taskContainer && taskContainer.dataset.task_id) {
                        setTimeout(() => ajouterBoutonDupliquer(taskContainer), 100);
                    }
                }
            });
        });
        
        if (localStorage.getItem(STORAGE_KEY)) {
            const labelTache = document.querySelector('label[for="task_mode_from_scratch"]');
            if (labelTache && labelTache.offsetParent !== null) {
                setTimeout(() => selectionnerEtRemplir(), 300);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        const taskContainer = document.querySelector('#task_container[data-task_id]');
        if (taskContainer) {
            ajouterBoutonDupliquer(taskContainer);
        }
        if (localStorage.getItem(STORAGE_KEY)) {
            selectionnerEtRemplir();
        }
    }, 500);

    function ajouterBoutonDupliquer(taskContainer) {
        if (taskContainer.querySelector('.ltoa-dupliquer-btn')) return;

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

        const cellTerminee = btnTerminee.closest('td');
        cellTerminee.parentNode.insertBefore(newCell, cellTerminee);

        const btnDupliquer = newCell.querySelector('.ltoa-dupliquer-btn');
        btnDupliquer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            terminerEtDupliquer(taskContainer);
        });
    }

    function terminerEtDupliquer(taskContainer) {
        const taskData = extraireDonneesTache(taskContainer);
        
        if (!taskData.libelle) {
            alert('Impossible de récupérer les données de la tâche');
            return;
        }

        console.log('[LTOA] Données extraites:', taskData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(taskData));

        const btnTerminee = taskContainer.querySelector('a[data-status="close"]');
        if (btnTerminee) {
            btnTerminee.click();
            
            setTimeout(() => {
                ouvrirNouveauTask(taskData.entityId, taskData.entityClassName);
            }, 800);
        }
    }

    function extraireDonneesTache(taskContainer) {
        const data = {
            taskId: taskContainer.dataset.task_id,
            entityId: taskContainer.dataset.entity_id,
            entityClassName: taskContainer.dataset.entity_class_name || 'Client',
            libelle: '',
            description: '',
            assignee: ''
        };

        const h2 = taskContainer.querySelector('h2.no_margin');
        if (h2) {
            data.libelle = h2.textContent.trim();
        }

        const descP = taskContainer.querySelector('table.table_list tbody tr:nth-child(2) p');
        if (descP) {
            let desc = descP.innerHTML;
            desc = desc.replace(/<br\s*\/?>/gi, '\n');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = desc;
            data.description = tempDiv.textContent || tempDiv.innerText || '';
        }

        const labels = taskContainer.querySelectorAll('.task_details label');
        labels.forEach(label => {
            if (label.textContent.trim() === 'Assignée à') {
                const parent = label.closest('p');
                if (parent) {
                    const clone = parent.cloneNode(true);
                    const labelInClone = clone.querySelector('label');
                    if (labelInClone) labelInClone.remove();
                    data.assignee = clone.textContent.trim();
                }
            }
        });

        return data;
    }

    function ouvrirNouveauTask(entityId, entityClassName) {
        const btnAdd = document.querySelector('a.task_manage[id^="task:0:"]');
        
        if (btnAdd) {
            btnAdd.click();
            setTimeout(() => selectionnerEtRemplir(), 600);
        } else {
            if (typeof Modulr !== 'undefined' && Modulr.Task && Modulr.Task.Manage) {
                Modulr.Task.Manage(0, entityClassName, entityId);
                setTimeout(() => selectionnerEtRemplir(), 600);
            }
        }
    }

    function selectionnerEtRemplir() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;

        const data = JSON.parse(savedData);
        console.log('[LTOA] Pré-remplissage avec:', data);

        const labelTache = document.querySelector('label[for="task_mode_from_scratch"]');
        const radioTache = document.querySelector('#task_mode_from_scratch');
        
        if (labelTache) {
            labelTache.click();
            console.log('[LTOA] Cliqué sur Ajouter une tâche');
        }
        if (radioTache) {
            radioTache.checked = true;
            radioTache.dispatchEvent(new Event('change', { bubbles: true }));
        }

        setTimeout(() => {
            remplirChamps(data);
        }, 500);
    }

    function remplirChamps(data) {
        console.log('[LTOA] Remplissage des champs...');

        // Libellé
        const inputLibelle = document.querySelector('#task_name');
        if (inputLibelle && data.libelle) {
            inputLibelle.value = data.libelle;
            inputLibelle.dispatchEvent(new Event('input', { bubbles: true }));
            inputLibelle.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[LTOA] Libellé rempli:', data.libelle);
        }

        // Description
        const textareaDesc = document.querySelector('#task_note');
        if (textareaDesc && data.description) {
            textareaDesc.value = data.description;
            textareaDesc.dispatchEvent(new Event('input', { bubbles: true }));
            textareaDesc.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[LTOA] Description remplie');
        }

        // Assigné
        if (data.assignee) {
            selectionnerAssigne(data.assignee);
        }

        localStorage.removeItem(STORAGE_KEY);
        console.log('[LTOA] Terminé !');
    }

    function selectionnerAssigne(assigneeName) {
        console.log('[LTOA] Recherche assigné:', assigneeName);
        
        // Trouver la valeur user:XX correspondant au nom dans le select caché
        const selectAssignee = document.querySelector('#task_actor');
        if (!selectAssignee) {
            console.log('[LTOA] Select #task_actor non trouvé');
            return;
        }

        let userValue = null;
        const options = selectAssignee.querySelectorAll('option');
        
        for (const opt of options) {
            const optText = opt.textContent.trim().toLowerCase();
            const assigneeText = assigneeName.toLowerCase();
            
            // Match si le nom correspond (insensible à la casse)
            if (opt.value.startsWith('user:') && 
                (optText === assigneeText || 
                 optText.includes(assigneeText) || 
                 assigneeText.includes(optText))) {
                userValue = opt.value;
                console.log('[LTOA] Trouvé:', opt.textContent.trim(), '=', userValue);
                break;
            }
        }

        if (!userValue) {
            console.log('[LTOA] Assigné non trouvé dans les options:', assigneeName);
            return;
        }

        // Utiliser l'API jQuery multipleSelect pour sélectionner
        try {
            // Méthode 1: setSelects
            $('#task_actor').multipleSelect('setSelects', [userValue]);
            console.log('[LTOA] multipleSelect setSelects OK');
        } catch(e) {
            console.log('[LTOA] Erreur setSelects:', e);
            
            // Méthode 2: Fallback - set value + trigger change
            try {
                selectAssignee.value = userValue;
                $(selectAssignee).trigger('change');
                $('#task_actor').multipleSelect('refresh');
                console.log('[LTOA] Fallback refresh OK');
            } catch(e2) {
                console.log('[LTOA] Erreur fallback:', e2);
            }
        }
    }

})();
