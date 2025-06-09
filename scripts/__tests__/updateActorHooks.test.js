/* globals jest, describe, it, expect, beforeEach, game */

import { createMockPc, createMockNpc } from "../__mocks__/mock-data.js";
import { handleNPCDeathStatusUpdate } from "../hooks/updateActorHooks.js";

describe("Update Actor Hooks", () => {
    describe("handleNPCDeathStatusUpdate", () => {
        let mockNPC, mockPC;

        beforeEach(() => {
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

            // Create mock actors with proper HP data
            mockNPC = createMockNpc({
                system: {
                    attributes: {
                        hp: {
                            value: 10,
                            max: 10,
                        },
                    },
                },
                statuses: new Set(), // Empty status set initially
                toggleStatusEffect: jest.fn().mockResolvedValue(true),
            });

            mockPC = createMockPc({
                system: {
                    attributes: {
                        hp: {
                            value: 10,
                            max: 10,
                        },
                    },
                },
                statuses: new Set(), // Empty status set initially
                toggleStatusEffect: jest.fn().mockResolvedValue(true),
            });

            // Mock console methods to avoid noise in tests
            console.log = jest.fn();
            console.debug = jest.fn();
            console.error = jest.fn();
        });

        describe("when setting is enabled", () => {
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
                expect(mockNPC.toggleStatusEffect).toHaveBeenCalledTimes(1);
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
            });

            it("should NOT apply dead status to NPC that already has dead status", async () => {
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
            });

            it("should apply dead status to NPC when HP goes below 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: -5, // HP goes negative
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
                expect(mockNPC.toggleStatusEffect).toHaveBeenCalledTimes(1);
            });
        });

        describe("when setting is disabled", () => {
            beforeEach(() => {
                // Override game settings to disable the feature
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

            it("should NOT apply dead status to NPC when feature is disabled", async () => {
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
            });
        });

        describe("error handling", () => {
            it("should handle errors gracefully when toggleStatusEffect fails", async () => {
                // Arrange
                const error = new Error("Status effect failed");
                mockNPC.toggleStatusEffect.mockRejectedValue(error);

                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0,
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act & Assert - should not throw
                await expect(
                    handleNPCDeathStatusUpdate(
                        mockNPC,
                        updateData,
                        options,
                        userId
                    )
                ).resolves.not.toThrow();

                // Verify error was logged
                expect(console.error).toHaveBeenCalledWith(
                    expect.stringContaining(
                        "Error applying status: dead to NPC"
                    ),
                    error
                );
            });
        });
    });
});
