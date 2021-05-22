declare const Zotero: any
declare const ZoteroPane: any
declare const OS: any

// TODO do this in mas.ts
const DATA_JSON_NAME = 'MASMetaData.json'

export function loadURI(uri) {
  Zotero.getActiveZoteroPane().loadURI(uri)
}

/**
 * read/write data
 */

function getDataItems(parent) {
  const attchIds = parent.getAttachments()
  const masAttchs = []
  attchIds.forEach(id => {
    const attchItem = Zotero.Items.get(id)
    if (attchItem.getDisplayTitle() === DATA_JSON_NAME) {
      masAttchs.push(attchItem)
    }
  })
  return masAttchs
}

export function getData(item) {
  const masAttchs = getDataItems(item)
  if (masAttchs.length === 0) return null // TODO: make these return more expressive
  const masFile = masAttchs[0].getFilePath()
  try {
    const masString = Zotero.File.getContents(masFile)
    const masData = JSON.parse(masString)
    return masData
  } catch {
    return null // TODO: make this better maybe async
  }
}

export function getValueWithKeyString(object: object, keyString: string): any {
  if (object === null) {
    return null
  }
  const nestedKeys = keyString.split('.')
  let value = object
  nestedKeys.forEach(key => {
    value = value[key]
  })
  return value
}

export async function setData(item, masData) {
  const masAttchs = getDataItems(item)
  try {
    await Zotero.DB.executeTransaction(async () => {
      if (masAttchs.length) {
        // write old file
        const masItem = masAttchs[0]
        await Zotero.File.putContentsAsync(masItem.getFilePath(), JSON.stringify(masData), masItem.attachmentCharset)
      } else {
        // create new file
        const masName = DATA_JSON_NAME
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

export async function removeData(item) {
  const masAttchs = getDataItems(item)
  for (const masAttch of masAttchs) {
    await masAttch.eraseTx()
  }
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
