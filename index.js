import { extension_settings } from '../../../extensions.js';
import { power_user } from '../../../power-user.js';
import { setUserAvatar } from '../../../personas.js';
import { sendTextareaMessage } from '../../../script.js';


const extensionName = 'TupperPersona';


/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }

    if (typeof extension_settings[extensionName].enabled !== 'boolean') {
        extension_settings[extensionName].enabled = true;
    }
}


/* =========================================================
   FIND PERSONA
   ========================================================= */

function findPersonaByName(name) {
    if (!power_user || !power_user.personas) {
        return null;
    }

    const target = String(name).trim().toLowerCase();

    if (!target) {
        return null;
    }

    for (const [avatarId, personaName] of Object.entries(power_user.personas)) {
        if (!personaName) {
            continue;
        }

        if (String(personaName).trim().toLowerCase() === target) {
            return avatarId;
        }
    }

    return null;
}


/* =========================================================
   PARSE TUPPER MESSAGE
   ========================================================= */

function parseTupperMessage(text) {
    if (!text) {
        return null;
    }

    /*
     * Format :
     *
     * Nom: message
     */

    const match = text.match(/^([^:\n]{1,40}):\s*([\s\S]*)$/);

    if (!match) {
        return null;
    }

    const personaName = match[1].trim();
    const message = match[2].trim();

    if (!personaName || !message) {
        return null;
    }

    return {
        personaName,
        message,
    };
}


/* =========================================================
   PROCESS TUPPER MESSAGE
   ========================================================= */

async function processTupperMessage() {
    if (!extension_settings[extensionName]?.enabled) {
        return false;
    }

    const textarea = document.getElementById('send_textarea');

    if (!textarea) {
        return false;
    }

    const originalText = textarea.value.trim();

    if (!originalText) {
        return false;
    }

    const parsed = parseTupperMessage(originalText);

    /*
     * Ce n'est pas un message Tupper.
     */
    if (!parsed) {
        return false;
    }

    /*
     * Cherche la Persona.
     */
    const avatarId = findPersonaByName(parsed.personaName);

    /*
     * Persona inconnue :
     * SillyTavern fonctionne normalement.
     */
    if (!avatarId) {
        console.log(
            `[TupperPersona] Persona inconnue : ${parsed.personaName}`
        );

        return false;
    }

    try {
        console.log(
            `[TupperPersona] Changement vers : ${parsed.personaName}`
        );

        /*
         * Change la Persona.
         */
        await setUserAvatar(avatarId, {
            toastPersonaNameChange: true,
        });

        /*
         * Retire le préfixe Tupper.
         *
         * Hagen: Bonjour
         *
         * devient :
         *
         * Bonjour
         */
        textarea.value = parsed.message;

        textarea.dispatchEvent(
            new Event('input', {
                bubbles: true,
            })
        );

        /*
         * Envoie le message avec la Persona sélectionnée.
         */
        await sendTextareaMessage();

        console.log(
            `[TupperPersona] Message envoyé avec ${parsed.personaName}`
        );

        return true;

    } catch (error) {
        console.error(
            '[TupperPersona] Erreur :',
            error
        );

        /*
         * En cas d'erreur, on remet le texte original.
         */
        textarea.value = originalText;

        textarea.dispatchEvent(
            new Event('input', {
                bubbles: true,
            })
        );

        return false;
    }
}


/* =========================================================
   KEYBOARD — ENTER
   ========================================================= */

function setupKeyboardListener() {
    document.addEventListener(
        'keydown',
        async (event) => {

            if (event.key !== 'Enter') {
                return;
            }

            /*
             * Shift + Enter = retour à la ligne.
             */
            if (event.shiftKey) {
                return;
            }

            if (event.ctrlKey || event.altKey) {
                return;
            }

            const textarea = document.getElementById('send_textarea');

            if (!textarea || event.target !== textarea) {
                return;
            }

            const text = textarea.value.trim();

            if (!text) {
                return;
            }

            const parsed = parseTupperMessage(text);

            /*
             * Message normal :
             * SillyTavern s'en occupe.
             */
            if (!parsed) {
                return;
            }

            /*
             * Vérifie immédiatement si la Persona existe.
             */
            const avatarId = findPersonaByName(parsed.personaName);

            if (!avatarId) {
                return;
            }

            /*
             * Empêche SillyTavern d'envoyer
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
   SEND BUTTON
   ========================================================= */

function setupSendButtonListener() {
    document.addEventListener(
        'click',
        async (event) => {

            const button = event.target.closest('#send_but');

            if (!button) {
                return;
            }

            const textarea = document.getElementById('send_textarea');

            if (!textarea) {
                return;
            }

            const text = textarea.value.trim();

            if (!text) {
                return;
            }

            const parsed = parseTupperMessage(text);

            /*
             * Message normal :
             * comportement normal de SillyTavern.
             */
            if (!parsed) {
                return;
            }

            /*
             * Vérifie si la Persona existe.
             */
            const avatarId = findPersonaByName(parsed.personaName);

            if (!avatarId) {
                return;
            }

            /*
             * Empêche le bouton natif de SillyTavern
             * d'envoyer le message original.
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

function initialize() {
    try {
        loadSettings();

        setupKeyboardListener();

        setupSendButtonListener();

        console.log(
            '[TupperPersona] Extension chargée avec succès.'
        );

    } catch (error) {
        console.error(
            '[TupperPersona] Erreur d\'initialisation :',
            error
        );
    }
}


/* =========================================================
   START
   ========================================================= */

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        initialize
    );
} else {
    initialize();
}