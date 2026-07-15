// ==UserScript==
// @name         LTOA - Terminer et Dupliquer Tâche
// @namespace    https://github.com/sheana-ltoa
// @version      2.1
// @description  Ajoute un bouton pour terminer une tâche et en créer une nouvelle avec les mêmes infos
// @author       LTOA Assurances
// @match        https://courtage.modulr.fr/*
// @icon         https://courtage.modulr.fr/images/favicons/favicon-32x32.png
// @grant        none
// @updateURL    https://raw.githubusercontent.com/BiggerThanTheMall/terminer-et-dupliquer-tache/raw/main/terminer-et-dupliquer-tache.user.js
// @downloadURL  https://raw.githubusercontent.com/BiggerThanTheMall/terminer-et-dupliquer-tache/raw/main/terminer-et-dupliquer-tache.user.js
// ==/UserScript==

(function () {
    'use strict';

    /******************************************************************
     * CONFIGURATION
     ******************************************************************/

    const STORAGE_KEY = 'ltoa_task_duplicate_data';
    const DEBUG = true;

    let duplicationEnCours = false;
    let remplissageEnCours = false;

    /******************************************************************
     * LOGS
     ******************************************************************/

    function log(...args) {
        if (!DEBUG) return;

        console.log(
            '%c[LTOA DUPLICATION]',
            'background:#0057b8;color:white;font-weight:bold;padding:2px 5px;border-radius:3px;',
            ...args
        );
    }

    function warn(...args) {
        if (!DEBUG) return;
        console.warn('[LTOA DUPLICATION]', ...args);
    }

    function error(...args) {
        console.error('[LTOA DUPLICATION]', ...args);
    }

    function logSeparateur(titre) {
        if (!DEBUG) return;

        console.log('');
        console.log(
            `%c========== ${titre} ==========`,
            'color:#0057b8;font-size:14px;font-weight:bold;'
        );
    }

    /******************************************************************
     * OUTILS
     ******************************************************************/

    function declencherEvenements(element) {
        if (!element) return;

        element.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        element.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );
    }

    function attendre(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /******************************************************************
     * OBSERVATION DE LA PAGE
     ******************************************************************/

    const observer = new MutationObserver(() => {

        /**************************************************************
         * AJOUT DU BOUTON SUR UNE TÂCHE OUVERTE
         **************************************************************/

        const taskContainer = document.querySelector(
            '#task_container[data-task_id], #task_container[data-task-id]'
        );

        if (
            taskContainer &&
            !taskContainer.querySelector('.ltoa-dupliquer-btn')
        ) {
            ajouterBoutonDupliquer(taskContainer);
        }

        /**************************************************************
         * REMPLISSAGE DU NOUVEAU FORMULAIRE
         **************************************************************/

        if (
            localStorage.getItem(STORAGE_KEY) &&
            !remplissageEnCours
        ) {
            const taskName = document.querySelector('#task_name');

            if (
                taskName &&
                taskName.offsetParent !== null
            ) {
                remplirFormulaire();
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    /******************************************************************
     * AJOUT DU BOUTON "TERMINER + DUPLIQUER"
     ******************************************************************/

    function ajouterBoutonDupliquer(taskContainer) {

        const btnBar = taskContainer.querySelector(
            '.bg_silverlight table tbody tr'
        );

        if (!btnBar) return;

        const btnTerminee = btnBar.querySelector(
            'a[data-status="close"]'
        );

        /*
         * Ne pas afficher d'erreur ici :
         * après fermeture de la tâche, le DOM peut être temporairement
         * encore présent sans le bouton "Terminée".
         */
        if (!btnTerminee) return;

        const celluleTerminee = btnTerminee.closest('td');

        if (!celluleTerminee) return;

        /**************************************************************
         * CRÉATION DU BOUTON
         **************************************************************/

        const newCell = document.createElement('td');

        newCell.className =
            'medium_padding align_center four_tenths_width border_thin_silver_right';

        newCell.innerHTML = `
            <a href="#"
               class="preventDefault fa_touch ltoa-dupliquer-btn">
                <span class="fa fa-check-double valign_middle"></span>
                <span class="medium_margin_left valign_middle font_size_higher">
                    Terminer + Dupliquer
                </span>
            </a>
        `;

        celluleTerminee.parentNode.insertBefore(
            newCell,
            celluleTerminee
        );

        const btnDupliquer = newCell.querySelector(
            '.ltoa-dupliquer-btn'
        );

        log('Bouton "Terminer + Dupliquer" ajouté.');

        /**************************************************************
         * CLIC SUR "TERMINER + DUPLIQUER"
         **************************************************************/

        btnDupliquer.addEventListener('click', async (e) => {

            e.preventDefault();
            e.stopPropagation();

            /*
             * Protection contre les doubles clics
             */
            if (duplicationEnCours) {
                warn(
                    'Une duplication est déjà en cours. Double clic ignoré.'
                );
                return;
            }

            duplicationEnCours = true;

            logSeparateur('DÉBUT DUPLICATION');

            try {

                /******************************************************
                 * 1. RÉCUPÉRATION DE LA TÂCHE SOURCE
                 ******************************************************/

                const entityId =
                    taskContainer.dataset.entityId ||
                    taskContainer.getAttribute('data-entity_id') ||
                    taskContainer.getAttribute('data-entity-id') ||
                    '';

                const entityClassName =
                    taskContainer.dataset.entityClassName ||
                    taskContainer.getAttribute('data-entity_class_name') ||
                    taskContainer.getAttribute('data-entity-class-name') ||
                    'Client';

                const taskId =
                    taskContainer.dataset.taskId ||
                    taskContainer.getAttribute('data-task_id') ||
                    taskContainer.getAttribute('data-task-id') ||
                    '';

                const data = {
                    taskId,
                    entityId,
                    entityClassName,
                    libelle:
                        taskContainer
                            .querySelector('h2.no_margin')
                            ?.textContent
                            .trim() || '',
                    description: '',
                    assignee: ''
                };

                /******************************************************
                 * 2. DESCRIPTION
                 ******************************************************/

                const descP = taskContainer.querySelector(
                    'table.table_list tbody tr:nth-child(2) p'
                );

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

                /******************************************************
                 * 3. ASSIGNÉ À
                 ******************************************************/

                taskContainer
                    .querySelectorAll('.task_details label')
                    .forEach(label => {

                        if (
                            label.textContent
                                .trim()
                                .toLowerCase() === 'assignée à'
                        ) {
                            const p = label.closest('p');

                            if (p) {
                                data.assignee = p.textContent
                                    .replace(/Assignée à/i, '')
                                    .trim();
                            }
                        }
                    });

                /******************************************************
                 * LOG DES DONNÉES SOURCE
                 ******************************************************/

                logSeparateur('DONNÉES DE LA TÂCHE SOURCE');

                console.table({
                    taskId: data.taskId,
                    entityId: data.entityId,
                    entityClassName: data.entityClassName,
                    libelle: data.libelle,
                    assignee: data.assignee
                });

                log(
                    'Conteneur source complet :',
                    taskContainer
                );

                log(
                    'Attributs du conteneur :',
                    Array.from(taskContainer.attributes).map(attr => ({
                        nom: attr.name,
                        valeur: attr.value
                    }))
                );

                if (!data.entityId) {
                    throw new Error(
                        'Aucun entityId détecté sur la tâche source.'
                    );
                }

                log(
                    '✅ Entity ID détecté :',
                    data.entityId
                );

                log(
                    '✅ Entity Class détectée :',
                    data.entityClassName
                );

                /******************************************************
                 * 4. SAUVEGARDE TEMPORAIRE
                 ******************************************************/

                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(data)
                );

                log(
                    '✅ Données enregistrées dans localStorage.',
                    data
                );

                /******************************************************
                 * 5. TERMINER LA TÂCHE ACTUELLE
                 ******************************************************/

                logSeparateur('FERMETURE DE LA TÂCHE');

                log(
                    'Bouton "Terminée" utilisé :',
                    {
                        element: btnTerminee,
                        id: btnTerminee.id || '',
                        href: btnTerminee.getAttribute('href'),
                        dataStatus:
                            btnTerminee.getAttribute('data-status')
                    }
                );

                btnTerminee.click();

                /******************************************************
                 * ATTENDRE LA MISE À JOUR DE MODULR
                 ******************************************************/

                await attendre(800);

                /******************************************************
                 * 6. CHERCHER LE BON BOUTON "AJOUTER UNE TÂCHE"
                 ******************************************************/

                logSeparateur(
                    'RECHERCHE DU BOUTON AJOUTER UNE TÂCHE'
                );

                const savedData = JSON.parse(
                    localStorage.getItem(STORAGE_KEY) || '{}'
                );

                const tousLesBoutons = Array.from(
                    document.querySelectorAll(
                        'a.task_manage[id^="task:0:"]'
                    )
                );

                log(
                    `${tousLesBoutons.length} bouton(s) "Ajouter une tâche" trouvé(s).`
                );

                console.table(
                    tousLesBoutons.map((btn, index) => ({
                        index,
                        id: btn.id,
                        href: btn.getAttribute('href'),
                        texte: btn.textContent.trim(),
                        parentId: btn.parentElement?.id || '',
                        visible: btn.offsetParent !== null
                    }))
                );

                /******************************************************
                 * 7. FILTRER LES BOUTONS DU BON CLIENT
                 ******************************************************/

                const boutonsBonClient = tousLesBoutons.filter(btn => {

                    const id = btn.id || '';

                    return (
                        savedData.entityId &&
                        id.includes(
                            `entity_id:${savedData.entityId}`
                        )
                    );
                });

                log(
                    `${boutonsBonClient.length} bouton(s) correspondant au client ${savedData.entityId}.`
                );

                /******************************************************
                 * 8. CHOISIR LE MEILLEUR BOUTON
                 *
                 * PRIORITÉ :
                 *
                 * 1. Bon client + visible + entity_name
                 * 2. Bon client + visible
                 * 3. Bon client + entity_name
                 * 4. Premier bouton du bon client
                 ******************************************************/

                let btnAdd = null;
                let methodeSelection = '';

                /*
                 * PRIORITÉ 1
                 *
                 * Exemple trouvé dans les logs :
                 *
                 * task:0:entity_name:Client:entity_id:6195
                 *
                 * + bouton visible
                 */
                btnAdd = boutonsBonClient.find(btn => {

                    const id = btn.id || '';

                    return (
                        btn.offsetParent !== null &&
                        id.toLowerCase().includes(
                            `entity_name:${String(
                                savedData.entityClassName || 'Client'
                            ).toLowerCase()}`
                        )
                    );
                });

                if (btnAdd) {
                    methodeSelection =
                        'bouton visible + entity_name + bon entityId';
                }

                /*
                 * PRIORITÉ 2
                 *
                 * N'importe quel bouton visible correspondant au bon client
                 */
                if (!btnAdd) {

                    btnAdd = boutonsBonClient.find(
                        btn => btn.offsetParent !== null
                    );

                    if (btnAdd) {
                        methodeSelection =
                            'bouton visible + bon entityId';
                    }
                }

                /*
                 * PRIORITÉ 3
                 *
                 * Bouton entity_name du bon client même s'il est caché
                 */
                if (!btnAdd) {

                    btnAdd = boutonsBonClient.find(btn =>
                        (btn.id || '')
                            .toLowerCase()
                            .includes(
                                `entity_name:${String(
                                    savedData.entityClassName || 'Client'
                                ).toLowerCase()}`
                            )
                    );

                    if (btnAdd) {
                        methodeSelection =
                            'entity_name + bon entityId';
                    }
                }

                /*
                 * PRIORITÉ 4
                 *
                 * Premier bouton correspondant au bon client
                 */
                if (!btnAdd) {

                    btnAdd = boutonsBonClient[0];

                    if (btnAdd) {
                        methodeSelection =
                            'premier bouton correspondant au client';
                    }
                }

                /******************************************************
                 * AUCUN BOUTON DU BON CLIENT
                 ******************************************************/

                if (!btnAdd) {

                    error(
                        '❌ Aucun bouton correspondant au client trouvé.'
                    );

                    console.table({
                        entityIdAttendu:
                            savedData.entityId,

                        entityClassNameAttendue:
                            savedData.entityClassName
                    });

                    /*
                     * On conserve le localStorage pour diagnostic.
                     */
                    duplicationEnCours = false;
                    return;
                }

                /******************************************************
                 * LOG DU BOUTON CHOISI
                 ******************************************************/

                logSeparateur(
                    'BOUTON AJOUTER TÂCHE SÉLECTIONNÉ'
                );

                console.table({
                    entityIdAttendu:
                        savedData.entityId,

                    entityClassNameAttendue:
                        savedData.entityClassName,

                    boutonId:
                        btnAdd.id,

                    boutonHref:
                        btnAdd.getAttribute('href'),

                    boutonTexte:
                        btnAdd.textContent.trim(),

                    boutonVisible:
                        btnAdd.offsetParent !== null,

                    methodeSelection
                });

                log(
                    'Élément bouton complet :',
                    btnAdd
                );

                /******************************************************
                 * VÉRIFICATION DU BOUTON
                 ******************************************************/

                const boutonContientBonEntityId =
                    (btnAdd.id || '').includes(
                        `entity_id:${savedData.entityId}`
                    );

                if (!boutonContientBonEntityId) {

                    error(
                        '❌ Sécurité : le bouton choisi ne correspond pas à l’entityId attendu.'
                    );

                    duplicationEnCours = false;
                    return;
                }

                log(
                    '✅ Le bouton sélectionné contient le bon entityId.'
                );

                if (btnAdd.offsetParent !== null) {
                    log(
                        '✅ Le bouton sélectionné est visible.'
                    );
                } else {
                    warn(
                        '⚠️ Le bouton sélectionné est caché. Aucun meilleur bouton visible n’a été trouvé.'
                    );
                }

                /******************************************************
                 * 9. CLIC SUR AJOUTER UNE TÂCHE
                 ******************************************************/

                log(
                    'Clic sur le bouton "Ajouter une tâche"...'
                );

                btnAdd.click();

                await attendre(500);

                /******************************************************
                 * 10. CHOISIR "AJOUTER UNE TÂCHE"
                 ******************************************************/

                const labelTache = document.querySelector(
                    'label[for="task_mode_from_scratch"]'
                );

                if (!labelTache) {

                    error(
                        '❌ Option "Ajouter une tâche" introuvable.'
                    );

                    duplicationEnCours = false;
                    return;
                }

                log(
                    '✅ Option "Ajouter une tâche" trouvée.',
                    labelTache
                );

                labelTache.click();

                /*
                 * Le MutationObserver détectera ensuite
                 * l'apparition du formulaire #task_name.
                 */

            } catch (err) {

                error(
                    'Erreur pendant la duplication :',
                    err
                );

                duplicationEnCours = false;
            }
        });
    }

    /******************************************************************
     * REMPLISSAGE DU NOUVEAU FORMULAIRE
     ******************************************************************/

    function remplirFormulaire() {

        if (remplissageEnCours) return;

        const savedData = localStorage.getItem(
            STORAGE_KEY
        );

        if (!savedData) return;

        let data;

        try {
            data = JSON.parse(savedData);
        } catch (err) {

            error(
                'Impossible de lire les données sauvegardées.',
                err
            );

            localStorage.removeItem(STORAGE_KEY);

            duplicationEnCours = false;
            remplissageEnCours = false;

            return;
        }

        const inputLibelle = document.querySelector(
            '#task_name'
        );

        /*
         * Vérifie que le vrai formulaire est visible
         */
        if (
            !inputLibelle ||
            inputLibelle.offsetParent === null
        ) {
            return;
        }

        remplissageEnCours = true;

        logSeparateur(
            'REMPLISSAGE DU NOUVEAU FORMULAIRE'
        );

        log(
            'Données à restaurer :',
            data
        );

        /**************************************************************
         * DIAGNOSTIC DU CONTEXTE DE LA TÂCHE
         *
         * On ne modifie rien ici.
         *
         * Le rattachement au client doit être transmis par le bouton :
         *
         * task:0:entity_name:Client:entity_id:XXXX
         **************************************************************/

        const boutonsContexte = Array.from(
            document.querySelectorAll(
                'a.task_manage[id^="task:0:"]'
            )
        ).filter(btn =>
            (btn.id || '').includes(
                `entity_id:${data.entityId}`
            )
        );

        logSeparateur(
            'CONTEXTE CLIENT DU FORMULAIRE'
        );

        console.table(
            boutonsContexte.map((btn, index) => ({
                index,
                id: btn.id,
                visible: btn.offsetParent !== null
            }))
        );

        /**************************************************************
         * LIBELLÉ
         **************************************************************/

        inputLibelle.value =
            data.libelle || '';

        declencherEvenements(
            inputLibelle
        );

        log(
            '✅ Libellé restauré :',
            inputLibelle.value
        );

        /**************************************************************
         * DESCRIPTION
         **************************************************************/

        const textareaDesc = document.querySelector(
            '#task_note'
        );

        if (textareaDesc) {

            textareaDesc.value =
                data.description || '';

            declencherEvenements(
                textareaDesc
            );

            log(
                '✅ Description restaurée.'
            );

        } else {

            warn(
                '⚠️ Champ description #task_note introuvable.'
            );
        }

        /**************************************************************
         * ASSIGNÉ À
         **************************************************************/

        restaurerAssignee(data);

        /**************************************************************
         * VÉRIFICATION FINALE
         **************************************************************/

        setTimeout(() => {

            logSeparateur(
                'ÉTAT FINAL DU FORMULAIRE'
            );

            console.table({
                entityIdAttendu:
                    data.entityId,

                entityClassNameAttendue:
                    data.entityClassName,

                libelle:
                    document.querySelector('#task_name')
                        ?.value || '',

                description:
                    document.querySelector('#task_note')
                        ?.value || '',

                assigneeSelect:
                    document.querySelector('#task_actor')
                        ?.value || ''
            });

            /*
             * On ne cherche plus tous les inputs entity_id de la page,
             * car la fiche client contient naturellement plusieurs
             * champs avec le même ID client.
             *
             * Le contrôle principal est désormais le bouton utilisé
             * pour ouvrir le formulaire.
             */

            log(
                '✅ Formulaire rempli pour le client attendu :',
                data.entityId
            );

            /**********************************************************
             * NETTOYAGE
             **********************************************************/

            localStorage.removeItem(
                STORAGE_KEY
            );

            log(
                '✅ Données temporaires supprimées du localStorage.'
            );

            logSeparateur(
                'FIN DU REMPLISSAGE'
            );

            remplissageEnCours = false;
            duplicationEnCours = false;

        }, 500);
    }

    /******************************************************************
     * RESTAURATION DE L'ASSIGNÉ
     ******************************************************************/

    function restaurerAssignee(data) {

        if (!data.assignee) {

            warn(
                'Aucun assigné à restaurer.'
            );

            return;
        }

        const selectAssignee = document.querySelector(
            '#task_actor'
        );

        if (!selectAssignee) {

            warn(
                '⚠️ Select #task_actor introuvable.'
            );

            return;
        }

        let userValue = null;
        let userName = null;

        const assigneeRecherche =
            data.assignee
                .trim()
                .toLowerCase();

        /**************************************************************
         * CHERCHER L'UTILISATEUR
         **************************************************************/

        for (const opt of selectAssignee.options) {

            const texteOption =
                opt.textContent
                    .trim()
                    .toLowerCase();

            if (
                opt.value.startsWith('user:') &&
                texteOption.includes(
                    assigneeRecherche
                )
            ) {
                userValue =
                    opt.value;

                userName =
                    opt.textContent.trim();

                break;
            }
        }

        if (!userValue) {

            warn(
                '⚠️ Assigné non trouvé dans la liste :',
                data.assignee
            );

            return;
        }

        log(
            'Assigné trouvé :',
            {
                nom:
                    userName,

                valeur:
                    userValue
            }
        );

        /**************************************************************
         * MISE À JOUR DU SELECT RÉEL
         **************************************************************/

        selectAssignee.value =
            userValue;

        declencherEvenements(
            selectAssignee
        );

        /**************************************************************
         * MISE À JOUR DE L'AFFICHAGE MULTIPLE SELECT
         **************************************************************/

        const msParent =
            selectAssignee.nextElementSibling;

        if (
            msParent &&
            msParent.classList.contains(
                'ms-parent'
            )
        ) {

            /**********************************************************
             * TEXTE AFFICHÉ
             **********************************************************/

            const msChoice =
                msParent.querySelector(
                    '.ms-choice'
                );

            const msSpan =
                msChoice?.querySelector(
                    'span'
                );

            if (msSpan) {

                msSpan.textContent =
                    ' ' + userName;

                msChoice.setAttribute(
                    'title',
                    ' ' + userName
                );
            }

            /**********************************************************
             * RADIO CORRESPONDANT
             **********************************************************/

            const radios = Array.from(
                msParent.querySelectorAll(
                    'input[type="radio"]'
                )
            );

            const radio = radios.find(
                r => r.value === userValue
            );

            if (radio) {

                radios.forEach(r => {
                    r.checked = false;
                });

                msParent
                    .querySelectorAll('li')
                    .forEach(li => {
                        li.classList.remove(
                            'selected'
                        );
                    });

                radio.checked = true;

                radio
                    .closest('li')
                    ?.classList.add(
                        'selected'
                    );
            }
        }

        log(
            '✅ Assigné restauré :',
            userName
        );
    }

})();
})();
