/* globals jest, describe, it, expect, beforeEach, game */

import { createMockPc, createMockNpc } from "../__mocks__/mock-data.js";
import { handleNPCDeathStatusUpdate } from "../hooks/updateActorHooks.js";

describe("Update Actor Hooks", () => {
    describe("handleNPCDeathStatusUpdate", () => {
        let mockNPC, mockPC, mockChatMessage;

        beforeEach(() => {
            // Mock game.user.isGM
            game.user = {
                isGM: true,
            };

            // Mock game.settings.get to control the feature toggle
            game.settings = {
                get: jest.fn((namespace, setting) => {
                    if (
                        namespace === "dcc-qol" &&
                        setting === "automateNPCDeathStatus"
                    ) {
                        return true; // Default: feature enabled
                    }
                    return false;
                }),
            };

            // Mock game.i18n.localize
            game.i18n = {
                localize: jest.fn((key) => key),
            };

            // Mock ChatMessage
            mockChatMessage = {
                getSpeaker: jest.fn(() => ({ actor: "test-speaker" })),
                create: jest.fn(),
            };
            global.ChatMessage = mockChatMessage;

            // Mock CONFIG.statusEffects
            global.CONFIG = {
                statusEffects: [
                    {
                        id: "dead",
                        name: "Dead",
                        label: "Dead",
                    },
                ],
            };

            // Create mock actors with proper HP data
            mockNPC = createMockNpc({
                _id: "mock-npc-id",
                system: {
                    attributes: {
                        hp: {
                            value: 10,
                            max: 10,
                        },
                    },
                },
                statuses: new Set(), // Empty status set initially
                toggleStatusEffect: jest.fn(),
            });

            mockPC = createMockPc({
                _id: "mock-pc-id",
                system: {
                    attributes: {
                        hp: {
                            value: 10,
                            max: 10,
                        },
                    },
                },
                statuses: new Set(), // Empty status set initially
                toggleStatusEffect: jest.fn(),
            });
        });

        describe("when setting is enabled and user is GM", () => {
            it("should apply dead status to NPC when HP goes from 10 to 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).toHaveBeenCalledWith("dead");
                expect(mockChatMessage.create).toHaveBeenCalledWith({
                    speaker: { actor: "test-speaker" },
                    content: "Test NPC is now dead.",
                });
            });

            it("should NOT apply dead status to PC when HP goes to 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockPC.toggleStatusEffect).not.toHaveBeenCalled();
                expect(mockChatMessage.create).not.toHaveBeenCalled();
            });

            it("should NOT apply dead status to NPC when HP is above 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 1, // HP is still above 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).not.toHaveBeenCalled();
                expect(mockChatMessage.create).not.toHaveBeenCalled();
            });

            it("should NOT apply dead status to NPC when no HP update is present", async () => {
                // Arrange
                const updateData = {
                    // No HP update data
                    system: {
                        attributes: {
                            ac: {
                                value: 0, // Different attribute updated
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).not.toHaveBeenCalled();
                expect(mockChatMessage.create).not.toHaveBeenCalled();
            });

            it("should not apply status if actor already has the status", async () => {
                // Arrange
                mockNPC.statuses.add("dead"); // NPC already has dead status

                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).not.toHaveBeenCalled();
                expect(mockChatMessage.create).not.toHaveBeenCalled();
            });
        });

        describe("when setting is disabled", () => {
            beforeEach(() => {
                // Mock setting to return false (feature disabled)
                game.settings.get.mockImplementation((namespace, setting) => {
                    if (
                        namespace === "dcc-qol" &&
                        setting === "automateNPCDeathStatus"
                    ) {
                        return false; // Feature disabled
                    }
                    return false;
                });
            });

            it("should NOT apply dead status to NPC even when HP goes to 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).not.toHaveBeenCalled();
                expect(mockChatMessage.create).not.toHaveBeenCalled();
            });
        });

        describe("when user is not GM", () => {
            beforeEach(() => {
                game.user.isGM = false;
            });

            it("should NOT apply dead status to NPC when HP goes to 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).not.toHaveBeenCalled();
                expect(mockChatMessage.create).not.toHaveBeenCalled();
            });
        });

        describe("error handling", () => {
            it("should handle errors when applying status effect", async () => {
                // Arrange
                const consoleErrorSpy = jest
                    .spyOn(console, "error")
                    .mockImplementation();
                mockNPC.toggleStatusEffect.mockRejectedValue(
                    new Error("Toggle failed")
                );

                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(mockNPC.toggleStatusEffect).toHaveBeenCalledWith("dead");
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    "DCC-QOL | Error applying status dead to NPC Test NPC:",
                    expect.any(Error)
                );

                // Cleanup
                consoleErrorSpy.mockRestore();
            });
        });
    });
});
