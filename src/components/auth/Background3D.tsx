"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export default function Background3D() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!mounted) return <div className="fixed inset-0 bg-[#0a0a0a]" />;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0a0a0a]">
      {/* Animated Mesh Gradient */}
      <div 
        className="absolute inset-0 opacity-40 blur-[120px]"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, #3b82f6 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, #8b5cf6 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, #10b981 0%, transparent 40%)
          `
        }}
      />

      {/* Floating 3D Shapes */}
      <motion.div
        animate={{
          x: mousePosition.x * 2,
          y: mousePosition.y * 2,
          rotate: mousePosition.x * 0.5,
        }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/10 blur-3xl"
      />
      <motion.div
        animate={{
          x: -mousePosition.x * 3,
          y: -mousePosition.y * 3,
          rotate: -mousePosition.y * 0.5,
        }}
        transition={{ type: "spring", stiffness: 40, damping: 25 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-gradient-to-bl from-emerald-500/10 to-blue-500/20 blur-3xl"
      />

      {/* Subtle CSS Grid (Replacement for missing grid.svg) */}
      <div 
        className="absolute inset-0 opacity-[0.03] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]" 
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
    </div>
  );
}
