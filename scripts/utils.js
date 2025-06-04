/* global game */

/**
 * Extracts the first valid TokenDocument from a Set of targets.
 * Handles the common pattern where hooks provide targets as a Set<Token>.
 * Includes basic validation.
 *
 * @param {Set<Token>} targetsSet - The Set of targeted tokens (e.g., game.user.targets).
 * @returns {TokenDocument | null} The first valid TokenDocument object, or null if none found.
 */
export function getFirstTarget(targetsSet) {
    if (!(targetsSet instanceof Set) || targetsSet.size === 0) {
        console.debug(
            "DCC-QOL Utils | getFirstTarget: Invalid or empty target set provided."
        );
        return null;
    }

    const targetToken = targetsSet.first();
    if (!targetToken?.document) {
        console.debug(
            "DCC-QOL Utils | getFirstTarget: First element in target set is invalid or has no document."
        );
        return null;
    }

    const targetDocument = targetToken.document;

    console.debug(
        `DCC-QOL Utils | getFirstTarget: Returning target document ${
            targetDocument.name || targetDocument.id
        }`
    );
    return targetDocument;
}

/*
 * Measure distance between 2 tokens (documents), taking size of tokens into account
 * @param {Object} token1D    The token.document "from"
 * @param {Object} token2D    The token.document "to"
 */
export function measureTokenDistance(token1D, token2D) {
    const gs = game.canvas.dimensions.size;
    // originate ray from center of token1 to center of token2
    const ray = new Ray(token1D.object.center, token2D.object.center);

    const nx = Math.ceil(Math.abs(ray.dx / gs));
    const ny = Math.ceil(Math.abs(ray.dy / gs));

    // Get the number of straight and diagonal moves
    const nDiagonal = Math.min(nx, ny);
    const nStraight = Math.abs(ny - nx);

    // Diagonals in DDC calculated as equal to (1.0x) the straight distance - pythagoras be damned!
    const distance = Math.floor(nDiagonal * 1.0 + nStraight);
    let distanceOnGrid = distance * game.canvas.dimensions.distance;
    // make adjustment to account for size of token. Using width as tokens are assumed to be square.
    let adjustment = Math.round((token1D.width + token2D.width) * 0.5) - 1;

    return distanceOnGrid - adjustment * game.canvas.dimensions.distance;
}

/**
 * Gets all tokens within melee range of a target token, optionally filtered by disposition.
 * @param {TokenDocument} targetTokenDocument - The token document to check for adjacent tokens
 * @param {string} scope - Filter scope: "all", "enemy", "friendly", "neutral"
 * @returns {TokenDocument[]} Array of token documents matching the criteria
 */
export function getTokensInMeleeRange(targetTokenDocument, scope = "all") {
    const tokensInMelee = [];
    console.debug(
        `DCC-QOL Utils | getTokensInMeleeRange: Checking target ${targetTokenDocument?.name} (ID: ${targetTokenDocument?.id}) for ${scope} tokens`
    );

    const targetTokenPlaceable = game.canvas.tokens.get(targetTokenDocument.id);

    if (!targetTokenPlaceable) {
        console.warn(
            `DCC-QOL Utils | getTokensInMeleeRange: Target token placeable not found on canvas for document ID: ${targetTokenDocument?.id}. Cannot determine melee situation.`
        );
        return tokensInMelee;
    }

    // Define a search area around the target token
    // Buffer by one grid unit, as that's the typical melee engagement range.
    const meleePixelBuffer = game.canvas.dimensions.size;
    const searchRect = new PIXI.Rectangle(
        targetTokenPlaceable.bounds.x - meleePixelBuffer,
        targetTokenPlaceable.bounds.y - meleePixelBuffer,
        targetTokenPlaceable.bounds.width + 2 * meleePixelBuffer,
        targetTokenPlaceable.bounds.height + 2 * meleePixelBuffer
    );

    // Get tokens within the search rectangle using the quadtree
    const nearbyTokenPlaceables =
        game.canvas.tokens.quadtree.getObjects(searchRect);

    console.debug(
        `DCC-QOL Utils | getTokensInMeleeRange: Found ${nearbyTokenPlaceables.size} tokens near target using quadtree.`
    );

    for (const tokenPlaceable of nearbyTokenPlaceables) {
        const otherTokenDocument = tokenPlaceable.document;
        console.debug(
            `DCC-QOL Utils |   - Iterating nearby token: ${otherTokenDocument?.name} (ID: ${otherTokenDocument?.id})`
        );

        if (otherTokenDocument.id === targetTokenDocument.id) {
            console.debug(
                `DCC-QOL Utils |   - Skipping target token itself: ${otherTokenDocument?.name}`
            );
            continue; // Skip the target token itself
        }

        // Check if the token is in melee range
        const distance = measureTokenDistance(
            targetTokenDocument,
            otherTokenDocument
        );
        const disposition = otherTokenDocument.disposition;

        console.debug(
            `DCC-QOL Utils |     - Distance to ${otherTokenDocument?.name}: ${distance}`
        );
        console.debug(
            `DCC-QOL Utils |     - Disposition of ${otherTokenDocument?.name}: ${disposition}`
        );

        if (distance <= game.canvas.dimensions.distance) {
            // Token is in melee range, now check if it matches the scope filter
            const includeToken = _matchesDispositionScope(disposition, scope);

            if (includeToken) {
                console.debug(
                    `DCC-QOL Utils |     - Token ${otherTokenDocument?.name} matches scope '${scope}' and is in melee range!`
                );
                tokensInMelee.push(otherTokenDocument);
            }
        }
    }

    console.debug(
        `DCC-QOL Utils | getTokensInMeleeRange: Returning ${tokensInMelee.length} tokens for scope '${scope}'`
    );
    return tokensInMelee;
}

/**
 * Helper function to check if a token's disposition matches the requested scope
 * @param {number} disposition - The token's disposition value
 * @param {string} scope - The requested scope filter
 * @returns {boolean} True if the disposition matches the scope
 * @private
 */
function _matchesDispositionScope(disposition, scope) {
    switch (scope) {
        case "all":
            return true;
        case "friendly":
            return disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
        case "neutral":
            return disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL;
        case "enemy":
            return disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;
        default:
            console.warn(
                `DCC-QOL Utils | _matchesDispositionScope: Unknown scope '${scope}', defaulting to 'all'`
            );
            return true;
    }
}

/**
 * Checks if a target token has any adjacent allied tokens (wrapper function for backward compatibility)
 * @param {TokenDocument} targetTokenDocument - The token document to check for adjacent allies
 * @returns {boolean} True if target has adjacent allies, false otherwise
 */
export function checkFiringIntoMelee(targetTokenDocument) {
    const friendlyTokens = getTokensInMeleeRange(
        targetTokenDocument,
        "friendly"
    );
    const firingIntoMelee = friendlyTokens.length > 0;

    console.debug(
        `DCC-QOL Utils | checkFiringIntoMelee: Returning ${firingIntoMelee} (found ${friendlyTokens.length} friendly tokens)`
    );
    return firingIntoMelee;
}

/**
 * Gets the properties of a weapon
 * @param {Object} weapon - The weapon object
 * @param {Object} options - The options object
 * @returns {Array} The properties of the weapon
 */
export async function getWeaponProperties(weapon, options) {
    const properties = [];

    if (weapon.system.melee) {
        properties.push("Melee");
    } else {
        properties.push("Ranged");
        properties.push(weapon.system.range + " ft.");
    }
    // if (weapon.system.equipped) {
    //     properties.push("Equipped");
    // } else {
    //     properties.push("Not Equipped");
    // }
    if (weapon.system.trained) {
        properties.push("Trained");
    } else {
        properties.push("Not Trained");
    }
    if (weapon.system.twoHanded) {
        properties.push("Two handed");
    }
    if (options.backstab) {
        properties.push("Backstab");
    }
    return properties;
}

/**
 * Retrieves a weapon item from an actor by its ID.
 *
 * @param {Actor} actor - The actor from whom to retrieve the weapon.
 * @param {string} weaponId - The ID of the weapon item to retrieve.
 * @returns {Item|null} The weapon item if found, otherwise null.
 */
export function getWeaponFromActorById(actor, weaponId) {
    if (!actor) {
        console.warn(
            "DCC-QOL Utils | getWeaponFromActorById: Invalid actor provided."
        );
        return null;
    }
    if (!weaponId) {
        console.warn(
            "DCC-QOL Utils | getWeaponFromActorById: Invalid weaponId provided."
        );
        return null;
    }

    const weapon = actor.items.get(weaponId);

    if (!weapon) {
        console.warn(
            `DCC-QOL Utils | getWeaponFromActorById: Weapon not found on Actor ${actor.name} (ID: ${actor.id}) with Weapon ID: ${weaponId}`
        );
        return null;
    }

    // console.debug(`DCC-QOL Utils | getWeaponFromActorById: Returning weapon ${weapon.name}`);
    return weapon;
}
