import { getContext, extension_settings, saveSettingsDebounced } from '../../../extensions.js';
import { power_user } from '../../../../power-user.js';
import { setUserAvatar } from '../../../../scripts/personas.js';
import { eventSource, event_types } from '../../../../script.js';

const extensionName = 'TupperPersona';

const defaultSettings = {
    enabled: true,
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
}

/**
 * Trouve l'avatar ID d'un persona à partir de son nom (insensible à la casse)
 */
function findPersonaByName(name) {
    if (!power_user?.personas) return null;
    
    const lowerName = name.trim().toLowerCase();
    
    for (const [avatarId, personaName] of Object.entries(power_user.personas)) {
        if (personaName && personaName.toLowerCase() === lowerName) {
            return avatarId;
        }
    }
    return null;
}

/**
 * Intercepte le message avant l'envoi
 */
async function handleSend() {
    if (!extension_settings[extensionName]?.enabled) return;

    const textarea = document.getElementById('send_textarea');
    if (!textarea) return;

    let text = textarea.value.trim();
    if (!text) return;

    // Cherche le pattern "Nom: message"
    const match = text.match(/^([^:\n]{1,40}):\s*([\s\S]*)$/);
    if (!match) return;

    const personaName = match[1].trim();
    const realMessage = match[2].trim();

    if (!realMessage) return;

    const avatarId = findPersonaByName(personaName);
    if (!avatarId) return;

    try {
        await setUserAvatar(avatarId, { toastPersonaNameChange: true });
        
        textarea.value = realMessage;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        console.log(`[TupperPersona] Switched to: ${personaName}`);
    } catch (err) {
        console.error('[TupperPersona] Erreur:', err);
    }
}

function setupListeners() {
    const textarea = document.getElementById('send_textarea');
    if (!textarea) {
        setTimeout(setupListeners, 600);
        return;
    }

    textarea.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            await handleSend();
        }
    });

    const sendButton = document.getElementById('send_but');
    if (sendButton) {
        sendButton.addEventListener('click', async () => {
            await handleSend();
        }, true);
    }
}

jQuery(async () => {
    loadSettings();
    setupListeners();
    console.log('[TupperPersona] Extension chargée');
});