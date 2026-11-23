/**
 * CHARDHO-AI :: 3D hero scene
 * A wireframe AI globe, neural mesh, orbiting rings and floating solids.
 * Everything is procedurally generated — no 3D asset downloads, so it stays fast
 * and works offline.
 */
import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

const CYAN = '#22d3ee';
const VIOLET = '#a855f7';
const BLUE = '#3b82f6';

/** Evenly distributed points on a sphere (Fibonacci lattice). */
function spherePoints(count, radius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = golden * i;
    pts.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]);
  }
  return pts;
}

function Globe({ detail = 1 }) {
  const group = useRef();
  const linksRef = useRef();
  const dotsRef = useRef();

  const radius = 1.72;

  const { dotPositions, linkPositions } = useMemo(() => {
    const nodes = spherePoints(detail > 0 ? 620 : 300, radius);
    const dots = new Float32Array(nodes.length * 3);
    nodes.forEach((p, i) => dots.set(p, i * 3));

    // Neural mesh: connect nearby nodes so it reads as a network, not noise.
    const segments = [];
    const maxPairs = detail > 0 ? 460 : 200;
    let guard = 0;
    while (segments.length < maxPairs * 6 && guard < 9000) {
      guard++;
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      const b = nodes[Math.floor(Math.random() * nodes.length)];
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 0.35 && dist < 0.95) segments.push(...a, ...b);
    }
    return { dotPositions: dots, linkPositions: new Float32Array(segments) };
  }, [detail]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y += delta * 0.12;
      group.current.rotation.x = Math.sin(t * 0.14) * 0.1;
    }
    if (linksRef.current) {
      linksRef.current.material.opacity = 0.14 + Math.sin(t * 1.1) * 0.07;
    }
    if (dotsRef.current) {
      dotsRef.current.material.size = 0.028 + Math.sin(t * 2) * 0.004;
    }
  });

  return (
    <group ref={group}>
      {/* dark core so the far side of the wireframe stays readable */}
      <mesh>
        <sphereGeometry args={[radius * 0.985, 48, 48]} />
        <meshBasicMaterial color="#05060f" transparent opacity={0.92} />
      </mesh>

      {/* latitude/longitude cage */}
      <mesh>
        <icosahedronGeometry args={[radius, detail > 0 ? 4 : 3]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.16} />
      </mesh>

      {/* neural links */}
      <lineSegments ref={linksRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linkPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={CYAN} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>

      {/* surface nodes */}
      <points ref={dotsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dotPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color="#a5f3fc" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>

      {/* atmosphere */}
      <mesh scale={1.22}>
        <sphereGeometry args={[radius, 48, 48]} />
        <shaderMaterial
          uniforms={{ uColor: { value: new THREE.Color(CYAN) }, uPower: { value: 2.8 } }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uPower;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
              gl_FragColor = vec4(uColor, rim * 0.65);
            }
          `}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Ring({ radius = 2.5, tilt = 1.1, speed = 0.06, color = VIOLET }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed;
  });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.004, 8, 160]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Orbiter({ radius = 2.55, speed = 0.25, color = CYAN, offset = 0 }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset;
    if (ref.current) ref.current.position.set(Math.cos(t) * radius, Math.sin(t * 1.3) * 0.7, Math.sin(t) * radius);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.035, 12, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function FloatingSolids() {
  return (
    <>
      <Float speed={1.1} rotationIntensity={0.7} floatIntensity={1.1}>
        <mesh position={[-3.1, 1.15, -0.6]} scale={0.34}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={VIOLET} emissive={VIOLET} emissiveIntensity={0.6} roughness={0.25} metalness={0.7} transparent opacity={0.9} />
        </mesh>
      </Float>
      <Float speed={1.5} rotationIntensity={1} floatIntensity={0.9}>
        <mesh position={[3.15, -0.9, -0.2]} scale={0.3}>
          <torusKnotGeometry args={[1, 0.28, 96, 12]} />
          <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.45} roughness={0.2} metalness={0.8} />
        </mesh>
      </Float>
      <Float speed={1.3} rotationIntensity={0.8} floatIntensity={1.4}>
        <mesh position={[2.5, 1.7, -1.4]} scale={0.22}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={BLUE} emissive={BLUE} emissiveIntensity={0.55} roughness={0.3} metalness={0.6} />
        </mesh>
      </Float>
    </>
  );
}

function Rig({ reducedMotion }) {
  useFrame((state) => {
    if (reducedMotion) return;
    const { pointer, camera } = state;
    camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.03;
    camera.position.y += (pointer.y * 0.3 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene({ reducedMotion = false, detail = 1 }) {
  return (
    <Canvas
      dpr={[1, 1.7]}
      camera={{ position: [0, 0, 6.2], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          // Let the browser restore the context; the 2D fallback covers the gap.
          e.preventDefault();
        });
      }}
    >
      <color attach="background" args={['#05060f']} />
      <fog attach="fog" args={['#05060f', 8, 18]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[5, 4, 5]} intensity={45} color={CYAN} distance={22} />
      <pointLight position={[-5, -3, 4]} intensity={35} color={VIOLET} distance={22} />

      <Suspense fallback={null}>
        <Globe detail={detail} />
        <Ring radius={2.35} tilt={1.24} speed={0.05} color={CYAN} />
        <Ring radius={2.75} tilt={1.05} speed={-0.04} color={VIOLET} />
        <Orbiter radius={2.4} speed={0.3} color={CYAN} />
        <Orbiter radius={2.8} speed={-0.22} color={VIOLET} offset={2} />
        <FloatingSolids />
        <Sparkles count={detail > 0 ? 70 : 30} scale={[9, 6, 6]} size={2.2} speed={0.25} color="#a5f3fc" opacity={0.7} />
        <Stars radius={40} depth={22} count={detail > 0 ? 1200 : 500} factor={3} saturation={0} fade speed={0.5} />
        <Rig reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
