'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Phone, ArrowRight, Loader2, Plus, Lock, ShieldAlert } from 'lucide-react';
import Background3D from '@/components/auth/Background3D';

const SECURITY_NOTICE = 'Your security permissions have been updated. Please sign in again to activate your new features.';

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authError = searchParams.get('error');
    if (authError === 'OAuthAccountNotLinked') {
      setError('This Google account could not be linked. Sign in with the email your administrator invited you with.');
    } else if (authError) {
      setError('Google sign-in failed. Please try again or contact your farm administrator.');
    }

    if (searchParams.get('security') !== 'updated') return;

    const storedMessage = window.sessionStorage.getItem('hatchlog_security_notice');
    setSecurityMessage(storedMessage || SECURITY_NOTICE);
    window.sessionStorage.removeItem('hatchlog_security_notice');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!phoneNumber || !password) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const res = await signIn('credentials', {
        identifier: phoneNumber,
        password: password,
        redirect: false,
      });
      
        if (res?.error) {
          setError('Invalid phone number or password.');
          setIsLoading(false);
        } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (isLoading) return;
    setIsLoading(true);
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
      <Background3D />
      
      <div className="relative z-10 w-full max-w-md px-5">
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              {/* Ambient Glow */}
              <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/10 rounded-lg p-9 shadow-2xl overflow-hidden group">
                {/* Glossy Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform -translate-x-full group-hover:translate-x-full pointer-events-none" />
                
                <div className="flex flex-col items-center text-center space-y-5">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
                  >
                    <img src="/logo.png" alt="Agri-ERP Logo" className="w-20 h-20 rounded-lg object-cover shadow-lg shadow-emerald-500/20" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h1 className="text-4xl font-bold text-white tracking-normal">Welcome</h1>
                    <p className="text-white/70 font-medium">Enter your details to proceed</p>
                  </div>

                  <form onSubmit={handleSubmit} className="w-full space-y-4 mt-3">
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="w-5 h-5 text-white/70 group-focus-within/input:text-emerald-400 transition-colors" />
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+233 54 000 0000"
                        disabled={isLoading}
                        required
                        className="w-full h-14 pl-11 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium text-lg disabled:opacity-50 shadow-inner"
                      />
                    </div>

                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="w-5 h-5 text-white/70 group-focus-within/input:text-emerald-400 transition-colors" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••"
                        disabled={isLoading}
                        required
                        className="w-full h-14 pl-11 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium text-lg disabled:opacity-50 shadow-inner"
                      />
                    </div>

                    <AnimatePresence>
                      {securityMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm font-bold text-amber-300"
                        >
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{securityMessage}</span>
                        </motion.div>
                      )}
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="text-red-400 text-sm font-bold bg-red-500/10 py-2 rounded-md border border-red-500/20"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={isLoading || !phoneNumber || !password}
                      className="relative w-full h-14 bg-white hover:bg-gray-100 text-black rounded-md font-bold text-lg transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center group/btn overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                      {isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-black/50" />
                          Signing in...
                        </span>
                      ) : (
                        <>
                          <span>Secure Login</span>
                          <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => router.push('/signup')}
                      disabled={isLoading}
                      className="w-full h-14 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md font-bold text-lg transition-all border border-emerald-500/20 flex items-center justify-center group/signup disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Create New Account</span>
                      <Plus className="w-5 h-5 ml-2 group-hover/signup:rotate-90 transition-transform" />
                    </button>
                  </form>
                  
                  <div className="w-full mt-5">
                    <div className="relative flex items-center py-3">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink-0 mx-3 text-white/70 text-xs font-bold uppercase tracking-widest">or continue with</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <button
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="relative w-full h-14 bg-white/10 border border-white/10 hover:bg-white/10 text-white rounded-md font-bold text-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2 group overflow-hidden shadow-inner disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> : <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>}
                      <span>{isLoading ? 'Opening Google...' : 'Google'}</span>
                    </button>
                  </div>
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
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", bounce: 0.6 }}
                className="w-32 h-32 rounded-lg flex items-center justify-center shadow-[0_0_100px_rgba(16,185,129,0.4)]"
              >
                <img src="/logo.png" alt="Agri-ERP Logo" className="w-32 h-32 object-cover rounded-lg" />
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-white tracking-normal"
              >
                Access Granted
              </motion.h2>
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
