declare const Zotero: any
declare const OS: any

export function loadURI(uri) {
  Zotero.getActiveZoteroPane().loadURI(uri)
}

/**
 * read/write data
 */

function getAttachmentsWithName(parent, fileName: string): any {
  const attachmentIds = parent.getAttachments()
  const attachment = []
  attachmentIds.forEach(id => {
    const attachmentItem = Zotero.Items.get(id)
    if (attachmentItem.getDisplayTitle() === fileName) {
      attachment.push(attachmentItem)
    }
  })
  return attachment
}

export function getData(item, fileName: string): any {
  const attachments = getAttachmentsWithName(item, fileName)
  if (attachments.length === 0) return null // TODO: makes these return more expressive
  const file = attachments[0].getFilePath()
  try {
    const dataString = Zotero.File.getContents(file)
    const data = JSON.parse(dataString)
    return data
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

export async function setData(item, data: object, fileName: string) {
  const attachments = getAttachmentsWithName(item, fileName)
  try {
    await Zotero.DB.executeTransaction(async () => {
      if (attachments.length) {
        // write old file
        const attachment = attachments[0]
        await Zotero.File.putContentsAsync(attachment.getFilePath(), JSON.stringify(data), attachment.attachmentCharset)
      } else {
        // create new file
        const attachment = new Zotero.Item('attachment')
        attachment.setField('title', fileName)
        attachment.parentKey = item.key
        attachment.attachmentLinkMode = 'imported_file'
        attachment.attachmentCharset = ''
        await attachment.save()
        const destDir = await Zotero.Attachments.createDirectoryForItem(attachment)
        const path = OS.Path.join(destDir, fileName)
        await Zotero.File.putContentsAsync(path, JSON.stringify(data), attachment.attachmentCharset)
        attachment.attachmentContentType = 'application/json'
        attachment.attachmentPath = path
        await attachment.save()
      }
    })
  } catch (error) {
    Zotero.logError(error)
  }
}

export async function removeData(item, fileName: string) {
  const attachments = getAttachmentsWithName(item, fileName)
  for (const attachment of attachments) {
    await attachment.eraseTx()
  }
}

/**
 * preference management
 */

export function getPref(pref: string): any {
  return Zotero.Prefs.get('extensions.mas-metadata.' + pref, true)
}

export function setPref(pref: string, value: any) {
  return Zotero.Prefs.set('extensions.mas-metadata.' + pref, value, true)
}

export function clearPref(pref: string) {
  return Zotero.Prefs.clear('extensions.mas-metadata.' + pref, true)
}
