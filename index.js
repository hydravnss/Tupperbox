import {
    extension_settings,
} from '../../../extensions.js';

import {
    setUserAvatar,
    getUserAvatars,
} from '../../../personas.js';

import {
    sendTextareaMessage,
} from '../../../script.js';


const extensionName = 'TupperPersona';


const defaultSettings = {
    enabled: true,
};


let isProcessing = false;


/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {

    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }

    if (
        typeof extension_settings[extensionName].enabled
        !== 'boolean'
    ) {
        extension_settings[extensionName].enabled =
            defaultSettings.enabled;
    }
}


/* =========================================================
   PERSONA LIST
   ========================================================= */

/**
 * Récupère les Personas disponibles depuis SillyTavern.
 *
 * getUserAvatars(false) retourne les IDs des avatars
 * Persona actuellement disponibles.
 */
async function getPersonaList() {

    try {

        const avatars =
            await getUserAvatars(false);

        if (!Array.isArray(avatars)) {
            return [];
        }

        return avatars;

    } catch (error) {

        console.error(
            '[TupperPersona] Impossible de récupérer les Personas:',
            error
        );

        return [];
    }
}


/**
 * Trouve l'avatar correspondant au nom d'une Persona.
 */
async function findPersonaByName(name) {

    const target =
        String(name)
            .trim()
            .toLowerCase();

    if (!target) {
        return null;
    }


    const avatars =
        await getPersonaList();


    for (const avatarId of avatars) {

        /*
         * Le nom d'une Persona est stocké dans
         * l'attribut data-name du sélecteur Persona.
         */
        const personaElement =
            document.querySelector(
                `[data-avatar-id="${CSS.escape(avatarId)}"]`
            );


        const personaName =
            personaElement
                ?.querySelector('.ch_name')
                ?.textContent
                ?.trim();


        if (
            personaName &&
            personaName.toLowerCase() === target
        ) {
            return avatarId;
        }
    }


    /*
     * Fallback :
     *
     * SillyTavern conserve également les noms
     * dans ses données internes.
     */
    const personaElements =
        document.querySelectorAll(
            '#user_avatar_block [data-avatar-id]'
        );


    for (const element of personaElements) {

        const avatarId =
            element.getAttribute(
                'data-avatar-id'
            );


        const personaName =
            element
                .querySelector('.ch_name')
                ?.textContent
                ?.trim();


        if (
            avatarId &&
            personaName &&
            personaName.toLowerCase() === target
        ) {
            return avatarId;
        }
    }


    return null;
}


/* =========================================================
   PARSE TUPPER
   ========================================================= */

/**
 * Reconnaît :
 *
 * Nom: message
 *
 * Exemple :
 *
 * Hagen: Bonjour
 */
function parseTupper(text) {

    if (!text) {
        return null;
    }


    const match =
        text.match(
            /^([^:\n]{1,40}):\s*([\s\S]*)$/
        );


    if (!match) {
        return null;
    }


    const personaName =
        match[1].trim();

    const message =
        match[2].trim();


    if (
        !personaName ||
        !message
    ) {
        return null;
    }


    return {
        personaName,
        message,
    };
}


/* =========================================================
   PROCESS MESSAGE
   ========================================================= */

async function processTupperMessage() {

    if (
        !extension_settings[
            extensionName
        ]?.enabled
    ) {
        return false;
    }


    if (isProcessing) {
        return true;
    }


    const textarea =
        document.getElementById(
            'send_textarea'
        );


    if (!textarea) {
        return false;
    }


    const originalText =
        textarea.value.trim();


    if (!originalText) {
        return false;
    }


    const parsed =
        parseTupper(
            originalText
        );


    /*
     * Message normal.
     *
     * On laisse SillyTavern
     * s'en occuper.
     */
    if (!parsed) {
        return false;
    }


    const avatarId =
        await findPersonaByName(
            parsed.personaName
        );


    /*
     * Persona inconnue.
     *
     * On laisse également
     * SillyTavern fonctionner normalement.
     */
    if (!avatarId) {

        console.log(
            `[TupperPersona] Persona inconnue: ${parsed.personaName}`
        );

        return false;
    }


    isProcessing = true;


    try {

        console.log(
            `[TupperPersona] Persona trouvée: ${parsed.personaName}`
        );


        /* -------------------------------------------------
           CHANGE PERSONA
           ------------------------------------------------- */

        await setUserAvatar(
            avatarId,
            {
                toastPersonaNameChange: true,
            }
        );


        /* -------------------------------------------------
           REMOVE TUPPER PREFIX
           ------------------------------------------------- */

        textarea.value =
            parsed.message;


        textarea.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles: true,
                }
            )
        );


        /* -------------------------------------------------
           SEND
           ------------------------------------------------- */

        await sendTextareaMessage();


        console.log(
            `[TupperPersona] Message envoyé avec ${parsed.personaName}`
        );


        return true;

    } catch (error) {

        console.error(
            '[TupperPersona] Erreur pendant l'envoi:',
            error
        );


        /*
         * Restaure le message si quelque chose
         * s'est mal passé.
         */
        textarea.value =
            originalText;


        textarea.dispatchEvent(
            new Event(
                'input',
                {
                    bubbles: true,
                }
            )
        );


        return true;

    } finally {

        isProcessing = false;
    }
}


/* =========================================================
   ENTER KEY
   ========================================================= */

function setupKeyboardListener() {

    document.addEventListener(
        'keydown',
        async (event) => {

            if (
                event.key !== 'Enter' ||
                event.shiftKey ||
                event.ctrlKey ||
                event.altKey
            ) {
                return;
            }


            const textarea =
                document.getElementById(
                    'send_textarea'
                );


            if (
                !textarea ||
                event.target !== textarea
            ) {
                return;
            }


            const parsed =
                parseTupper(
                    textarea.value.trim()
                );


            /*
             * Pas un Tupper.
             */
            if (!parsed) {
                return;
            }


            /*
             * On vérifie qu'une Persona
             * porte bien ce nom avant
             * d'intercepter Enter.
             */
            const avatarId =
                await findPersonaByName(
                    parsed.personaName
                );


            if (!avatarId) {
                return;
            }


            /*
             * Empêche SillyTavern
             * d'envoyer le texte original.
             */
            event.preventDefault();
            event.stopImmediatePropagation();


            await processTupperMessage();

        },
        true
    );
}


/* =========================================================
   SEND BUTTON
   ========================================================= */

function setupSendButtonListener() {

    document.addEventListener(
        'click',
        async (event) => {

            const button =
                event.target.closest(
                    '#send_but'
                );


            if (!button) {
                return;
            }


            const textarea =
                document.getElementById(
                    'send_textarea'
                );


            if (!textarea) {
                return;
            }


            const parsed =
                parseTupper(
                    textarea.value.trim()
                );


            /*
             * Message normal.
             */
            if (!parsed) {
                return;
            }


            const avatarId =
                await findPersonaByName(
                    parsed.personaName
                );


            /*
             * Persona inconnue.
             */
            if (!avatarId) {
                return;
            }


            /*
             * Empêche le bouton natif
             * de SillyTavern d'envoyer
             * le message original.
             */
            event.preventDefault();
            event.stopImmediatePropagation();


            await processTupperMessage();

        },
        true
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

jQuery(() => {

    try {

        loadSettings();

        setupKeyboardListener();

        setupSendButtonListener();


        console.log(
            '[TupperPersona] Extension chargée.'
        );

    } catch (error) {

        console.error(
            '[TupperPersona] Erreur d'initialisation:',
            error
        );

    }

});