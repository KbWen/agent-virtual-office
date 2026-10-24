// Owns only presentation resources. Rendering never writes to the source snapshot.
export function createCardPreviewRenderer({ render, createUrl, revokeUrl, createImageSource, onChange, onError }) {
  let revision = 0
  let disposed = false
  let currentUrl = null
  const release = () => {
    if (currentUrl) revokeUrl(currentUrl)
    currentUrl = null
  }
  return {
    async request(input) {
      if (disposed) return
      const ownRevision = ++revision
      release()
      onChange({ status: 'loading', url: null })
      try {
        const blob = await render(input)
        if (disposed || revision !== ownRevision) return
        const hasImageSource = typeof createImageSource === 'function'
        const imageUrl = hasImageSource ? await createImageSource(blob) : undefined
        if (disposed || revision !== ownRevision) return
        const candidateUrl = await createUrl(blob)
        if (disposed || revision !== ownRevision) {
          if (candidateUrl) revokeUrl(candidateUrl)
          return
        }
        currentUrl = candidateUrl
        const ready = { status: 'ready', url: currentUrl }
        if (hasImageSource) ready.imageUrl = imageUrl
        onChange(ready)
      } catch {
        const stale = disposed || revision !== ownRevision
        onError({ stage: 'render', stale })
        if (!stale) onChange({ status: 'error', url: null })
      }
    },
    dispose() {
      disposed = true
      revision++
      release()
    },
  }
}

// Blob URLs are blocked by the app's restrictive img-src CSP. A data URL is local,
// self-contained, and already allowed for the postcard preview image.
export function blobToDataUrl(blob) {
  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('FileReader is unavailable'))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        resolve(reader.result)
      } else {
        reject(new Error('FileReader returned no data URL'))
      }
    }
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
    reader.onabort = () => reject(new Error('FileReader aborted'))
    reader.readAsDataURL(blob)
  })
}
