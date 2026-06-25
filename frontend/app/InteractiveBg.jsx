"use client"

import { useEffect, useRef } from "react"

/**
 * Interactive particle-network background.
 * - Particles drift slowly.
 * - Lines connect nearby particles.
 * - Mouse repels particles within a radius and projects a soft spotlight.
 */
export default function InteractiveBg() {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let raf = 0

    const PARTICLE_COUNT = 70
    const MAX_DIST = 130
    const MOUSE_RADIUS = 160

    function resize() {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function spawn() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.6 + 0.6,
      }))
    }

    function step() {
      ctx.clearRect(0, 0, width, height)

      // Spotlight halo following the mouse
      if (mouseRef.current.active) {
        const grad = ctx.createRadialGradient(
          mouseRef.current.x, mouseRef.current.y, 0,
          mouseRef.current.x, mouseRef.current.y, 240
        )
        grad.addColorStop(0, "rgba(37, 99, 235, 0.10)")
        grad.addColorStop(0.5, "rgba(99, 102, 241, 0.05)")
        grad.addColorStop(1, "rgba(0, 0, 0, 0)")
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      // Update + draw particles
      for (const p of particles) {
        // Mouse repulsion
        const dx = p.x - mouseRef.current.x
        const dy = p.y - mouseRef.current.y
        const d2 = dx * dx + dy * dy
        if (mouseRef.current.active && d2 < MOUSE_RADIUS * MOUSE_RADIUS) {
          const d = Math.sqrt(d2) || 1
          const force = (MOUSE_RADIUS - d) / MOUSE_RADIUS
          p.vx += (dx / d) * force * 0.35
          p.vy += (dy / d) * force * 0.35
        }

        // Friction
        p.vx *= 0.985
        p.vy *= 0.985

        // Drift
        p.x += p.vx
        p.y += p.vy

        // Wrap edges
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        if (p.y > height + 10) p.y = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(37, 99, 235, 0.55)"
        ctx.fill()
      }

      // Connect nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.35
            ctx.strokeStyle = `rgba(37, 99, 235, ${alpha * 0.7})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }

        // Line to the mouse if close
        if (mouseRef.current.active) {
          const dx = particles[i].x - mouseRef.current.x
          const dy = particles[i].y - mouseRef.current.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MOUSE_RADIUS) {
            const alpha = (1 - dist / MOUSE_RADIUS) * 0.55
            ctx.strokeStyle = `rgba(79, 70, 229, ${alpha * 0.8})`
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y)
            ctx.stroke()
          }
        }
      }

      raf = requestAnimationFrame(step)
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
      mouseRef.current.active = true
    }
    function onLeave() {
      mouseRef.current.active = false
      mouseRef.current.x = -9999
      mouseRef.current.y = -9999
    }

    resize()
    spawn()
    step()

    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseout", onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseout", onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.9,
      }}
    />
  )
}
