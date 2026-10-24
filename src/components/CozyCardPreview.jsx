import React, { useEffect, useId, useRef, useState } from 'react'
import { t, useLocale } from '../i18n'
import { CARD_STICKERS, renderDailyCard } from '../systems/dailyCard.js'
import { blobToDataUrl, createCardPreviewRenderer } from './cozyCardPreview.js'
import { cozyButtonClass, cozyPopoverClass, useCozyPopover } from './useCozyPopover.js'

const stickerLabels = { none: ['cozy.stickerNone', 'None'], plant: ['cozy.stickerPlant', 'Plant'], cat: ['cozy.stickerCat', 'Cat'] }

export default function CozyCardPreview({ input, onClose, reducedMotion = false }) {
  useLocale()
  const titleId = useId()
  const closeRef = useCozyPopover(onClose)
  const [sticker, setSticker] = useState('none')
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState({ status: 'loading', url: null })
  const [downloadError, setDownloadError] = useState(false)
  const rendererRef = useRef(null)
  useEffect(() => {
    const renderer = createCardPreviewRenderer({
      render: renderDailyCard,
      createUrl: blob => URL.createObjectURL(blob),
      createImageSource: blob => blobToDataUrl(blob),
      revokeUrl: url => URL.revokeObjectURL(url),
      onChange: setPreview,
      onError: context => console.warn('[Office] Cozy postcard preview failed', context),
    })
    rendererRef.current = renderer
    return () => { renderer.dispose(); rendererRef.current = null }
  }, [])
  useEffect(() => {
    setDownloadError(false)
    rendererRef.current.request({ ...input, sticker })
  }, [input, sticker, attempt])

  const download = () => {
    if (preview.status !== 'ready') return
    const link = document.createElement('a')
    try {
      link.href = preview.url
      link.download = `office-${input.dayKey || 'postcard'}.png`
      document.body.appendChild(link)
      link.click()
      setDownloadError(false)
    } catch {
      console.warn('[Office] Cozy postcard local download failed', { stage: 'download' })
      setDownloadError(true)
    } finally {
      link.remove()
    }
  }
  return (
    <section role="dialog" aria-modal="false" aria-labelledby={titleId} className={cozyPopoverClass}
      style={{ width: 'min(480px, calc(100vw - 24px))', animation: reducedMotion ? 'none' : 'cozy-card-lift 180ms ease-out' }} data-cozy-card="true">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-sm font-semibold">{t('cozy.cardTitle', 'Your office postcard')}</h2>
        <button type="button" ref={closeRef} onClick={onClose} className={cozyButtonClass}
          aria-label={t('cozy.close', 'Close')}>×</button>
      </div>
      <div className="mt-3 flex min-h-24 items-center justify-center rounded-lg bg-stone-100 p-2 dark:bg-stone-800" aria-busy={preview.status === 'loading'}>
        {preview.status === 'loading' && <p role="status" className="py-8 text-sm">{t('cozy.cardLoading', 'Making your postcard…')}</p>}
        {preview.status === 'error' && <div role="alert" className="py-4 text-center">
          <p className="mb-3 text-sm">{t('cozy.cardError', 'The postcard could not be made. Please try again.')}</p>
          <button type="button" className={cozyButtonClass} onClick={() => setAttempt(value => value + 1)}>{t('cozy.retry', 'Try again')}</button>
        </div>}
        {preview.status === 'ready' && <img src={preview.imageUrl || preview.url} alt={t('cozy.cardAlt', 'Office postcard preview')}
          onError={() => {
            console.warn('[Office] Cozy postcard preview image failed', { stage: 'image' })
            setPreview(current => current === preview
              ? { status: 'error', url: null }
              : current)
          }}
          className="block h-auto max-w-full rounded-lg" style={{ maxHeight: 'min(360px, 36dvh)', objectFit: 'contain' }} />}
      </div>
      <fieldset className="mt-3">
        <legend className="mb-2 text-xs text-stone-500 dark:text-stone-300">{t('cozy.decoration', 'Just a little decoration')}</legend>
        <div className="flex flex-wrap gap-2">
          {CARD_STICKERS.map(value => <label key={value} className={`${cozyButtonClass} flex cursor-pointer items-center gap-1.5 ${sticker === value ? 'bg-amber-100 dark:bg-stone-600' : ''}`}>
            <input type="radio" name={titleId} value={value} checked={sticker === value} onChange={() => {
              setPreview({ status: 'loading', url: null })
              setSticker(value)
            }} className="accent-amber-700" />
            {t(...stickerLabels[value])}
          </label>)}
        </div>
      </fieldset>
      {downloadError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{t('cozy.downloadError', 'The download could not start. Please try again.')}</p>}
      <button type="button" disabled={preview.status !== 'ready'} onClick={download}
        className={`${cozyButtonClass} mt-4 w-full disabled:cursor-wait disabled:opacity-50`}>{t('cozy.download', 'Download PNG')}</button>
    </section>
  )
}
