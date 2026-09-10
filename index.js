import {
    extension_settings,
} from '../../../extensions.js';

import {
    power_user,
} from '../../../power-user.js';

import {
    setUserAvatar,
} from '../../../personas.js';

import {
    sendTextareaMessage,
} from '../../../script.js';


const extensionName = 'TupperPersona';

const defaultSettings = {
    enabled: true,
};


// Empêche plusieurs envois simultanés
let isProcessingTupper = false;


/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {

    extension_settings[extensionName] =
        extension_settings[extensionName] || {};

    if (
        Object.keys(
            extension_settings[extensionName]
        ).length === 0
    ) {
        Object.assign(
            extension_settings[extensionName],
            defaultSettings
        );
    }
}


/* =========================================================
   FIND PERSONA
   ========================================================= */

/**
 * Trouve l'ID d'une Persona à partir de son nom.
 *
 * Exemple :
 *
 * Hagen
 *
 * trouvera la Persona "Hagen".
 */
function findPersonaByName(name) {

    if (!power_user?.personas) {
        return null;
    }

    const lowerName =
        name
            .trim()
            .toLowerCase();


    for (
        const [avatarId, personaName]
        of Object.entries(power_user.personas)
    ) {

        if (!personaName) {
            continue;
        }


        if (
            personaName
                .trim()
                .toLowerCase()
            === lowerName
        ) {

            return avatarId;
        }
    }


    return null;
}


/* =========================================================
   PARSE TUPPER MESSAGE
   ========================================================= */

/**
 * Analyse un message Tupper.
 *
 * Format :
 *
 * Nom: message
 *
 * Exemple :
 *
 * Hagen: Bonjour !
 */
function parseTupperMessage(text) {

    const match = text.match(
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
   HANDLE TUPPER SEND
   ========================================================= */

/**
 * Traite un message Tupper.
 *
 * Exemple :
 *
 * Hagen: Bonjour
 *
 * devient :
 *
 * Persona Hagen sélectionnée
 * Bonjour
 */
async function handleTupperSend() {

    if (
        !extension_settings[
            extensionName
        ]?.enabled
    ) {
        return false;
    }


    if (isProcessingTupper) {
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
        parseTupperMessage(
            originalText
        );


    /*
     * Si ce n'est pas un message Tupper,
     * SillyTavern continue normalement.
     */
    if (!parsed) {
        return false;
    }


    const avatarId =
        findPersonaByName(
            parsed.personaName
        );


    /*
     * Si la Persona n'existe pas,
     * SillyTavern continue normalement.
     */
    if (!avatarId) {

        console.log(
            `[TupperPersona] Persona introuvable : ${parsed.personaName}`
        );

        return false;
    }


    isProcessingTupper = true;


    try {

        console.log(
            `[TupperPersona] Changement de Persona : ${parsed.personaName}`
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
           REPLACE MESSAGE
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
           SEND MESSAGE
           ------------------------------------------------- */

        await sendTextareaMessage();


        console.log(
            `[TupperPersona] Message envoyé avec la Persona : ${parsed.personaName}`
        );


        return true;

    } catch (error) {

        console.error(
            '[TupperPersona] Erreur :',
            error
        );


        /*
         * Si quelque chose échoue,
         * on restaure le message original.
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

        isProcessingTupper = false;
    }
}


/* =========================================================
   KEYBOARD LISTENER
   ========================================================= */

/**
 * Intercepte Enter.
 */
function setupKeyboardListener() {

    document.addEventListener(
        'keydown',
        async (event) => {

            if (
                event.key !== 'Enter'
            ) {
                return;
            }


            /*
             * Shift + Enter = nouvelle ligne
             */
            if (event.shiftKey) {
                return;
            }


            if (event.ctrlKey) {
                return;
            }


            if (event.altKey) {
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


            const text =
                textarea.value.trim();


            if (!text) {
                return;
            }


            const parsed =
                parseTupperMessage(text);


            /*
             * Message normal :
             * on ne touche à rien.
             */
            if (!parsed) {
                return;
            }


            const avatarId =
                findPersonaByName(
                    parsed.personaName
                );


            /*
             * Persona inconnue :
             * on laisse SillyTavern gérer.
             */
            if (!avatarId) {
                return;
            }


            /*
             * IMPORTANT :
             * Empêche SillyTavern d'envoyer
             * le message original.
             */
            event.preventDefault();
            event.stopImmediatePropagation();


            await handleTupperSend();

        },
        true
    );
}


/* =========================================================
   SEND BUTTON LISTENER
   ========================================================= */

/**
 * Intercepte le bouton Envoyer.
 */
function setupSendButtonListener() {

    document.addEventListener(
        'click',
        async (event) => {

            const sendButton =
                event.target.closest(
                    '#send_but'
                );


            if (!sendButton) {
                return;
            }


            const textarea =
                document.getElementById(
                    'send_textarea'
                );


            if (!textarea) {
                return;
            }


            const text =
                textarea.value.trim();


            if (!text) {
                return;
            }


            const parsed =
                parseTupperMessage(text);


            /*
             * Message normal :
             * comportement normal de SillyTavern.
             */
            if (!parsed) {
                return;
            }


            const avatarId =
                findPersonaByName(
                    parsed.personaName
                );


            /*
             * Persona inconnue :
             * comportement normal.
             */
            if (!avatarId) {
                return;
            }


            /*
             * Empêche l'envoi natif
             * de SillyTavern.
             */
            event.preventDefault();
            event.stopImmediatePropagation();


            await handleTupperSend();

        },
        true
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

jQuery(async () => {

    loadSettings();

    setupKeyboardListener();

    setupSendButtonListener();


    console.log(
        '[TupperPersona] Extension chargée avec succès.'
    );

});