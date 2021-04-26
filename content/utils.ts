declare const Zotero: any
declare const ZoteroPane: any
declare const OS: any

// Zotero.MASMetaData.Utils = new function() {
//   this.loadURI = function(uri) {
//       ZoteroPane_Local.loadURI(uri);
//   };
// }

const MAS_METADATA_JSON_NAME = 'MASMetaData.json'

export function loadURI(uri) {
  ZoteroPane.getActiveZoteroPane().loadURI(uri)
}

/**
 * read/write data
 */

function getMASMetaDataItems(parent) {
  const attchIds = parent.getAttachments()
  const masAttchs = []
  attchIds.forEach(id => {
    const attchItem = Zotero.Items.get(id)
    if (attchItem.getDisplayTitle() === MAS_METADATA_JSON_NAME) {
      masAttchs.push(attchItem)
    }
    })
  return masAttchs
}

export function getMASMetaData(item) {
  const masAttchs = getMASMetaDataItems(item)
  if (masAttchs.length === 0) return {} // TODO: make these return more expressive
  const masFile = masAttchs[0].getFilePath()
  const masString = Zotero.File.getContents(masFile)
  try {
    const masData = JSON.parse(masString)
    return masData
  } catch (error) {
    Zotero.logError(error)
  }
  return {}
}

export async function setMASMetaData(item, masData) {
  const masAttchs = getMASMetaDataItems(item)
  try {
    await Zotero.DB.executeTransaction(async () => {
      if (masAttchs.length) {
        // write old file
        const masItem = masAttchs[0]
        await Zotero.File.putContentsAsync(masItem.getFilePath(), JSON.stringify(masData), masItem.attachmentCharset)
      } else {
        // create new file
        const masName = MAS_METADATA_JSON_NAME
        const masItem = new Zotero.Item('attachment')
        masItem.setField('title', masName)
        masItem.parentKey = item.key
        masItem.attachmentLinkMode = 'imported_file'
        masItem.attachmentCharset = ''
        await masItem.save()
        const destDir = await Zotero.Attachments.createDirectoryForItem(masItem)
        const masPath = OS.Path.join(destDir, masName)
        await Zotero.File.putContentsAsync(masPath, JSON.stringify(masData), masItem.attachmentCharset)
        masItem.attachmentContentType = 'application/json'
        masItem.attachmentPath = masPath
        await masItem.save()
      }
    })
  } catch (error) {
    Zotero.logError(error)
  }
}

export function removeMASMetaData(item) {
  const masAttchs = getMASMetaDataItems(item)
  masAttchs.forEach(masAttch => {
    masAttch.eraseTx()
  })
}

/**
 * preference managment
 */

export function getPref(pref) {
  return Zotero.Prefs.get('extensions.mas-metadata.' + pref, true)
}

export function setPref(pref, value) {
  return Zotero.Prefs.set('extensions.mas-metadata.' + pref, value, true)
}

export function clearPref(pref) {
  return Zotero.Prefs.clear('extensions.mas-metadata.' + pref, true)
}
