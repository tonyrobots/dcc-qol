/* globals jest, describe, it, expect, game, $, beforeEach */

import { enhanceAttackRollCard } from "../hooks/chatMessageHooks.js";
import { createMockPc, mockMeleeWeapon } from "../__mocks__/mock-data.js";

// Mock the dcc-qol module to provide a mock socket
jest.mock("../dcc-qol.js", () => ({
    socket: {
        executeAsGM: jest.fn(),
    },
}));

describe("Chat Message Hooks", () => {
    describe("QoL Attack Roll Card", () => {
        let mockPC;
        let mockMessage;
        let html;

        beforeEach(async () => {
            // 1. Create a fresh mock PC and mock message before each test
            mockPC = createMockPc();
            mockMessage = {
                _id: "test-message-id",
                isAuthor: true,
                flags: {
                    dccqol: {
                        isAttackRoll: true,
                        weaponId: mockMeleeWeapon._id,
                        hitsTarget: true,
                    },
                },
                system: {
                    damageRollFormula: mockMeleeWeapon.system.damage,
                },
                getFlag: (scope, flag) => {
                    return mockMessage.flags?.[scope]?.[flag];
                },
                getSpeakerActor: jest.fn().mockReturnValue(mockPC),
                rolls: [
                    {
                        render: jest
                            .fn()
                            .mockResolvedValue("<div>Rendered Roll</div>"),
                        toAnchor: jest.fn().mockReturnValue({
                            outerHTML: "<a>Rendered Roll</a>",
                        }),
                    },
                ],
                speaker: {
                    actor: mockPC._id,
                },
                content: "Original message content",
            };

            // 2. Mock game settings and user
            game.settings.get.mockReturnValue(true);
            game.user.isGM = true;

            // 3. Create mock HTML structure
            html = document.createElement("div");
            const messageContent = document.createElement("div");
            messageContent.classList.add("message-content");
            html.appendChild(messageContent);

            // 4. Mock the template rendering and generate the card HTML
            renderTemplate.mockResolvedValue(
                '<button data-action="damage">Roll Damage</button>'
            );
            await enhanceAttackRollCard(mockMessage, $(html), {});
        });

        describe("Roll Damage", () => {
            it("should display a 'Roll Damage' button on a successful hit", () => {
                // Assert
                const button = html.querySelector(
                    'button[data-action="damage"]'
                );
                expect(button).not.toBeNull();
                expect(button.textContent).toContain("Roll Damage");
            });

            it("should roll the correct damage formula when the damage button is clicked", async () => {
                // Arrange
                // Clear any previous mock calls
                global.rollToMessageMock.mockClear();

                // Act
                const button = html.querySelector(
                    'button[data-action="damage"]'
                );
                $(button).trigger("click");

                // Allow async operations to complete
                await new Promise((resolve) => setTimeout(resolve, 0));

                // Assert
                // Verify that the roll is sent to chat
                expect(global.rollToMessageMock).toHaveBeenCalledTimes(1);
                // Verify that the flavor text includes the weapon's name
                expect(global.rollToMessageMock).toHaveBeenCalledWith(
                    expect.objectContaining({
                        flavor: expect.stringContaining(mockMeleeWeapon.name), // 'Sword'
                    })
                );
            });
        });
    });
});
