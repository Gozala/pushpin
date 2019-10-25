import * as path from 'path'
import React, { useEffect, useState } from 'react'
import Unfluff from 'unfluff'
import Debug from 'debug'
import { IpcMessageEvent } from 'electron'

import { Handle, HyperfileUrl } from 'hypermerge'
import { Header } from 'hypermerge/dist/FileStore'
import * as Hyperfile from '../../hyperfile'
import ContentTypes from '../../ContentTypes'
import { ContentProps } from '../Content'
import { ChangeFn, useDocument, useEvent } from '../../Hooks'
import { HypermergeUrl } from '../../ShareLink'
import './UrlContent.css'
import SecondaryText from '../SecondaryText'
import Badge from '../Badge'
import Heading from '../Heading'
import { APP_PATH } from '../../constants'
import * as ContentData from '../../ContentData'

const log = Debug('pushpin:url')

interface UrlData {
  title?: string
  image?: string
  description?: string
  canonicalLink?: string
}

interface UrlDoc {
  url: string
  data?: UrlData | { error: string } // TODO: move error to top-level
  htmlHyperfileUrl?: HyperfileUrl
  imageHyperfileUrl?: HyperfileUrl
  capturedAt?: string
}

UrlContent.minWidth = 9
UrlContent.minHeight = 9
UrlContent.defaultWidth = 12
// UrlContent.defaultHeight = 18
UrlContent.maxWidth = 24
UrlContent.maxHeight = 32

export default function UrlContent(props: ContentProps) {
  const [doc, changeDoc] = useRefreshedDocument(props.hypermergeUrl)
  const [webview, setWebview] = useState<HTMLWebViewElement | null>(null)

  useEvent(webview, 'ipc-message', ({ channel, args }: IpcMessageEvent) => {
    if (channel !== 'freeze-dry') return

    const [hyperfileUrl] = args as [HyperfileUrl]
    changeDoc((doc) => {
      doc.htmlHyperfileUrl = hyperfileUrl
      doc.capturedAt = new Date().toISOString()
    })
  })

  useEvent(webview, 'dom-ready', () => {
    console.log('dom-ready', webview)
    doc &&
      !doc.htmlHyperfileUrl &&
      webview &&
      (webview as any).send('freeze-dry', { type: 'Ready' })
  })

  useEvent(webview, 'console-message', ({ message }: { message: string }) => {
    console.log('webview.log:', message) // eslint-disable-line
  })

  if (!doc) {
    return null
  }

  function refreshContent() {
    changeDoc((doc) => {
      delete doc.htmlHyperfileUrl
      delete doc.capturedAt
    })
  }
  const { data, url, htmlHyperfileUrl, capturedAt } = doc

  if (!data) {
    return (
      <div className="UrlCard">
        <p className="UrlCard-title">Fetching...</p>
        <p className="UrlCard-link">
          <a className="UrlCard-titleAnchor" href={url}>
            {url}
          </a>
        </p>
      </div>
    )
  }

  if ('error' in data) {
    return (
      <div className="UrlCard">
        <p className="UrlCard-error">(URL did not load.)</p>
        <p className="UrlCard-link">
          <a className="UrlCard-titleAnchor" href={url}>
            {url}
          </a>
        </p>
      </div>
    )
  }

  if (props.context === 'workspace') {
    return (
      <div className="UrlCardWorkspace">
        <div className="UrlCard-info">
          {capturedAt ? (
            <span>
              Captured:{' '}
              {new Date(capturedAt).toLocaleString(undefined, {
                dateStyle: 'long',
                timeStyle: 'short',
              } as any)}
            </span>
          ) : null}
        </div>
        <div className="UrlCard UrlCard--workspace">
          {htmlHyperfileUrl ? (
            <webview className="UrlCard-webview" title={data.title} src={htmlHyperfileUrl} />
          ) : (
            <webview
              ref={setWebview}
              className="UrlCard-webview"
              title={data.title}
              src={data.canonicalLink || url}
              preload={`file://${path.resolve(APP_PATH, 'dist/freeze-dry-preload.js')}`}
            />
          )}
        </div>
        <div className="UrlCard-buttons">
          <a
            className="UrlCard-iconLink"
            title="Open in browser..."
            href={data.canonicalLink || url}
          >
            <i className="fa fa-external-link" />
          </a>
          {htmlHyperfileUrl ? (
            <a className="UrlCard-iconLink" title="Capture Again" href="#" onClick={refreshContent}>
              <i className="fa fa-refresh" />
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="UrlCard">
      {doc.imageHyperfileUrl ? (
        <img className="UrlCard-img" src={doc.imageHyperfileUrl} alt={data.description} />
      ) : null}

      <p className="UrlCard-title">
        <span className="titleAnchor">{data.title}</span>
      </p>

      <p className="UrlCard-text">{data.description}</p>
      <p className="UrlCard-link">
        <span className="UrlCard-titleAnchor">
          <a href={data.canonicalLink || url}>{data.canonicalLink || url}</a>
        </span>
      </p>
    </div>
  )
}

function useRefreshedDocument(url: HypermergeUrl): [null | UrlDoc, ChangeFn<UrlDoc>] {
  const [doc, change] = useDocument<UrlDoc>(url)

  useEffect(() => {
    if (doc) {
      refreshContent(doc, change)
    }
  }, [change, doc])

  useEffect(() => {
    if (doc) {
      refreshImageContent(doc, change)
    }
  }, [change, doc])

  return [doc, change]
}

function refreshContent(doc: UrlDoc, change: ChangeFn<UrlDoc>) {
  if (!doc.url || doc.data) {
    return
  }

  // XXX TODO: this stuff should be part of the freeze-dry cycle
  unfluffUrl(doc.url)
    .then((data) => {
      change((doc: UrlDoc) => {
        removeEmpty(data)
        doc.data = data
      })
    })
    .catch((reason) => {
      log('refreshContent.caught', reason)
      change((doc: UrlDoc) => {
        doc.data = { error: reason }
      })
    })
}

function refreshImageContent(doc: UrlDoc, change: ChangeFn<UrlDoc>) {
  if (doc.imageHyperfileUrl) {
    return
  }

  if (!doc.data || !('image' in doc.data)) {
    return
  }

  const { image } = doc.data

  if (!image) {
    return
  }

  importImageUrl(image).then(({ url }: Header) => {
    change((doc: UrlDoc) => {
      doc.imageHyperfileUrl = url
    })
  })
}

function unfluffUrl(url: string): Promise<UrlData> {
  return fetch(url)
    .then((response) => response.text())
    .then<UrlData>(Unfluff)
    .then((data) => {
      removeEmpty(data)

      if (data.image) {
        data.image = new URL(data.image, url).toString()
      }

      return data
    })
}

function importImageUrl(url: string): Promise<Header> {
  return fetch(url).then((response) => {
    if (!response.body) {
      throw new Error('image fetch failed')
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    return Hyperfile.write(response.body, contentType)
  })
}

function removeEmpty(obj: object) {
  Object.entries(obj).forEach(([key, val]) => {
    if (val && typeof val === 'object') {
      removeEmpty(val)
    } else if (val == null) {
      delete obj[key]
    }
  })
}

/**
 * Assumes we are creating from a content data object with mimetype equal to 'text/html'.
 * This function should also probably handle a mimeType equal to 'text/uri-list'.
 */
async function createFrom(contentData: ContentData.ContentData, handle: Handle<UrlDoc>, callback) {
  // Yikes. We need to decode the encoded html. This needs to be rethought to be more
  // ergonomic.
  const { url } = await Hyperfile.write(
    contentData.data.pipeThrough(
      new window.TransformStream({
        start() {},
        transform(chunk, controller) {
          controller.enqueue(decodeURIComponent(chunk))
        },
      })
    ),
    contentData.mimeType
  )
  handle.change((doc) => {
    doc.url = contentData.src! // TODO: we need per-content typing on ContentData
    doc.htmlHyperfileUrl = url
  })
  callback()
}

function create({ url, src, hyperfileUrl, capturedAt }, handle: Handle<UrlDoc>, callback) {
  handle.change((doc) => {
    doc.url = url || src
    if (hyperfileUrl) {
      doc.htmlHyperfileUrl = hyperfileUrl
    }
    if (capturedAt) {
      doc.capturedAt = capturedAt
    }
  })
  callback()
}

function UrlContentInList(props: ContentProps) {
  const [doc] = useDocument<UrlDoc>(props.hypermergeUrl)
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/pushpin-url', props.url)
  }

  if (!doc) return null

  const { data, url } = doc

  return (
    <div className="UrlListItem">
      <span draggable onDragStart={onDragStart}>
        <Badge icon="chain" />
      </span>
      {doc.imageHyperfileUrl ? (
        <img
          className="UrlListItem-icon"
          src={doc.imageHyperfileUrl}
          alt={data && !('error' in data) ? data.description : ''}
        />
      ) : null}

      <div className="UrlListItem-title">
        {data && !('error' in data) && data.title ? (
          <>
            <Heading>{data.title}</Heading>
            <SecondaryText>
              <a href={data.canonicalLink || url}>{data.canonicalLink || url}</a>
            </SecondaryText>
          </>
        ) : (
          <Heading>{url}</Heading>
        )}
      </div>
    </div>
  )
}
ContentTypes.register({
  type: 'url',
  name: 'URL',
  icon: 'chain',
  contexts: {
    workspace: UrlContent,
    board: UrlContent,
    list: UrlContentInList,
  },
  create,
  createFrom,
  unlisted: true,
})
