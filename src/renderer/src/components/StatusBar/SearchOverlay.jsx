import { useEffect, useMemo, useRef } from 'react'
import { LuCheck, LuFolderOpen, LuListMusic, LuSearch, LuSettings2, LuUserRoundSearch } from 'react-icons/lu'
import { Cola } from '../Cola/Cola'
import { useGlobalSearch } from '../../Contexts/GlobalSearchContext'
import SearchEntityList from './SearchEntityList'

const FILTERS = [
  { id: 'directory', label: 'Directory', icon: <LuFolderOpen /> },
  { id: 'playlist', label: 'Playlist', icon: <LuListMusic /> },
  { id: 'artist', label: 'Artist', icon: <LuUserRoundSearch /> },
  { id: 'name', label: 'Name', icon: <LuSearch /> },
  { id: 'configuration', label: 'Configuracion', icon: <LuSettings2 /> }
]

function SearchSection({
  section,
  hasQuery,
  onSongSelect,
  onEntitySelect
}) {
  if (!section.enabled) {
    return null
  }

  if (section.id !== 'configuration' && !hasQuery) {
    return null
  }

  return (
    <section className="search-overlay__section" aria-labelledby={`search-section-${section.id}`}>
      <div className="search-overlay__section-header">
        <h3 id={`search-section-${section.id}`}>{section.title}</h3>
        <span>{section.total}</span>
      </div>

      {section.id === 'songs' ? (
        <div className="search-overlay__songs">
          <Cola
            list={section.items}
            name="global-search"
            virtualized
            preserveOrder
            height={section.items.length > 0 ? 280 : 180}
            hasMore={section.hasMore}
            isLoading={section.loading}
            onLoadMore={section.onLoadMore}
            onPlayOverride={(file) => onSongSelect(file)}
          />
        </div>
      ) : (
        <SearchEntityList
          items={section.items}
          loading={section.loading}
          hasMore={section.hasMore}
          onLoadMore={section.onLoadMore}
          onSelect={onEntitySelect}
          emptyState={<div className="search-overlay__empty-inline">No se encontraron resultados.</div>}
        />
      )}
    </section>
  )
}

export function SearchOverlay({ triggerRef }) {
  const {
    isOpen,
    closeSearch,
    query,
    setQuery,
    filters,
    toggleFilter,
    sections,
    hasQuery,
    handleSongSelect,
    handlePlaylistSelect,
    handleDirectorySelect,
    handleSettingSelect
  } = useGlobalSearch()
  const overlayRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const nextFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    const handlePointerDown = (event) => {
      const target = event.target

      if (overlayRef.current?.contains(target)) {
        return
      }

      if (triggerRef?.current?.contains(target)) {
        return
      }

      closeSearch()
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSearch()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(nextFrame)
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeSearch, isOpen, triggerRef])

  const visibleSections = useMemo(
    () =>
      sections.filter((section) => {
        if (!section.enabled) {
          return false
        }

        if (!hasQuery && section.id !== 'configuration') {
          return false
        }

        return true
      }),
    [hasQuery, sections]
  )
  const hasActiveCategories = useMemo(
    () => sections.some((section) => section.enabled),
    [sections]
  )

  if (!isOpen) {
    return null
  }

  return (
    <div className="search-overlay-layer">
      <div
        ref={overlayRef}
        className="search-overlay"
        role="dialog"
        aria-modal="false"
        aria-label="Global search"
      >
        <div className="search-overlay__topline" />

        <div className="search-overlay__searchbox">
          <LuSearch className="search-overlay__search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca canciones, playlists, directorios o accesos rapidos..."
          />
        </div>

        <div className="search-overlay__filters" role="toolbar" aria-label="Filtros de busqueda">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={filters[filter.id] ? 'search-overlay__filter is-active' : 'search-overlay__filter'}
              aria-pressed={filters[filter.id]}
              onClick={() => toggleFilter(filter.id)}
            >
              {filter.icon}
              <span>{filter.label}</span>
              {filters[filter.id] ? <LuCheck /> : null}
            </button>
          ))}
        </div>

        <div className="search-overlay__content">
          {!hasQuery ? (
            <div className="search-overlay__empty-state">
              <p>Escribe para buscar sin salir de la vista actual.</p>
              <span>
                `Name` y `Artist` ya estan activos. Activa mas filtros si quieres incluir
                playlists, directorios o configuracion.
              </span>
            </div>
          ) : null}

          {visibleSections.map((section) => (
            <SearchSection
              key={section.id}
              section={section}
              hasQuery={hasQuery}
              onSongSelect={handleSongSelect}
              onEntitySelect={(item) => {
                if (section.id === 'playlists') {
                  void handlePlaylistSelect(item)
                  return
                }

                if (section.id === 'directories') {
                  void handleDirectorySelect(item)
                  return
                }

                handleSettingSelect(item)
              }}
            />
          ))}

          {hasQuery && hasActiveCategories && visibleSections.length === 0 ? (
            <div className="search-overlay__empty-state">
              <p>No se encontraron resultados.</p>
              <span>Prueba otra busqueda o activa mas filtros para ampliar resultados.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SearchOverlay
