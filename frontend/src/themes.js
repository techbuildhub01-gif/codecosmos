// Three richer two-tone themes. Each one drives the UI accent, the core glow,
// the two-colour nebula, the tinted (non-black) space background, and bloom.
// "aurora" is the default — a teal/indigo identity that sets CodeCosmos apart.

export const THEMES = {
  aurora: {
    label: 'Aurora',
    accent: '#3ef0c8',   // teal — UI + selection
    accent2: '#7dd3fc',  // sky blue — comets / secondary glow
    nebulaA: '#17b8a6',  // nebula colour A
    nebulaB: '#5b6cf0',  // nebula colour B (indigo)
    glow: '#2ad6c0',     // core glow
    bg: '#070d1c',       // deep blue-black (not pure black)
    bloom: 1.5,
  },
  solar: {
    label: 'Solar',
    accent: '#ff9a4d',
    accent2: '#ff5d8f',
    nebulaA: '#ff7a3c',
    nebulaB: '#c2419a',
    glow: '#ff8a4d',
    bg: '#150a12',       // deep plum
    bloom: 1.55,
  },
  nova: {
    label: 'Nova',
    accent: '#b06bff',
    accent2: '#36d3f5',
    nebulaA: '#7b4dff',
    nebulaB: '#2aa9e0',
    glow: '#9a5cff',
    bg: '#0b0a1e',       // deep indigo
    bloom: 1.6,
  },
}

export const DEFAULT_THEME = 'aurora'