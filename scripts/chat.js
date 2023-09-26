/* global game, fromUuidSync, Roll */

import DCCQOL from './patch.js'

export function addChatListeners (html) {
  html.on('click', '.card-buttons button', ChatCardAction)
  html.on('click', '.card-header', ChatCardToggleContent)
}

async function ChatCardToggleContent (event) {
  event.preventDefault()
  const header = event.currentTarget
  const card = header.closest('.chat-card')
  const content = card.querySelector('.card-content')
  content.style.display = content.style.display === 'none' ? 'block' : 'none'
}

async function ChatCardAction (event) {
  const button = event.currentTarget
  button.disabled = true
  const card = button.closest('.chat-card')
  const messageId = card.closest('.message').dataset.messageId
  const message = game.messages.get(messageId)
  const action = button.dataset.action
  button.disabled = false
  const actor = game.actors.get(card.dataset.actorId) || null
  const messagecreator = message._source.user

  if (game.user._id !== messagecreator && !game.user.isGM) return

  if (!actor) return

  const act = new game.dcc.DCCActor(actor)
  const DCCQOLactor = new DCCQOL(actor)

  const options = JSON.parse(card.dataset.options)
  const weapon = actor.items.get(card.dataset.weaponId)

  const targettokenId = card.dataset.targettokenId
  const targettoken = fromUuidSync(targettokenId)

  switch (action) {
    case 'damage':
      if (targettoken) game.user.updateTokenTargets([targettoken._id])
      const damageRollResult = await act.rollDamage(weapon, options)

      damageRollResult.roll.toMessage({
        user: game.user.id,
        speaker: {
          alias: actor.name
        },
        flavor: game.i18n.format('DCC-QOL.DamageRoll', {
          weapon: weapon.name
        }),
        flags: {
          'dcc.RollType': 'Damage',
          'dcc.ItemId': options.weaponId
        }
      })
      break
    case 'fumble':
      await act.rollFumble(options)
      break
    case 'crit':
      await DCCQOLactor.rollCritical(options, targettoken)
      break
    case 'friendlyFire':

      const roll = new Roll('d100')
      await roll.evaluate({
        async: true
      })

      const friendlyFire = await roll.render()
      let friendlyFireHTML

      if (roll._total >= 51) {
        const chatText = game.i18n.format('DCC-QOL.FriendlyFireSuccess', {
          weapon: weapon.name
        })
        friendlyFireHTML = friendlyFire.replace('dice-total', 'dice-total success') + `<div class="dccqol chat-card"><div class="chat-details"><div class="ff-result">${chatText}</div></div></div>`
      } else {
        const chatText = game.i18n.format('DCC-QOL.FriendlyFireFail', {
          weapon: weapon.name
        })
        friendlyFireHTML = friendlyFire.replace('dice-total', 'dice-total fail') + `<div class="dccqol chat-card"><div class="chat-details"><div class="ff-result">${chatText}</div></div></div>`
      }

      roll.toMessage({
        user: game.user.id,
        speaker: {
          alias: actor.name
        },
        flavor: game.i18n.localize('DCC-QOL.FriendlyFireCheck'),
        content: friendlyFireHTML,
        rollMode: game.settings.get('core', 'rollMode')
      })
      break
  }
}
