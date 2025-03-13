// Socket handling for DCC-QOL

/**
 * Register websocket listeners
 */
export function registerWebsocketListeners() {
    if (!game.modules.get("socketlib")?.active) return;

    const socket = socketlib.registerModule("dcc-qol");

    // Register socket function for applying damage
    socket.register("applyDamage", applyDamage);
}

/**
 * Apply damage to a token
 * @param {string} tokenId - Token ID to apply damage to
 * @param {number} damage - Amount of damage to apply
 */
async function applyDamage(tokenId, damage) {
    if (!game.user.isGM) return;

    const token = canvas.tokens.get(tokenId);
    if (!token) return;

    const actor = token.actor;
    if (!actor) return;

    // Get current HP
    const hp = actor.system.attributes.hp.value;
    const newHp = Math.max(0, hp - damage);

    // Update actor HP
    await actor.update({
        "system.attributes.hp.value": newHp,
    });

    // Show floating damage text if settings allow
    if (game.settings.get("core", "showFloatingText")) {
        token.hud.createScrollingText(`-${damage}`, {
            anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
            direction: CONST.TEXT_ANCHOR_POINTS.TOP,
            fontSize: 36,
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 4,
            jitter: 0.25,
        });
    }
}
