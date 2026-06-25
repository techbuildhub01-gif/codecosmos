import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scene, { buildGalaxy } from './Scene.jsx'
import { fetchGalaxy, API_URL } from './api.js'
import { THEMES, DEFAULT_THEME } from './themes.js'
import {
  SearchBar,
  ProfileCard,
  StatsHUD,
  StarInfoPanel,
  ThemeSwitcher,
  Legend,
  LanguageFilter,
} from './Overlays.jsx'

const DEFAULT_USER = 'techbuildhub01-gif'

export default function App() {
  const [username, setUsername] = useState(DEFAULT_USER)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [themeKey, setThemeKey] = useState(DEFAULT_THEME)
  const [selected, setSelected] = useState(null)
  const [activeLang, setActiveLang] = useState(null)
  const [legendOpen, setLegendOpen] = useState(false)
  const controlsRef = useRef(null)

  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME]
  const stars = useMemo(() => (data ? buildGalaxy(data) : []), [data])

  const load = useCallback(async (name) => {
    const clean = (name || '').trim()
    if (!clean) return
    setLoading(true)
    setError(null)
    setSelected(null)
    setActiveLang(null)
    try {
      const result = await fetchGalaxy(clean)
      setData(result)
      setUsername(clean)
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(DEFAULT_USER)
  }, [load])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') setSelected(null)
      else if (e.key === '?') setLegendOpen((v) => !v)
      else if ((e.key === 'r' || e.key === 'R') && stars.length) {
        setSelected(stars[Math.floor(Math.random() * stars.length)])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stars])

  const recenter = () => {
    setSelected(null)
    const ctrls = controlsRef.current
    if (ctrls) {
      ctrls.object.position.set(0, 26, 72)
      ctrls.target.set(0, 0, 0)
      ctrls.update()
    }
  }

  const exportPng = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `codecosmos-${username}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const colorOf = (lang) => {
    const r = (data?.repos || []).find((x) => x.language === lang)
    return r ? r.languageColor : '#8b949e'
  }

  const cssVars = { '--accent': theme.accent, '--accent-2': theme.accent2 }

  return (
    <div className="app" style={cssVars}>
      <div className="canvas-wrap">
        {data && (
          <Scene
            stars={stars}
            contributions={data.contributions}
            theme={theme}
            selected={selected}
            onSelect={setSelected}
            controlsRef={controlsRef}
            activeLang={activeLang}
          />
        )}
      </div>

      <header className="top-bar glass">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">CodeCosmos</span>
        </div>
        <SearchBar onSearch={load} loading={loading} />
        <div className="top-actions">
          <button className="ghost-btn" onClick={recenter} title="Recenter view">Recenter</button>
          <button className="ghost-btn" onClick={exportPng} title="Save a PNG">Export</button>
          <button className="ghost-btn" onClick={() => setLegendOpen(true)} title="Legend (?)">Legend</button>
        </div>
      </header>

      <ThemeSwitcher themeKey={themeKey} setThemeKey={setThemeKey} themes={THEMES} />

      {data && <ProfileCard user={data.user} />}

      {data && data.stats.topLanguages.length > 0 && (
        <LanguageFilter
          languages={data.stats.topLanguages}
          active={activeLang}
          setActive={setActiveLang}
          colorOf={colorOf}
        />
      )}

      {data && <StatsHUD stats={data.stats} rateLimit={data.rateLimit} cached={data.cached} />}

      {selected && (
        <StarInfoPanel star={selected} accent={theme.accent} onClose={() => setSelected(null)} />
      )}

      {legendOpen && <Legend onClose={() => setLegendOpen(false)} />}

      {loading && (
        <div className="center-card glass">
          <div className="spinner" />
          <p>Mapping {username}&rsquo;s universe…</p>
        </div>
      )}

      {error && !loading && (
        <div className="center-card glass error">
          <p className="err-title">Couldn&rsquo;t load the galaxy</p>
          <p className="err-msg">{error}</p>
          <p className="err-hint">
            Make sure the backend is running at {API_URL} and that GITHUB_PAT is set in backend/.env.
          </p>
          <button className="primary-btn" onClick={() => load(username)}>Try again</button>
        </div>
      )}

      <footer className="credit">
        Built by Sheikh Farjad Ahmed · stars = repos · belts = commits · comets = open PRs
      </footer>
    </div>
  )
}
