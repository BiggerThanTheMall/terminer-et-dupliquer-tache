// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      1.0.0
// @description  Ajoute un bouton pour terminer une tâche et en créer une nouvelle avec les mêmes infos
// @author       Sheana KRIEF - LTOA Assurances
// @match        https://courtage.modulr.fr/*
// @icon         https://courtage.modulr.fr/images/favicons/favicon-32x32.png
// @grant        none
// @updateURL    https://github.com/sheana-ltoa/tampermonkey-scripts/raw/main/ltoa-terminer-dupliquer-tache.user.js
// @downloadURL  https://github.com/sheana-ltoa/tampermonkey-scripts/raw/main/ltoa-terminer-dupliquer-tache.user.js
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'ltoa_task_duplicate_data';

    // Style du bouton
    const style = document.createElement('style');
    style.textContent = `
        .ltoa-dupliquer-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(145deg, #28a745 0%, #1e7e34 100%);
            color: white !important;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none !important;
        }
        .ltoa-dupliquer-btn:hover {
            background: linear-gradient(145deg, #2dbe4e 0%, #28a745 100%);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(40, 167, 69, 0.4);
        }
        .ltoa-dupliquer-btn .fa {
            font-size: 14px;
        }
    `;
    document.head.appendChild(style);

    // Observer pour détecter l'ouverture de la modale de tâche
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    // Vérifier si c'est une modale de visualisation de tâche
                    const taskContainer = node.querySelector?.('#task_container') || 
                                         (node.id === 'task_container' ? node : null);
                    if (taskContainer && taskContainer.dataset.task_id) {
                        setTimeout(() => ajouterBoutonDupliquer(taskContainer), 100);
                    }
                    
                    // Vérifier si c'est le formulaire de création/édition de tâche
                    const taskForm = node.querySelector?.('form[data-callback="Modulr.Task.Save"]') ||
                                    node.querySelector?.('#task_form');
                    if (taskForm) {
                        setTimeout(() => preRemplirFormulaire(), 200);
                    }
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Vérification initiale au cas où la modale est déjà ouverte
    setTimeout(() => {
        const taskContainer = document.querySelector('#task_container[data-task_id]');
        if (taskContainer) {
            ajouterBoutonDupliquer(taskContainer);
        }
        // Vérifier aussi s'il faut pré-remplir
        preRemplirFormulaire();
    }, 500);

    function ajouterBoutonDupliquer(taskContainer) {
        // Ne pas ajouter si déjà présent
        if (taskContainer.querySelector('.ltoa-dupliquer-btn')) return;

        // Trouver la barre de boutons en bas
        const btnBar = taskContainer.querySelector('.bg_silverlight table tbody tr');
        if (!btnBar) return;

        // Trouver le bouton "Tâche terminée"
        const btnTerminee = btnBar.querySelector('a[data-status="close"]');
        if (!btnTerminee) return;

        // Créer la nouvelle cellule avec notre bouton
        const newCell = document.createElement('td');
        newCell.className = 'medium_padding align_center four_tenths_width border_thin_silver_right';
        newCell.innerHTML = `
            <a href="#" class="preventDefault fa_touch ltoa-dupliquer-btn">
                <span class="fa fa-copy valign_middle"></span>
                <span class="valign_middle font_size_higher">Terminer + Dupliquer</span>
            </a>
        `;

        // Insérer avant le bouton "Tâche terminée"
        const cellTerminee = btnTerminee.closest('td');
        cellTerminee.parentNode.insertBefore(newCell, cellTerminee);

        // Ajouter l'événement click
        const btnDupliquer = newCell.querySelector('.ltoa-dupliquer-btn');
        btnDupliquer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            terminerEtDupliquer(taskContainer);
        });
    }

    function terminerEtDupliquer(taskContainer) {
        // 1. Récupérer les données de la tâche
        const taskData = extraireDonneesTache(taskContainer);
        
        if (!taskData.libelle) {
            alert('Impossible de récupérer les données de la tâche');
            return;
        }

        // 2. Sauvegarder pour le pré-remplissage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(taskData));
        console.log('[LTOA] Données sauvegardées:', taskData);

        // 3. Cliquer sur "Tâche terminée"
        const btnTerminee = taskContainer.querySelector('a[data-status="close"]');
        if (btnTerminee) {
            console.log('[LTOA] Clic sur Tâche terminée...');
            btnTerminee.click();
            
            // 4. Attendre que la modale se ferme puis ouvrir la création
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
            assignee: '',
            assigneeId: ''
        };

        // Libellé (titre)
        const h2 = taskContainer.querySelector('h2.no_margin');
        if (h2) {
            data.libelle = h2.textContent.trim();
        }

        // Description
        const descP = taskContainer.querySelector('table.table_list tr:nth-child(2) p, table.table_list tbody tr + tr p');
        if (descP) {
            // Garder le HTML pour préserver les retours à la ligne
            data.description = descP.innerHTML.trim();
        }

        // Assignée à - chercher dans les détails
        const labels = taskContainer.querySelectorAll('.task_details label');
        labels.forEach(label => {
            if (label.textContent.includes('Assignée à')) {
                const parent = label.closest('p');
                if (parent) {
                    // Le texte après le label
                    const fullText = parent.textContent;
                    data.assignee = fullText.replace('Assignée à', '').trim();
                }
            }
        });

        console.log('[LTOA] Données extraites:', data);
        return data;
    }

    function ouvrirNouveauTask(entityId, entityClassName) {
        // Chercher le bouton "+" pour créer une nouvelle tâche
        const btnAdd = document.querySelector(`a.task_manage[id^="task:0:"]`);
        
        if (btnAdd) {
            console.log('[LTOA] Ouverture formulaire nouvelle tâche...');
            btnAdd.click();
        } else {
            // Fallback: construire l'ID et simuler le clic via Modulr
            const taskManageId = `task:0:class_name:${entityClassName}:entity_id:${entityId}`;
            console.log('[LTOA] Tentative avec ID:', taskManageId);
            
            // Essayer d'appeler directement la fonction Modulr si disponible
            if (typeof Modulr !== 'undefined' && Modulr.Task && Modulr.Task.Manage) {
                Modulr.Task.Manage(0, entityClassName, entityId);
            } else {
                // Dernier recours: chercher n'importe quel bouton d'ajout de tâche
                const anyAddBtn = document.querySelector('a.task_manage[id*="task:0"]');
                if (anyAddBtn) anyAddBtn.click();
            }
        }
    }

    function preRemplirFormulaire() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;

        const data = JSON.parse(savedData);
        console.log('[LTOA] Pré-remplissage avec:', data);

        // Chercher les champs du formulaire
        // Le libellé
        const inputLibelle = document.querySelector('input[name="task_label"], input[name="label"], #task_label');
        if (inputLibelle && data.libelle) {
            inputLibelle.value = data.libelle;
            inputLibelle.dispatchEvent(new Event('input', { bubbles: true }));
            inputLibelle.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // La description (peut être un textarea ou un éditeur TinyMCE)
        const textareaDesc = document.querySelector('textarea[name="task_content"], textarea[name="content"], #task_content');
        if (textareaDesc && data.description) {
            // Convertir HTML en texte pour textarea simple
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data.description;
            textareaDesc.value = tempDiv.textContent || tempDiv.innerText;
            textareaDesc.dispatchEvent(new Event('input', { bubbles: true }));
            textareaDesc.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // TinyMCE (si utilisé)
        setTimeout(() => {
            if (typeof tinymce !== 'undefined' && tinymce.activeEditor) {
                tinymce.activeEditor.setContent(data.description || '');
            }
        }, 500);

        // L'assigné (select)
        const selectAssignee = document.querySelector('select[name="task_user_id"], select[name="user_id"], #task_user_id');
        if (selectAssignee && data.assignee) {
            // Trouver l'option qui correspond
            const options = selectAssignee.querySelectorAll('option');
            options.forEach(opt => {
                if (opt.textContent.trim().toLowerCase().includes(data.assignee.toLowerCase()) ||
                    data.assignee.toLowerCase().includes(opt.textContent.trim().toLowerCase())) {
                    selectAssignee.value = opt.value;
                    selectAssignee.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            
            // Pour les select custom (multiple-select)
            setTimeout(() => {
                const msParent = selectAssignee.closest('.ms-parent') || 
                               selectAssignee.nextElementSibling;
                if (msParent && msParent.classList.contains('ms-parent')) {
                    // Déclencher mise à jour visuelle
                    $(selectAssignee).multipleSelect('refresh');
                }
            }, 100);
        }

        // Nettoyer après utilisation
        localStorage.removeItem(STORAGE_KEY);
        console.log('[LTOA] Formulaire pré-rempli, données nettoyées');
    }

})();
