'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateProfile } from '@/lib/actions/dashboard-actions';

export default function ProfileOnboardingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const firstname = formData.get('firstname') as string;
    const surname = formData.get('surname') as string;

    try {
      const result = await updateProfile({ firstname, surname });
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to update profile. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3">
      <div className="max-w-md w-full space-y-11 relative z-10">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-white tracking-normal italic">Welcome to <span className="text-emerald-400">Agri-ERP</span></h1>
          <p className="text-sm text-white/70 font-bold uppercase tracking-widest italic">
            Please complete your profile details to continue.
          </p>
        </div>

        <Card className="glass-morphism border-none shadow-2xl rounded-lg p-3">
          <CardHeader>
            <CardTitle className="text-2xl italic tracking-normal">Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-7">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-md font-bold backdrop-blur-md">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <Input 
                  label="First Name"
                  name="firstname"
                  required
                  placeholder="e.g. John"
                  disabled={isLoading}
                />
                <Input 
                  label="Surname"
                  name="surname"
                  required
                  placeholder="e.g. Doe"
                  disabled={isLoading}
                />
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  isLoading={isLoading}
                  loadingText="Saving profile..."
                  size="lg"
                  className="w-full"
                >
                  Continue to Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Decorative background effects for onboarding */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-[120px] -z-10 animate-pulse delay-700" />
    </div>
  );
}
