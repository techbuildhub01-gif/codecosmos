import { useState } from 'react'

// Small helper to format big numbers (1234 -> 1.2k).
function fmt(n) {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
  return String(n)
}

function yearOf(iso) {
  try { return new Date(iso).getFullYear() } catch { return '' }
}

export function SearchBar({ onSearch, loading }) {
  const [value, setValue] = useState('')
  const submit = () => {
    const v = value.trim()
    if (v) onSearch(v)
  }
  return (
    <div className="search">
      <input
        className="search-input"
        placeholder="GitHub username…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <button className="primary-btn" onClick={submit} disabled={loading}>
        {loading ? '…' : 'Map'}
      </button>
    </div>
  )
}

export function ThemeSwitcher({ themeKey, setThemeKey, themes }) {
  return (
    <div className="theme-switch glass">
      {Object.entries(themes).map(([key, t]) => (
        <button
          key={key}
          className={'theme-dot' + (key === themeKey ? ' active' : '')}
          style={{ background: t.accent }}
          onClick={() => setThemeKey(key)}
          title={t.label}
          aria-label={`${t.label} theme`}
        />
      ))}
    </div>
  )
}

export function ProfileCard({ user }) {
  return (
    <div className="profile glass">
      <img className="avatar" src={user.avatarUrl} alt={user.name} />
      <div className="profile-text">
        <div className="profile-name">{user.name}</div>
        <a className="profile-login" href={user.url} target="_blank" rel="noreferrer">
          @{user.login}
        </a>
        {user.bio && <div className="profile-bio">{user.bio}</div>}
        <div className="profile-meta">
          {user.location && <span>📍 {user.location}</span>}
          <span><b>{fmt(user.followers)}</b> followers</span>
          <span><b>{fmt(user.following)}</b> following</span>
        </div>
      </div>
    </div>
  )
}

export function StatsHUD({ stats, rateLimit, cached }) {
  const top = stats.topLanguages[0]
  return (
    <div className="hud glass">
      <Stat label="repos" value={fmt(stats.repoCount)} />
      <Stat label="stars" value={fmt(stats.totalStars)} />
      <Stat label="forks" value={fmt(stats.totalForks)} />
      <Stat label="commits" value={fmt(stats.totalCommits)} />
      <Stat label="top lang" value={top ? top.name : '—'} />
      <div className="hud-foot">
        {cached ? 'cached' : 'live'}
        {rateLimit?.remaining != null && <> · API {rateLimit.remaining}/{rateLimit.limit}</>}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export function LanguageFilter({ languages, active, setActive, colorOf }) {
  return (
    <div className="lang-filter glass">
      <div className="lang-filter-title">Filter by language</div>
      <div className="lang-chips">
        <button
          className={'chip' + (!active ? ' active' : '')}
          onClick={() => setActive(null)}
        >
          All
        </button>
        {languages.slice(0, 8).map((l) => (
          <button
            key={l.name}
            className={'chip' + (active === l.name ? ' active' : '')}
            onClick={() => setActive(active === l.name ? null : l.name)}
          >
            <span className="chip-dot" style={{ background: colorOf(l.name) }} />
            {l.name} <span className="chip-count">{l.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function StarInfoPanel({ star, accent, onClose }) {
  return (
    <div className="info glass">
      <button className="info-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="info-lang" style={{ color: star.color }}>
        <span className="chip-dot" style={{ background: star.color }} />
        {star.language || 'No language'}
      </div>
      <h2 className="info-name">{star.name}</h2>
      {star.description && <p className="info-desc">{star.description}</p>}
      <div className="info-grid">
        <Stat label="stars" value={fmt(star.stars)} />
        <Stat label="forks" value={fmt(star.forks)} />
        <Stat label="commits" value={fmt(star.commits)} />
        <Stat label="open PRs" value={fmt(star.openPRs)} />
        <Stat label="created" value={yearOf(star.createdAt)} />
      </div>
      <a
        className="primary-btn block"
        style={{ background: accent }}
        href={star.url}
        target="_blank"
        rel="noreferrer"
      >
        View on GitHub →
      </a>
    </div>
  )
}

export function Legend({ onClose }) {
  return (
    <div className="legend-backdrop" onClick={onClose}>
      <div className="legend glass" onClick={(e) => e.stopPropagation()}>
        <button className="info-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 className="legend-title">Map legend</h2>
        <ul className="legend-list">
          <li><b>Black hole</b> — the user at the centre of it all.</li>
          <li><b>Stars</b> — repositories. Bigger = more GitHub stars; colour = main language.</li>
          <li><b>Orbit distance</b> — repo age. Oldest repos ride the outer rings, newest sit close in.</li>
          <li><b>Asteroid belts</b> — commits. Denser belt = more commits.</li>
          <li><b>Comets</b> — open pull requests circling a repo.</li>
          <li><b>Nebula</b> — the cloud is shaped by total contributions.</li>
        </ul>
        <div className="legend-keys">
          <span><kbd>Click</kbd> lock on a star</span>
          <span><kbd>R</kbd> random star</span>
          <span><kbd>Esc</kbd> release</span>
          <span><kbd>?</kbd> this legend</span>
        </div>
      </div>
    </div>
  )
}
