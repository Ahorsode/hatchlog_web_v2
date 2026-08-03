'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Lock, ArrowRight, Loader2, Bird, CheckCircle2 } from 'lucide-react';
import Background3D from '@/components/auth/Background3D';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

export default function ChangePasswordPage() {
  const [firstname, setFirstname] = useState('');
  const [surname, setSurname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstname, surname, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password');
      }

      setSuccess(true);

      // Force session update to clear mustChangePassword flag
      await update({
        mustChangePassword: false,
        name: `${firstname} ${surname}`.trim()
      });

      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex items-center justify-center overflow-hidden py-9">
      <Background3D />
      
      <div className="relative z-10 w-full max-w-md px-5">
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="change-password-form"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/10 rounded-lg p-9 shadow-2xl overflow-hidden group">
                <div className="flex flex-col items-center text-center space-y-5">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
                    className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"
                  >
                    <Lock className="w-10 h-10 text-white" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-white tracking-normal text-center">Security Update</h1>
                    <p className="text-white/70 font-medium text-center">Please complete your profile and set a secure password</p>
                  </div>

                  <form onSubmit={handleSubmit} className="w-full space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative group/input">
                        <input
                          type="text"
                          value={firstname}
                          onChange={(e) => setFirstname(e.target.value)}
                          placeholder="First Name"
                          required
                          disabled={isLoading}
                          className="w-full h-12 px-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        />
                      </div>
                      <div className="relative group/input">
                        <input
                          type="text"
                          value={surname}
                          onChange={(e) => setSurname(e.target.value)}
                          placeholder="Surname"
                          required
                          disabled={isLoading}
                          className="w-full h-12 px-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-white/70 group-focus-within/input:text-blue-400 transition-colors" />
                      </div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        required
                        disabled={isLoading}
                        className="w-full h-12 pl-9 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                      />
                    </div>

                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-white/70 group-focus-within/input:text-blue-400 transition-colors" />
                      </div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
                        required
                        disabled={isLoading}
                        className="w-full h-12 pl-9 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                      />
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-400 text-xs font-bold uppercase tracking-widest bg-red-500/10 py-2 rounded-lg border border-red-500/20 w-full"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={isLoading || !newPassword || !confirmPassword || !firstname || !surname}
                      className="w-full h-14 bg-white hover:bg-gray-100 text-black rounded-md font-bold text-lg transition-all shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center group/btn"
                    >
                      {isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Updating password...
                        </span>
                      ) : (
                        <>
                          <span>Update Password</span>
                          <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success-animation"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center text-center space-y-5"
            >
              <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(59,130,246,0.4)]">
                <CheckCircle2 className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-normal">Password Updated!</h2>
              <p className="text-white/70">Redirecting to your dashboard...</p>
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
