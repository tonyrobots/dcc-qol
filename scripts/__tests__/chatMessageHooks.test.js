/* globals jest, describe, it, expect, game, $, beforeEach */

import { enhanceAttackRollCard } from "../hooks/chatMessageHooks.js";
import { createMockPc, mockMeleeWeapon } from "../__mocks__/mock-data.js";
import * as utils from "../utils.js";

// Mock the dcc-qol module to provide a mock socket
jest.mock("../dcc-qol.js", () => ({
    socket: {
        executeAsGM: jest.fn(),
    },
}));

describe("Chat Message Hooks", () => {
    describe("enhanceAttackRollCard", () => {
        let mockPC;
        let mockMessage;
        let html;
        let mockWeaponProperties;

        beforeEach(() => {
            // Clear all mocks before each test
            jest.clearAllMocks();

            // Create fresh mocks before each test
            mockPC = createMockPc();
            mockWeaponProperties = ["Melee", "One-handed"];

            mockMessage = {
                _id: "test-message-id",
                id: "test-message-id", // Add this for messageId consistency
                flags: {
                    dccqol: {
                        isAttackRoll: true,
                        weaponId: mockMeleeWeapon._id,
                        hitsTarget: true,
                        target: "Test Goblin",
                        tokenName: "Test PC",
                        isCrit: false,
                        isFumble: false,
                        isBackstab: false,
                        damageWasAutomated: false,
                    },
                },
                system: {
                    damageRollFormula: mockMeleeWeapon.system.damage,
                },
                getFlag: jest.fn((scope, flag) => {
                    return mockMessage.flags?.[scope]?.[flag];
                }),
                getSpeakerActor: jest.fn().mockReturnValue(mockPC),
                rolls: [
                    {
                        render: jest
                            .fn()
                            .mockResolvedValue(
                                '<div class="dice-roll">Attack Roll HTML</div>'
                            ),
                        toAnchor: jest.fn().mockReturnValue({
                            outerHTML:
                                '<a class="inline-roll">Attack Roll Anchor</a>',
                        }),
                    },
                ],
                speaker: {
                    actor: mockPC._id,
                    token: "mock-token-id",
                },
                content: "Original message content",
            };

            // Create mock HTML structure representing a Foundry chat message
            html = document.createElement("li");
            html.classList.add("message");

            const messageHeader = document.createElement("div");
            messageHeader.classList.add("message-header");
            html.appendChild(messageHeader);

            const messageContent = document.createElement("div");
            messageContent.classList.add("message-content");
            messageContent.innerHTML = "Original DCC system content";
            html.appendChild(messageContent);

            // Mock game settings and user
            game.settings.get.mockImplementation((module, setting) => {
                if (setting === "useQoLAttackCard") return true;
                if (setting === "attackCardFormat") return "standard";
                return true;
            });
            game.user.isGM = true;

            // Mock utility functions that the main function depends on
            global.getWeaponProperties = jest
                .fn()
                .mockResolvedValue(mockWeaponProperties);
            jest.spyOn(utils, "getWeaponFromActorById").mockReturnValue(
                mockMeleeWeapon
            );
        });

        describe("Template Data Preparation", () => {
            it("should prepare correct template data from message flags and actor data", async () => {
                // Arrange
                const expectedTemplateData = expect.objectContaining({
                    isAttackRoll: true,
                    hitsTarget: true,
                    target: "Test Goblin",
                    tokenName: "Test PC",
                    actor: mockPC,
                    weapon: mockMeleeWeapon,
                    properties: expect.any(Array), // Don't be too specific about properties
                    messageId: "test-message-id",
                    attackCardFormat: "standard",
                    canUserModify: true,
                    isGM: true,
                    damageWasAutomated: false,
                    // Include other expected fields that are added by the function
                    diceHTML: expect.any(String),
                    weaponId: mockMeleeWeapon._id,
                });

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(renderTemplate).toHaveBeenCalledWith(
                    "modules/dcc-qol/templates/attackroll-card.html",
                    expectedTemplateData
                );
            });

            it("should use compact template when attackCardFormat is compact", async () => {
                // Arrange
                game.settings.get.mockImplementation((module, setting) => {
                    if (setting === "attackCardFormat") return "compact";
                    return true;
                });

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(renderTemplate).toHaveBeenCalledWith(
                    "modules/dcc-qol/templates/attackroll-card-compact.html",
                    expect.any(Object)
                );
            });

            it("should include dice HTML from roll render for standard format", async () => {
                // Arrange
                game.settings.get.mockImplementation((module, setting) => {
                    if (setting === "attackCardFormat") return "standard";
                    return true;
                });

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(mockMessage.rolls[0].render).toHaveBeenCalled();
                expect(renderTemplate).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        diceHTML:
                            '<div class="dice-roll">Attack Roll HTML</div>',
                    })
                );
            });

            it("should include dice HTML from toAnchor for compact format", async () => {
                // Arrange
                game.settings.get.mockImplementation((module, setting) => {
                    if (setting === "attackCardFormat") return "compact";
                    return true;
                });

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(mockMessage.rolls[0].toAnchor).toHaveBeenCalled();
                expect(renderTemplate).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        diceHTML:
                            '<a class="inline-roll">Attack Roll Anchor</a>',
                    })
                );
            });
        });

        describe("DOM Manipulation and Event Binding", () => {
            it("should replace message content with rendered template HTML", async () => {
                // Arrange
                const fixtureHTML = `
                    <div class="dccqol chat-card">
                        <div class="roll-result status-success">Attack hits Test Goblin!</div>
                        <button data-action="damage">Roll Damage</button>
                    </div>
                `;
                renderTemplate.mockResolvedValue(fixtureHTML);
                const originalContent =
                    html.querySelector(".message-content").innerHTML;

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                const messageContent = html.querySelector(".message-content");
                expect(messageContent.innerHTML).not.toBe(originalContent);
                expect(messageContent.innerHTML).toContain("dccqol chat-card");
                expect(
                    messageContent.querySelector(".roll-result")
                ).not.toBeNull();
            });

            it("should attach click event listener to damage button", async () => {
                // Arrange
                const fixtureHTML = `
                    <div class="dccqol chat-card">
                        <button data-action="damage" class="damage-button">Roll Damage</button>
                    </div>
                `;
                renderTemplate.mockResolvedValue(fixtureHTML);

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                const damageButton = html.querySelector(
                    'button[data-action="damage"]'
                );
                expect(damageButton).not.toBeNull();

                // Verify event listener was attached (jQuery style)
                const $damageButton = $(damageButton);
                const events = $._data(damageButton, "events");
                expect(events).toBeDefined();
                expect(events.click).toBeDefined();
            });

            it("should modify message header by removing flavor text and adding custom class", async () => {
                // Arrange
                const messageHeader = html.querySelector(".message-header");
                const flavorSpan = document.createElement("span");
                flavorSpan.classList.add("flavor-text");
                flavorSpan.textContent = "Original flavor text";
                messageHeader.appendChild(flavorSpan);

                const senderH4 = document.createElement("h4");
                senderH4.classList.add("message-sender");
                senderH4.textContent = "Test PC";
                messageHeader.appendChild(senderH4);

                const fixtureHTML =
                    '<div class="dccqol chat-card">Mock content</div>';
                renderTemplate.mockResolvedValue(fixtureHTML);

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(
                    messageHeader.querySelector("span.flavor-text")
                ).toBeNull();
                expect(senderH4.classList.contains("dccqol-speaker-name")).toBe(
                    true
                );
            });
        });

        describe("Conditional Behavior", () => {
            it("should not enhance card when QoL flags are missing", async () => {
                // Arrange
                mockMessage.flags = {}; // No dccqol flags

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(renderTemplate).not.toHaveBeenCalled();
            });

            it("should not enhance card when useQoLAttackCard setting is disabled", async () => {
                // Arrange
                game.settings.get.mockImplementation((module, setting) => {
                    if (setting === "useQoLAttackCard") return false;
                    return true;
                });

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                expect(renderTemplate).not.toHaveBeenCalled();
            });

            it("should exit gracefully if weapon not found", async () => {
                // Arrange
                const consoleErrorSpy = jest
                    .spyOn(console, "error")
                    .mockImplementation(() => {});
                utils.getWeaponFromActorById.mockReturnValueOnce(null);

                // Act & Assert
                // It should not throw an error, and should not render the template
                await expect(
                    enhanceAttackRollCard(mockMessage, $(html), {})
                ).resolves.toBeUndefined();
                expect(renderTemplate).not.toHaveBeenCalled();
                expect(consoleErrorSpy).not.toHaveBeenCalled();

                // Cleanup
                consoleErrorSpy.mockRestore();
            });
        });

        describe("Integration with Hit/Miss/Crit Status", () => {
            const neutralFixtureHTML = `
                <div class="dccqol chat-card">
                    <div class="dice-roll">
                        <span class="dice-total">15</span>
                    </div>
                </div>
            `;

            beforeEach(() => {
                // Return a neutral fixture that the function can modify
                renderTemplate.mockResolvedValue(neutralFixtureHTML);
                // Ensure flags are in a neutral state before each test in this block
                mockMessage.flags.dccqol.isCrit = false;
                mockMessage.flags.dccqol.isFumble = false;
                mockMessage.flags.dccqol.hitsTarget = true; // Default to hit
            });

            it("should add status-success class to dice total for successful hits", async () => {
                // Arrange
                mockMessage.flags.dccqol.hitsTarget = true;

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                const diceTotal = html.querySelector(".dice-total");
                expect(diceTotal).not.toBeNull();
                expect(diceTotal.classList.contains("status-success")).toBe(
                    true
                );
            });

            it("should add status-failure class to dice total for missed attacks", async () => {
                // Arrange
                mockMessage.flags.dccqol.hitsTarget = false;

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                const diceTotal = html.querySelector(".dice-total");
                expect(diceTotal).not.toBeNull();
                expect(diceTotal.classList.contains("status-failure")).toBe(
                    true
                );
            });

            it("should add critical class to dice total for a critical hit", async () => {
                // Arrange
                mockMessage.flags.dccqol.isCrit = true;

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                const diceTotal = html.querySelector(".dice-total");
                expect(diceTotal).not.toBeNull();
                expect(diceTotal.classList.contains("critical")).toBe(true);
            });

            it("should add fumble class to dice total for a fumble", async () => {
                // Arrange
                mockMessage.flags.dccqol.isFumble = true;

                // Act
                await enhanceAttackRollCard(mockMessage, $(html), {});

                // Assert
                const diceTotal = html.querySelector(".dice-total");
                expect(diceTotal).not.toBeNull();
                expect(diceTotal.classList.contains("fumble")).toBe(true);
            });
        });
    });
});
