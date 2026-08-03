'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Phone, ArrowRight, Loader2, Bird, User, Mail, Lock } from 'lucide-react';
import Background3D from '@/components/auth/Background3D';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    firstname: '',
    surname: '',
    email: '',
    phoneNumber: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!formData.phoneNumber || !formData.password) return;

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // For sign up, we might need a custom action to create the user first 
      // or rely on the authorize function to handle auto-registration if it's designed that way.
      // Given the current auth.ts, it looks like it searches for invitations.
      // If we want a general sign up, we should probably have a server action.
      
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // After successful registration, sign in
      const signinRes = await signIn('credentials', {
        identifier: formData.phoneNumber,
        password: formData.password,
        redirect: false,
      });
      
      if (signinRes?.error) {
        setError('Account created but login failed. Please go to login page.');
        setIsLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    if (isLoading) return;
    setIsLoading(true);
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] flex items-center justify-center overflow-hidden py-9">
      <Background3D />
      
      <div className="relative z-10 w-full max-w-md px-5">
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="signup-form"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />

              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/10 rounded-lg p-9 shadow-2xl overflow-hidden group">
                <div className="flex flex-col items-center text-center space-y-5">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
                  >
                    <img src="/logo.png" alt="Agri-ERP Logo" className="w-20 h-20 rounded-lg object-cover shadow-lg shadow-emerald-500/20" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h1 className="text-4xl font-bold text-white tracking-normal">Join Us</h1>
                    <p className="text-white/70 font-medium">Create your poultry farm account</p>
                  </div>

                  <form onSubmit={handleSubmit} className="w-full space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="w-4 h-4 text-white/70 group-focus-within/input:text-emerald-400 transition-colors" />
                        </div>
                        <input
                          type="text"
                          name="firstname"
                          value={formData.firstname}
                          onChange={handleChange}
                          placeholder="First"
                          disabled={isLoading}
                          className="w-full h-12 pl-9 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                        />
                      </div>
                      <div className="relative group/input">
                        <input
                          type="text"
                          name="surname"
                          value={formData.surname}
                          onChange={handleChange}
                          placeholder="Surname"
                          disabled={isLoading}
                          className="w-full h-12 px-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="w-4 h-4 text-white/70 group-focus-within/input:text-emerald-400 transition-colors" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Email Address (Optional)"
                        disabled={isLoading}
                        className="w-full h-12 pl-9 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                      />
                    </div>

                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="w-4 h-4 text-white/70 group-focus-within/input:text-emerald-400 transition-colors" />
                      </div>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        placeholder="+233 54 000 0000"
                        required
                        disabled={isLoading}
                        className="w-full h-12 pl-9 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                      />
                    </div>

                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-white/70 group-focus-within/input:text-emerald-400 transition-colors" />
                      </div>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={`Create Password (${MIN_PASSWORD_LENGTH}+ characters)`}
                        required
                        disabled={isLoading}
                        className="w-full h-12 pl-9 pr-3 bg-black/60 border border-white/10 rounded-md text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                      />
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-red-400 text-xs font-bold uppercase tracking-widest bg-red-500/10 py-2 rounded-lg border border-red-500/20"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={isLoading || !formData.phoneNumber || !formData.password}
                      className="w-full h-14 bg-white hover:bg-gray-100 text-black rounded-md font-bold text-lg transition-all shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center group/btn"
                    >
                      {isLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Creating account...
                        </span>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <ArrowRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                  
                  <p className="text-white/70 text-xs font-bold pt-3">
                    Already have an account? <button onClick={() => router.push('/login')} disabled={isLoading} className="text-emerald-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">Log In</button>
                  </p>

                  <div className="w-full pt-3">
                    <div className="relative flex items-center py-3">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink-0 mx-3 text-white/70 text-xs font-bold uppercase tracking-widest">or continue with</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignUp}
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
              <div className="w-32 h-32 rounded-lg flex items-center justify-center shadow-[0_0_100px_rgba(16,185,129,0.4)]">
                <img src="/logo.png" alt="Agri-ERP Logo" className="w-32 h-32 object-cover rounded-lg" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-normal">Welcome Aboard!</h2>
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
