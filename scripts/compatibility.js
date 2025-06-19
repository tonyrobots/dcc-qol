/* global game, Dialog, ui */

/**
 * Checks the DCC system's 'emoteRolls' setting, which is incompatible with dcc-qol.
 * If enabled, it prompts the user to disable it.
 */
export async function checkAndCorrectEmoteRollsSetting() {
    const settingKey = "emoteRolls";
    const moduleName = "dcc";
    const incompatibleValue = true;

    try {
        // Removed diagnostic log
        const currentSetting = game.settings.get(moduleName, settingKey);

        if (currentSetting === incompatibleValue) {
            console.warn(
                `DCC-QOL Compatibility | Detected incompatible DCC setting: '${settingKey}' is true.`
            );

            return new Promise((resolve) => {
                let buttonClicked = false; // Flag to track if a primary button was clicked

                const dialog = new foundry.applications.api.DialogV2({
                    window: {
                        title: "DCC QoL Compatibility Check",
                        resizable: false,
                    },
                    content:
                        "<p>The 'Narrative Emote Rolls' setting in the DCC system is currently <strong>enabled</strong>.</p><p>This setting can conflict with DCC-QoL, and we recommend disabling it for optimal compatibility.</p><p><strong>Would you like to disable this setting now?</strong></p>",
                    buttons: [
                        {
                            action: "yes",
                            icon: "fas fa-check",
                            label: "Yes, Disable It",
                            default: true,
                            callback: async (event, button, dialog) => {
                                buttonClicked = true; // Set flag
                                try {
                                    await game.settings.set(
                                        moduleName,
                                        settingKey,
                                        false
                                    );
                                    ui.notifications.info(
                                        "DCC 'Narrative Emote Rolls' setting has been disabled for compatibility with DCC QoL."
                                    );
                                    console.log(
                                        `DCC-QOL Compatibility | DCC setting '${settingKey}' successfully changed to false.`
                                    );
                                    resolve(true); // Setting changed
                                    dialog.close();
                                } catch (err) {
                                    console.error(
                                        `DCC-QOL Compatibility | Error trying to set DCC setting '${settingKey}':`,
                                        err
                                    );
                                    ui.notifications.error(
                                        "Failed to change the DCC 'Narrative Emote Rolls' setting. Please check the console for errors."
                                    );
                                    resolve(false); // Failed to change
                                    dialog.close();
                                }
                            },
                        },
                        {
                            action: "no",
                            icon: "fas fa-times",
                            label: "No, Keep Enabled (Not Recommended)",
                            callback: (event, button, dialog) => {
                                buttonClicked = true; // Set flag
                                ui.notifications.warn(
                                    "DCC 'Narrative Emote Rolls' setting remains enabled. This may cause issues with DCC QoL. You can change this in the DCC system's module settings."
                                );
                                console.warn(
                                    `DCC-QOL Compatibility | User chose to keep incompatible DCC setting '${settingKey}' enabled.`
                                );
                                resolve(false); // Setting not changed
                                dialog.close();
                            },
                        },
                    ],
                    close: () => {
                        if (!buttonClicked) {
                            // Only show dismissal message if no button was clicked
                            ui.notifications.warn(
                                "DCC 'Narrative Emote Rolls' setting check was dismissed. The setting remains enabled and may cause issues with DCC QoL."
                            );
                            console.warn(
                                `DCC-QOL Compatibility | User dismissed the dialog for incompatible DCC setting '${settingKey}'.`
                            );
                        }
                        resolve(false); // Setting not changed (or dismissal implies no change)
                    },
                });
                dialog.render(true);
            });
        } else {
            console.debug(
                `DCC-QOL Compatibility | DCC setting '${settingKey}' is already compatible (false). No action needed.`
            );
            return Promise.resolve(true); // Already compatible
        }
    } catch (error) {
        console.error(
            `DCC-QOL Compatibility | Error accessing DCC setting '${moduleName}.${settingKey}'. The specific error was:`,
            error // Log the actual error object
        );
        ui.notifications.error(
            `Could not check the DCC system setting '${settingKey}'. Make sure the DCC system is active and up to date. See console (F12) for more details.`
        );
        return Promise.resolve(false); // Error accessing setting
    }
}
