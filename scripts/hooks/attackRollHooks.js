/**
 * Test Listener for the dcc.modifyAttackRollTerms hook.
 * Adds a bonus based on the length of the target's name.
 * @param {Array} terms - The array of roll terms.
 * @param {Actor} actor - The attacking actor.
 * @param {Item} weapon - The weapon item used.
 * @param {TokenDocument | TokenDocument[] | undefined} targets - The target(s) passed by the hook.
 * @param {object} options - Roll options.
 */
export function addTestBonus(terms, actor, weapon, targets, options) {
    console.debug("DCC-QOL | addTestBonus hook listener called");
    console.log("DCC-QOL Hook | dcc.modifyAttackRollTerms triggered!");
    console.log(
        "DCC-QOL Hook | Initial terms:",
        JSON.parse(JSON.stringify(terms))
    ); // Log initial terms
    console.log("DCC-QOL Hook | Targets received:", targets); // Log received targets

    // Determine the first valid target document
    let targetDocument = undefined;
    if (targets instanceof Set && targets.size > 0) {
        // Standard Foundry target Set<Token>
        targetDocument = targets.first()?.document; // Get the document from the first Token
    }

    if (targetDocument?.name) {
        const targetName = targetDocument.name;
        const weirdBonusValue = targetName.length;
        console.log(
            `DCC-QOL Hook | Target: ${targetName}, Name Length: ${weirdBonusValue}`
        );

        // Add the new modifier term
        terms.push({
            type: "Modifier",
            label: "Weird Bonus", // Translate if needed: game.i18n.localize("DCC-QOL.WeirdBonusLabel")
            formula: "+" + weirdBonusValue.toString(), // Ensure formula is a string
        });

        console.log("DCC-QOL Hook | Final terms:", terms); // Log terms after modification
    } else {
        console.log(
            "DCC-QOL Hook | No valid target document found in the Set."
        );
    }
}

// Add other attack-roll related hook listeners here in the future...
