/* global canvas, game, Hooks, libWrapper, loadTemplates, ui */
import {
  registerSystemSettings
} from './settings.js'
import DCCQOL from './patch.js'
import * as chat from './chat.js'
export async function preloadTemplates() {
  const templatePaths = ['modules/dcc-qol/templates/attackroll-card.html']
  return loadTemplates(templatePaths)
}

function tokenForActorId(actorId) {
  const actor = game.actors.get(actorId)
  const allTokens = actor.getActiveTokens()
  if (allTokens.length === 1) return allTokens[0].document
  else {
    const controlled = canvas?.tokens?.controlled
    const filteredTokens = allTokens.filter(value => controlled.includes(value))
    if (filteredTokens.length === 1) return filteredTokens[0].document
    else {
      return undefined
    }
  }
}

function rollPatchedWeaponAttack(wrapped, ...args) {
  const actor = new DCCQOL(game.actors.get(this._id))
  const tokenD = tokenForActorId(actor._id)
  if (tokenD) {
    actor.rollWeaponAttack(args[0], args[1], tokenD)
  } else {
    return ui.notifications.warn(game.i18n.localize('DCC-QOL.ControlAToken'))
  }
}

function initPatching() {
  libWrapper.register('dcc-qol', 'game.dcc.DCCActor.prototype.rollWeaponAttack', rollPatchedWeaponAttack, 'MIXED')
}

Hooks.once('init', async function() {
  console.log('DCC-QOL | Initializing DCC-QOL.')
  if (!game.modules.get("lib-wrapper")?.active) {
    console.warn('DCC-QOL | libWrapper is NOT active exiting!')
    return ui.notifications.warn(game.i18n.localize('DCC-QOL.libwrapperWarning'))
  }
  await registerSystemSettings()
  preloadTemplates()
  initPatching()
  Hooks.on('renderChatLog', (app, html, data) => chat.addChatListeners(html))
})

Hooks.once('ready', async function() {
  if (!game.modules.get("lib-wrapper")?.active && game.user.isGM) {
    console.warn('DCC-QOL | libWrapper is NOT active exiting!')
    ui.notifications.warn(game.i18n.localize('DCC-QOL.libwrapperWarning'))
  }
})