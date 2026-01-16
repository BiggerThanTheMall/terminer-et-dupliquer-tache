// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      1.4.0
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

    // Observer pour détecter les modales
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    // Modale de visualisation de tâche existante
                    const taskContainer = node.querySelector?.('#task_container') || 
                                         (node.id === 'task_container' ? node : null);
                    if (taskContainer && taskContainer.dataset.task_id) {
                        setTimeout(() => ajouterBoutonDupliquer(taskContainer), 100);
                    }
                }
            });
        });
        
        // Vérifier si on a des données à pré-remplir et si le formulaire est visible
        if (localStorage.getItem(STORAGE_KEY)) {
            const labelTache = document.querySelector('label[for="task_mode_from_scratch"]');
            if (labelTache && labelTache.offsetParent !== null) {
                setTimeout(() => selectionnerEtRemplir(), 300);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Vérification initiale
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

        // Cliquer sur "Tâche terminée"
        const btnTerminee = taskContainer.querySelector('a[data-status="close"]');
        if (btnTerminee) {
            btnTerminee.click();
            
            // Attendre puis ouvrir la création de tâche
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

        // Libellé (titre h2)
        const h2 = taskContainer.querySelector('h2.no_margin');
        if (h2) {
            data.libelle = h2.textContent.trim();
        }

        // Description (paragraphe dans la 2e ligne du tableau)
        const descP = taskContainer.querySelector('table.table_list tbody tr:nth-child(2) p');
        if (descP) {
            // Convertir les <br> en retours à la ligne
            let desc = descP.innerHTML;
            desc = desc.replace(/<br\s*\/?>/gi, '\n');
            // Retirer les autres balises HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = desc;
            data.description = tempDiv.textContent || tempDiv.innerText || '';
        }

        // Assignée à - chercher le label et prendre le texte après
        const labels = taskContainer.querySelectorAll('.task_details label');
        labels.forEach(label => {
            if (label.textContent.trim() === 'Assignée à') {
                const parent = label.closest('p');
                if (parent) {
                    // Prendre tout le texte sauf le label
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
            // Attendre que la modale s'ouvre
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

        // 1. Cliquer sur "Ajouter une tâche"
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

        // 2. Attendre que les champs apparaissent puis les remplir
        setTimeout(() => {
            remplirChamps(data);
        }, 500);
    }

    function remplirChamps(data) {
        console.log('[LTOA] Remplissage des champs...');

        // Libellé - #task_name
        const inputLibelle = document.querySelector('#task_name');
        if (inputLibelle && data.libelle) {
            inputLibelle.value = data.libelle;
            inputLibelle.dispatchEvent(new Event('input', { bubbles: true }));
            inputLibelle.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[LTOA] Libellé rempli:', data.libelle);
        }

        // Description - #task_note
        const textareaDesc = document.querySelector('#task_note');
        if (textareaDesc && data.description) {
            textareaDesc.value = data.description;
            textareaDesc.dispatchEvent(new Event('input', { bubbles: true }));
            textareaDesc.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[LTOA] Description remplie');
        }

        // Assigné - via multipleSelect (cliquer sur le radio dans le dropdown)
        if (data.assignee) {
            selectionnerAssigne(data.assignee);
        }

        // Nettoyer le localStorage
        localStorage.removeItem(STORAGE_KEY);
        console.log('[LTOA] Terminé !');
    }

    function selectionnerAssigne(assigneeName) {
        console.log('[LTOA] Recherche assigné:', assigneeName);
        
        // Chercher dans les labels du multipleSelect pour task_actors_list_id
        const allLabels = document.querySelectorAll('label.ms-label[title]');
        
        for (const label of allLabels) {
            const title = label.getAttribute('title') || '';
            const labelText = label.textContent.trim();
            
            // Vérifier si c'est un match (insensible à la casse)
            if (title.toLowerCase().includes(assigneeName.toLowerCase()) ||
                assigneeName.toLowerCase().includes(title.toLowerCase()) ||
                labelText.toLowerCase().includes(assigneeName.toLowerCase())) {
                
                // Vérifier que c'est bien un radio pour l'assigné (contient "user:")
                const radio = label.querySelector('input[type="radio"]');
                if (radio && radio.value && radio.value.startsWith('user:')) {
                    console.log('[LTOA] Trouvé assigné:', title, '=', radio.value);
                    
                    // Cocher le radio
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Cliquer sur le label pour déclencher multipleSelect
                    label.click();
                    
                    // Mettre aussi à jour le select caché
                    const selectAssignee = document.querySelector('#task_actor');
                    if (selectAssignee) {
                        selectAssignee.value = radio.value;
                        selectAssignee.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    console.log('[LTOA] Assigné sélectionné !');
                    return;
                }
            }
        }
        
        console.log('[LTOA] Assigné non trouvé:', assigneeName);
    }

})();
