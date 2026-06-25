import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Data -> geometry
// ---------------------------------------------------------------------------

// Deterministic pseudo-random in [0,1) from an integer seed, so the layout
// stays stable across re-renders (stars don't jump around).
function seededRand(seed) {
  const x = Math.sin(seed * 99991.13) * 10000
  return x - Math.floor(x)
}

// Turn the API repos into "star" descriptors with everything the scene needs.
// THE TWIST: orbit distance is set by repo AGE (oldest on the outer rings,
// newest near the core) — so the galaxy reads like rings of time.
export function buildGalaxy(data) {
  const repos = data.repos || []
  const n = repos.length || 1

  const byAge = [...repos].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )
  const ageRank = new Map(byAge.map((r, i) => [r.name, i]))
  const spacing = Math.max(2.2, 40 / n)

  return repos.map((r, idx) => {
    const rank = ageRank.get(r.name) ?? idx
    const radius = 10 + rank * spacing
    const size = Math.min(4, 0.55 + Math.log(r.stars + 1) * 0.5)
    const speed = 0.2 / Math.sqrt(radius) // closer orbits move faster
    const phase = seededRand(idx + 1) * Math.PI * 2
    const tilt = (seededRand(idx + 7) - 0.5) * 0.6 // orbital inclination
    const yaw = seededRand(idx + 13) * Math.PI * 2
    const asteroids = r.commits > 0
      ? Math.max(5, Math.min(36, Math.floor(r.commits / 30)))
      : 0
    const comets = Math.min(5, r.openPRs)
    return { ...r, radius, size, speed, phase, tilt, yaw, asteroids, comets, color: r.languageColor }
  })
}

// Soft radial glow texture, generated once in the browser (used for halos).
function makeGlowTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(c)
}

// World position of an orbiting star at time t (matches StarSystem's motion so
// the camera can follow a moving star precisely).
const _e = new THREE.Euler()
function starWorldPos(star, t, out) {
  const a = star.phase + star.speed * t
  out.set(Math.cos(a) * star.radius, 0, Math.sin(a) * star.radius)
  _e.set(star.tilt, star.yaw, 0, 'XYZ')
  out.applyEuler(_e)
  return out
}

// ---------------------------------------------------------------------------
// Scene pieces
// ---------------------------------------------------------------------------

function CentralGlow({ theme, glowTex }) {
  return (
    <group>
      <sprite scale={[78, 78, 1]}>
        <spriteMaterial map={glowTex} color={theme.glow} transparent opacity={0.3}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={[150, 150, 1]} position={[14, -8, -24]}>
        <spriteMaterial map={glowTex} color={theme.accent2} transparent opacity={0.1}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  )
}

function BlackHole({ theme }) {
  const disc = useRef()
  useFrame((_, delta) => {
    if (disc.current) disc.current.rotation.z += delta * 0.16
  })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[3, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh ref={disc} rotation={[Math.PI / 2.2, 0, 0]}>
        <ringGeometry args={[3.3, 6.6, 80]} />
        <meshBasicMaterial color={theme.accent} side={THREE.DoubleSide} transparent opacity={0.4} />
      </mesh>
      <pointLight intensity={2.4} distance={160} color={theme.accent} />
    </group>
  )
}

function Comet({ index, baseRadius, accent }) {
  const ref = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime * (1.4 + index * 0.25) + index
    ref.current.position.x = Math.cos(t) * baseRadius
    ref.current.position.z = Math.sin(t) * baseRadius * 0.6
    ref.current.position.y = Math.sin(t * 0.7) * 0.9
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.16, 8, 8]} />
      <meshBasicMaterial color={accent} />
    </mesh>
  )
}

function StarSystem({ star, theme, onSelect, selectedName, activeLang, glowTex }) {
  const orbit = useRef()
  const spin = useRef()
  const mat = useRef()
  const grp = useRef()
  const [hovered, setHovered] = useState(false)

  const isSelected = selectedName === star.name
  const dimmed = activeLang && star.language !== activeLang && !isSelected
  const targetScale = (hovered || isSelected) ? 1.3 : 1

  useFrame((state, delta) => {
    const a = star.phase + star.speed * state.clock.elapsedTime
    orbit.current.position.x = Math.cos(a) * star.radius
    orbit.current.position.z = Math.sin(a) * star.radius
    if (spin.current) spin.current.rotation.y += delta * 0.4
    if (mat.current) {
      const twinkle = 1.9 + Math.sin(state.clock.elapsedTime * 2 + star.phase * 5) * 0.5
      mat.current.emissiveIntensity = isSelected ? 4.6 : (dimmed ? 0.3 : twinkle)
    }
    if (grp.current) {
      const s = grp.current.scale.x + (targetScale - grp.current.scale.x) * Math.min(1, delta * 9)
      grp.current.scale.setScalar(s)
    }
  })

  // Asteroid belt (commits) — a thin ring of points around the star.
  const asteroidGeo = useMemo(() => {
    const count = star.asteroids
    const ringR = star.size + 1.3
    const pos = []
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + seededRand(i + 5)
      const rr = ringR + (seededRand(i + 99) - 0.5) * 0.7
      pos.push(Math.cos(a) * rr, (seededRand(i + 33) - 0.5) * 0.35, Math.sin(a) * rr)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [star.asteroids, star.size])

  return (
    <group rotation={[star.tilt, star.yaw, 0]}>
      {/* faint orbit path in this orbit's plane */}
      {!dimmed && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[star.radius - 0.04, star.radius + 0.04, 96]} />
          <meshBasicMaterial
            color={star.color}
            side={THREE.DoubleSide}
            transparent
            opacity={isSelected ? 0.5 : 0.13}
            depthWrite={false}
          />
        </mesh>
      )}

      <group ref={orbit}>
        <group ref={grp}>
          {/* glow halo */}
          {!dimmed && (
            <sprite scale={[star.size * 5, star.size * 5, 1]}>
              <spriteMaterial map={glowTex} color={star.color} transparent opacity={0.55}
                depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          )}

          <mesh
            ref={spin}
            onClick={(e) => { e.stopPropagation(); onSelect(star) }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
          >
            <sphereGeometry args={[star.size, 28, 28]} />
            <meshStandardMaterial
              ref={mat}
              color={star.color}
              emissive={star.color}
              emissiveIntensity={1.9}
              roughness={0.4}
              transparent={dimmed}
              opacity={dimmed ? 0.12 : 1}
            />
          </mesh>

          {isSelected && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[star.size * 1.5, star.size * 1.74, 48]} />
              <meshBasicMaterial color={theme.accent} side={THREE.DoubleSide} transparent opacity={0.95} />
            </mesh>
          )}

          {(hovered || isSelected) && (
            <Html center distanceFactor={36} style={{ pointerEvents: 'none' }} zIndexRange={[8, 0]}>
              <div className="star-label">
                {star.name}
                <span>{star.stars}★ · {star.language || 'no language'}</span>
              </div>
            </Html>
          )}

          {!dimmed && star.asteroids > 0 && (
            <points geometry={asteroidGeo}>
              <pointsMaterial size={0.16} color={star.color} transparent opacity={0.7} sizeAttenuation />
            </points>
          )}

          {!dimmed && Array.from({ length: star.comets }).map((_, i) => (
            <Comet key={i} index={i} baseRadius={star.size + 2.2 + i * 0.5} accent={theme.accent2} />
          ))}
        </group>
      </group>
    </group>
  )
}

function Nebula({ contributions, colorA, colorB }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const total = Math.min(1800, Math.max(220, Math.floor((contributions?.total || 0) / 1.5)))
    const cA = new THREE.Color(colorA)
    const cB = new THREE.Color(colorB)
    const tmp = new THREE.Color()
    const pos = []
    const col = []
    for (let i = 0; i < total; i++) {
      const r = 16 + Math.random() * 46
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * 14
      pos.push(Math.cos(theta) * r, y, Math.sin(theta) * r)
      tmp.copy(cA).lerp(cB, Math.random())
      const shade = 0.35 + Math.random() * 0.65
      col.push(tmp.r * shade, tmp.g * shade, tmp.b * shade)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    return g
  }, [contributions, colorA, colorB])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.012
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.4} vertexColors transparent opacity={0.55}
        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

// Smoothly fly the camera alongside a selected star. While selected,
// OrbitControls is disabled and this rig owns the camera.
function CameraRig({ selected, controlsRef }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())
  const sp = useRef(new THREE.Vector3())
  const dir = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    if (!selected) return
    const t = state.clock.elapsedTime
    starWorldPos(selected, t, sp.current)
    target.current.copy(sp.current)

    dir.current.copy(sp.current)
    if (dir.current.lengthSq() < 0.001) dir.current.set(1, 0, 0)
    dir.current.normalize()
    const dist = 6 + selected.size * 2.4
    desired.current.copy(sp.current).addScaledVector(dir.current, dist)
    desired.current.y += dist * 0.45

    const k = 1 - Math.pow(0.0016, delta) // framerate-independent smoothing
    camera.position.lerp(desired.current, k)
    const ctrls = controlsRef.current
    if (ctrls) {
      ctrls.target.lerp(target.current, k)
      ctrls.update()
    }
  })
  return null
}

// ---------------------------------------------------------------------------
// Top-level canvas
// ---------------------------------------------------------------------------

export default function Scene({ stars, contributions, theme, selected, onSelect, controlsRef, activeLang }) {
  const glowTex = useMemo(makeGlowTexture, [])
  return (
    <Canvas
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: [0, 24, 76], fov: 60, near: 0.1, far: 3000 }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[theme.bg]} />
      <ambientLight intensity={0.3} />
      <Stars radius={340} depth={110} count={6000} factor={4.5} saturation={0} fade speed={0.3} />

      <CentralGlow theme={theme} glowTex={glowTex} />
      <BlackHole theme={theme} />
      <Nebula contributions={contributions} colorA={theme.nebulaA} colorB={theme.nebulaB} />

      {stars.map((s) => (
        <StarSystem
          key={s.name}
          star={s}
          theme={theme}
          onSelect={onSelect}
          selectedName={selected?.name}
          activeLang={activeLang}
          glowTex={glowTex}
        />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!selected}
        enablePan={false}
        autoRotate={!selected}
        autoRotateSpeed={0.35}
        minDistance={6}
        maxDistance={260}
      />
      <CameraRig selected={selected} controlsRef={controlsRef} />

      <EffectComposer>
        <Bloom intensity={theme.bloom} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  )
}
