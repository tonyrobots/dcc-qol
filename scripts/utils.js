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
    if (!token1D || !token2D) {
        return Infinity;
    }
    const d = game.canvas.dimensions;
    const gs = d.size;

    // Bounding boxes in pixels
    const r1 = {
        left: token1D.x,
        right: token1D.x + token1D.width * gs,
        top: token1D.y,
        bottom: token1D.y + token1D.height * gs,
    };
    const r2 = {
        left: token2D.x,
        right: token2D.x + token2D.width * gs,
        top: token2D.y,
        bottom: token2D.y + token2D.height * gs,
    };

    // Pixel distance between rectangle edges
    const dx = Math.max(0, r1.left - r2.right, r2.left - r1.right);
    const dy = Math.max(0, r1.top - r2.bottom, r2.top - r1.bottom);

    // Number of full grid squares between them.
    const grid_dx = Math.floor(dx / gs);
    const grid_dy = Math.floor(dy / gs);

    // Per DCC rules, diagonal moves are the same cost as straight moves (Chebyshev distance).
    const spacesBetween = Math.max(grid_dx, grid_dy);

    // For melee check, `getTokensInMeleeRange` wants a distance.
    // 0 spaces between = adjacent = 5ft distance
    // 1 space between = 10ft distance
    return spacesBetween * d.distance + d.distance;
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
 * Checks if a target token has any adjacent allied (to the firer) tokens
 * @param {TokenDocument} targetTokenDocument - The token document to check for adjacent friendlies
 * @returns {boolean} True if target has adjacent friendlies, false otherwise
 */
export function checkFiringIntoMelee(
    targetTokenDocument,
    firerDisposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY
) {
    const friendlyTokens = getTokensInMeleeRange(
        targetTokenDocument,
        firerDisposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY
            ? "friendly"
            : "enemy"
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

/**
 * Retrieves a token document by its ID from the canvas.
 *
 * @param {string} tokenId - The ID of the token to retrieve.
 * @returns {TokenDocument|null} The token document if found, otherwise null.
 */
export function getTokenById(tokenId) {
    if (!tokenId) {
        console.warn("DCC-QOL Utils | getTokenById: Invalid tokenId provided.");
        return null;
    }

    const tokenPlaceable = game.canvas.tokens.get(tokenId);

    if (!tokenPlaceable) {
        console.debug(
            `DCC-QOL Utils | getTokenById: Token not found on canvas with ID: ${tokenId}`
        );
        return null;
    }

    const tokenDocument = tokenPlaceable.document;

    if (!tokenDocument) {
        console.warn(
            `DCC-QOL Utils | getTokenById: Token placeable found but has no document for ID: ${tokenId}`
        );
        return null;
    }

    console.debug(
        `DCC-QOL Utils | getTokenById: Returning token document ${
            tokenDocument.name || tokenDocument.id
        }`
    );
    return tokenDocument;
}

/**
 * Resolves a token document from an actor and options object.
 * Tries multiple approaches to handle linked actors, unlinked tokens, and fallback scenarios.
 *
 * @param {Actor} actor - The actor to get the token document for.
 * @param {object} options - The options object from the hook, may contain token ID or TokenDocument.
 * @returns {TokenDocument|null} The actor's token document if found, otherwise null.
 */
export function getTokenDocumentFromActor(actor, options) {
    if (!actor) {
        console.debug(
            "DCC-QOL Utils | getTokenDocumentFromActor: No actor provided."
        );
        return null;
    }

    let attackerTokenDoc = null;

    // Try 1: Use actor.token (works for linked actors)
    attackerTokenDoc = actor.token;
    if (attackerTokenDoc) {
        console.debug(
            `DCC-QOL Utils | getTokenDocumentFromActor: Found token via actor.token: ${attackerTokenDoc.name}`
        );
        return attackerTokenDoc;
    }

    // Try 2: Check options.token (for unlinked tokens or when token ID is passed via options)
    if (options?.token) {
        if (typeof options.token === "string") {
            // Token ID string - use our utility function
            attackerTokenDoc = getTokenById(options.token);
            if (attackerTokenDoc) {
                console.debug(
                    `DCC-QOL Utils | getTokenDocumentFromActor: Found token via options.token ID: ${attackerTokenDoc.name}`
                );
                return attackerTokenDoc;
            }
        } else if (options.token instanceof TokenDocument) {
            // Already a TokenDocument
            attackerTokenDoc = options.token;
            console.debug(
                `DCC-QOL Utils | getTokenDocumentFromActor: Found token via options.token document: ${attackerTokenDoc.name}`
            );
            return attackerTokenDoc;
        }
    }

    // Try 3: Fall back to first active token for the actor
    if (actor.getActiveTokens().length > 0) {
        attackerTokenDoc = actor.getActiveTokens()[0].document;
        if (attackerTokenDoc) {
            console.debug(
                `DCC-QOL Utils | getTokenDocumentFromActor: Found token via actor.getActiveTokens(): ${attackerTokenDoc.name}`
            );
            return attackerTokenDoc;
        }
    }

    // No token found
    console.debug(
        `DCC-QOL Utils | getTokenDocumentFromActor: No token found for actor ${actor.name} (ID: ${actor.id})`
    );
    return null;
}
