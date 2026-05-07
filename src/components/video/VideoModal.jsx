import React, { useState } from 'react'
import { X, Search, Link, Check, Loader2 } from 'lucide-react'
import { extractVideoId, getThumbnailUrl, getEmbedUrl, searchYouTube } from '../../utils/youtube'
import useAppStore from '../../store/useAppStore'

export default function VideoModal({ exercise, onSave, onClose }) {
  const { youtubeApiKey } = useAppStore()
  const [tab, setTab] = useState(exercise?.videoId ? 'watch' : 'paste')
  const [pasteUrl, setPasteUrl] = useState(exercise?.videoUrl || '')
  const [searchQuery, setSearchQuery] = useState(exercise?.name || '')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [watching, setWatching] = useState(false)
  const [watchVideoId, setWatchVideoId] = useState(exercise?.videoId || '')

  const handlePasteSave = () => {
    const id = extractVideoId(pasteUrl)
    if (!id) return
    onSave(pasteUrl, id, '')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    if (!youtubeApiKey) { setSearchError('Add your YouTube API key in Settings to enable search.'); return }
    setSearching(true)
    setSearchError('')
    try {
      const results = await searchYouTube(searchQuery, youtubeApiKey)
      setSearchResults(results)
    } catch (e) {
      setSearchError(e.message === 'NO_API_KEY' ? 'No API key set.' : e.message)
    }
    setSearching(false)
  }

  const handleSelectResult = (result) => {
    onSave(`https://www.youtube.com/watch?v=${result.id}`, result.id, result.title)
  }

  const previewId = extractVideoId(pasteUrl)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-bg-1 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-3">
          <div>
            <h2 className="font-bold text-white text-base">Form Video</h2>
            {exercise && <p className="text-xs text-txt-secondary">{exercise.name}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-3 text-txt-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-bg-3">
          {exercise?.videoId && (
            <TabBtn active={tab === 'watch'} onClick={() => setTab('watch')}>Watch</TabBtn>
          )}
          <TabBtn active={tab === 'paste'} onClick={() => setTab('paste')}>
            <Link size={14} className="inline mr-1.5" />Paste URL
          </TabBtn>
          <TabBtn active={tab === 'search'} onClick={() => setTab('search')}>
            <Search size={14} className="inline mr-1.5" />Search
          </TabBtn>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Watch tab */}
          {tab === 'watch' && exercise?.videoId && (
            <div className="aspect-video w-full">
              <iframe
                src={getEmbedUrl(exercise.videoId)}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          )}

          {/* Paste URL tab */}
          {tab === 'paste' && (
            <div className="p-5">
              <p className="text-xs text-txt-secondary mb-2">YouTube URL</p>
              <div className="flex gap-2 mb-4">
                <input
                  autoFocus
                  value={pasteUrl}
                  onChange={e => setPasteUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePasteSave() }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 bg-bg-3 rounded-xl px-3 py-2.5 text-sm text-white placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={handlePasteSave}
                  disabled={!previewId}
                  className="bg-accent text-white px-4 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-accent-dark transition-colors"
                >
                  Save
                </button>
              </div>
              {previewId && (
                <div className="rounded-xl overflow-hidden aspect-video">
                  <iframe src={getEmbedUrl(previewId)} className="w-full h-full" allow="encrypted-media" allowFullScreen />
                </div>
              )}
            </div>
          )}

          {/* Search tab */}
          {tab === 'search' && (
            <div className="p-5">
              {!youtubeApiKey && (
                <div className="bg-bg-3 rounded-xl p-4 mb-4 text-sm text-txt-secondary">
                  <p className="font-semibold text-white mb-1">YouTube API Key Required</p>
                  <p>To enable search, add your YouTube Data API v3 key in <span className="text-accent">Settings → YouTube API Key</span>.</p>
                </div>
              )}
              <div className="flex gap-2 mb-4">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                  placeholder="Search for an exercise..."
                  className="flex-1 bg-bg-3 rounded-xl px-3 py-2.5 text-sm text-white placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button onClick={handleSearch} disabled={searching} className="bg-accent text-white px-4 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-accent-dark transition-colors">
                  {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                </button>
              </div>
              {searchError && <p className="text-danger text-sm mb-3">{searchError}</p>}
              <div className="space-y-2">
                {searchResults.map(result => (
                  <button key={result.id} onClick={() => handleSelectResult(result)}
                    className="w-full flex items-center gap-3 bg-bg-3 hover:bg-bg-4 rounded-xl p-3 text-left transition-colors">
                    <img src={result.thumbnail} alt="" className="w-20 h-14 object-cover rounded-lg flex-shrink-0 bg-bg-5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-2">{result.title}</p>
                      <p className="text-xs text-txt-secondary mt-0.5">{result.channel}</p>
                    </div>
                    <Check size={16} className="text-txt-muted flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center ${
      active ? 'text-accent border-b-2 border-accent' : 'text-txt-secondary hover:text-white'
    }`}>
      {children}
    </button>
  )
}
