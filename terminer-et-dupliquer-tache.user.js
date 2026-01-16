// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      1.1.0
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

    // Observer pour détecter l'ouverture de la modale de tâche
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const taskContainer = node.querySelector?.('#task_container') || 
                                         (node.id === 'task_container' ? node : null);
                    if (taskContainer && taskContainer.dataset.task_id) {
                        setTimeout(() => ajouterBoutonDupliquer(taskContainer), 100);
                    }
                    
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

    setTimeout(() => {
        const taskContainer = document.querySelector('#task_container[data-task_id]');
        if (taskContainer) {
            ajouterBoutonDupliquer(taskContainer);
        }
        preRemplirFormulaire();
    }, 500);

    function ajouterBoutonDupliquer(taskContainer) {
        if (taskContainer.querySelector('.ltoa-dupliquer-btn')) return;

        const btnBar = taskContainer.querySelector('.bg_silverlight table tbody tr');
        if (!btnBar) return;

        const btnTerminee = btnBar.querySelector('a[data-status="close"]');
        if (!btnTerminee) return;

        // Même style que les autres boutons Modulr
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
            assignee: '',
            assigneeId: ''
        };

        const h2 = taskContainer.querySelector('h2.no_margin');
        if (h2) {
            data.libelle = h2.textContent.trim();
        }

        const descP = taskContainer.querySelector('table.table_list tr:nth-child(2) p, table.table_list tbody tr + tr p');
        if (descP) {
            data.description = descP.innerHTML.trim();
        }

        const labels = taskContainer.querySelectorAll('.task_details label');
        labels.forEach(label => {
            if (label.textContent.includes('Assignée à')) {
                const parent = label.closest('p');
                if (parent) {
                    const fullText = parent.textContent;
                    data.assignee = fullText.replace('Assignée à', '').trim();
                }
            }
        });

        return data;
    }

    function ouvrirNouveauTask(entityId, entityClassName) {
        const btnAdd = document.querySelector(`a.task_manage[id^="task:0:"]`);
        
        if (btnAdd) {
            btnAdd.click();
        } else {
            if (typeof Modulr !== 'undefined' && Modulr.Task && Modulr.Task.Manage) {
                Modulr.Task.Manage(0, entityClassName, entityId);
            } else {
                const anyAddBtn = document.querySelector('a.task_manage[id*="task:0"]');
                if (anyAddBtn) anyAddBtn.click();
            }
        }
    }

    function preRemplirFormulaire() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;

        const data = JSON.parse(savedData);

        const inputLibelle = document.querySelector('input[name="task_label"], input[name="label"], #task_label');
        if (inputLibelle && data.libelle) {
            inputLibelle.value = data.libelle;
            inputLibelle.dispatchEvent(new Event('input', { bubbles: true }));
            inputLibelle.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const textareaDesc = document.querySelector('textarea[name="task_content"], textarea[name="content"], #task_content');
        if (textareaDesc && data.description) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data.description;
            textareaDesc.value = tempDiv.textContent || tempDiv.innerText;
            textareaDesc.dispatchEvent(new Event('input', { bubbles: true }));
            textareaDesc.dispatchEvent(new Event('change', { bubbles: true }));
        }

        setTimeout(() => {
            if (typeof tinymce !== 'undefined' && tinymce.activeEditor) {
                tinymce.activeEditor.setContent(data.description || '');
            }
        }, 500);

        const selectAssignee = document.querySelector('select[name="task_user_id"], select[name="user_id"], #task_user_id');
        if (selectAssignee && data.assignee) {
            const options = selectAssignee.querySelectorAll('option');
            options.forEach(opt => {
                if (opt.textContent.trim().toLowerCase().includes(data.assignee.toLowerCase()) ||
                    data.assignee.toLowerCase().includes(opt.textContent.trim().toLowerCase())) {
                    selectAssignee.value = opt.value;
                    selectAssignee.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            
            setTimeout(() => {
                if (typeof $ !== 'undefined' && $(selectAssignee).multipleSelect) {
                    $(selectAssignee).multipleSelect('refresh');
                }
            }, 100);
        }

        localStorage.removeItem(STORAGE_KEY);
    }

})();
