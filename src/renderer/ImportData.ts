import { isPushpinUrl, PushpinUrl } from './ShareLink'
import * as ContentTypes from './ContentTypes'
import * as ContentData from './ContentData'

// TODO: Convert these functions to be async rather than accepting a callback.
export type CreatedContentCallback = (contentUrl: PushpinUrl, index: number) => void

export async function importDataTransfer(
  dataTransfer: DataTransfer,
  callback: CreatedContentCallback
) {
  const url = dataTransfer.getData('application/pushpin-url')
  if (url) {
    callback(url as PushpinUrl, 0)
    return
  }

  if (dataTransfer.files.length > 0) {
    importFileList(dataTransfer.files, callback)
    return
  }
  // If we can identify html that's a simple image, import the image.
  const html = dataTransfer.getData('text/html')
  if (html) {
    importImagesFromHTML(html, callback)
  }

  // If we can't get the item as a bunch of files, let's hope it works as plaintext.
  const plainText = dataTransfer.getData('text/plain')
  if (plainText) {
    importPlainText(plainText, (contentUrl: PushpinUrl) => callback(contentUrl, 0))
  }
}

export function importFileList(files: FileList, callback: CreatedContentCallback) {
  /* Adapted from:
    https://www.meziantou.net/2017/09/04/upload-files-and-directories-using-an-input-drag-and-drop-or-copy-and-paste-with */
  const { length } = files
  // fun fact: as of this writing, onDrop dataTransfer doesn't support iterators, but onPaste does
  // hence the oldschool iteration code
  for (let i = 0; i < length; i += 1) {
    const file = files[i]
    ContentTypes.createFrom(ContentData.fromFile(file), (url) => callback(url, i))
  }
}

function importImagesFromHTML(html: string, callback: CreatedContentCallback) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', '')
  try {
    document.body.appendChild(iframe)
    iframe.contentDocument!.documentElement.innerHTML = html
    const images = iframe.contentDocument!.getElementsByTagName('img')
    if (images.length > 0) {
      importUrl(images[0].src, (contentUrl: PushpinUrl) => callback(contentUrl, 0))
    }
  } finally {
    iframe.remove()
  }
}

/**
 * Import plain text into pushpin.
 * The text may represent a url, in which case we want to attempt to create a more specific
 * content type, depending on what the url represents.
 *
 * If the text is a pushpin url, invoke the callback to turn the text into a card.
 * NOTE: this code should not know about cards - what is this really doing?
 */
export function importPlainText(plainText: string, callback: ContentTypes.CreateCallback) {
  if (isPushpinUrl(plainText)) {
    callback(plainText)
  } else if (isUrl(plainText)) {
    importUrl(plainText, callback)
  } else {
    ContentTypes.createFrom(ContentData.fromString(plainText), callback)
  }
}

function isUrl(str: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const url = new URL(str)
    return true
  } catch {
    return false
  }
}

/**
 * Import content from a url.
 * Attempts to fetch the contents of the url and create a more specific content type
 * based on the response (e.g. a pdf or a jpg). If there response is html or the request fails,
 * fall back to creating url content.
 *
 * TODO: This doesn't feel like the right place to be making mime type content decisions.
 * That should be happening in ContentTypes.createFrom.
 *
 * TODO: Can we use the 'text/uri-list' mime type to use createFrom for creating urls?
 * Notably, there is some precedent for this: https://html.spec.whatwg.org/multipage/dnd.html#dom-datatransfer-types
 * Alternatively, we could use something like 'text/vnd.pushpin.url'.
 */
async function importUrl(url: string, callback: ContentTypes.CreateCallback) {
  const response = await fetchOk(url)
  if (!response) {
    ContentTypes.create('url', { url }, callback)
    return
  }
  const mimeType = response.headers.get('Content-Type') || 'application/octet-stream'
  if (mimeType.includes('text/html')) {
    ContentTypes.create('url', { url }, callback)
    return
  }
  const contentData: ContentData.ContentData = {
    name: url, // XXX: This mimics the legacy behavior of creating a blob and file.
    mimeType,
    data: response.body!, // XXX: I believe this is ok. I think response.body is only null if !response.ok
  }
  ContentTypes.createFrom(contentData, callback)
}

async function fetchOk(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url)
    return response.ok ? response : null
  } catch {
    return null
  }
}
