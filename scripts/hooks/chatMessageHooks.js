/* global game, renderTemplate, $ */

/**
 * Handles modifying chat messages to add QoL buttons to attack rolls.
 * Called via the renderChatMessage hook.
 * Assumes data has been prepared by the dcc.rollWeaponAttack hook.
 */

/**
 * Adds QoL action buttons to DCC attack roll chat cards.
 *
 * @param {ChatMessage} message - The ChatMessage document being rendered.
 * @param {jQuery} html - The jQuery object representing the message's HTML content.
 * @param {object} data - The data object provided to the hook.
 */
export async function enhanceAttackRollCard(message, html, data) {
    // Quick check for QoL setting and our specific flag
    if (
        !game.settings.get("dcc-qol", "useQoLAttackCard") ||
        !message.flags?.dccqol?.isAttackRoll
    ) {
        return;
    }

    // Prevent duplicate button injection if message re-renders
    if (html.find(".dccqol-buttons").length > 0) {
        console.debug("DCC-QOL | QoL buttons already present. Skipping.");
        return;
    }

    console.debug("DCC-QOL | Adding QoL buttons to message:", message.id);

    try {
        // Data is already prepared in message.flags.dccqol
        const templateData = message.flags.dccqol;

        // Add message ID for potential debugging/linking
        templateData.messageId = message.id;

        console.debug(
            "DCC-QOL | Rendering qol-buttons template with data:",
            templateData
        );

        // Render the buttons template
        const renderedButtonsHtml = await renderTemplate(
            "modules/dcc-qol/templates/qol-buttons.hbs",
            templateData
        );

        // --- Inject Buttons ---
        // Find a suitable place in the original DCC card.
        // Append after the main content or roll display area.
        const contentArea = html.find(".message-content"); // Broadest area
        const cardContent = html.find(".card-content"); // DCC system card content
        const diceRollArea = html.find(".dice-roll"); // Often present

        let injectionPoint = contentArea; // Default to message content
        if (cardContent.length > 0) {
            // Prefer appending after card-content within message-content
            injectionPoint = cardContent;
        }
        // We could refine further, e.g., append after the last .dice-roll if present

        if (injectionPoint.length > 0) {
            console.debug(
                "DCC-QOL | Injecting buttons HTML after:",
                injectionPoint
            );
            // Append the buttons HTML
            injectionPoint.last().after(renderedButtonsHtml); // Append after the element(s) found

            // Optional: Add listeners if they are not handled by global delegation
            // addChatListeners(html);
        } else {
            console.warn(
                "DCC-QOL | Could not find suitable injection point for buttons in message:",
                message.id
            );
        }
    } catch (err) {
        console.error(
            "DCC QoL | Error adding QoL buttons to attack roll card:",
            err
        );
    }
}

// Remove the old helper functions: shouldApplyQoLStyling and buildTemplateData
// They are no longer needed with the new dcc.rollWeaponAttack hook approach.
