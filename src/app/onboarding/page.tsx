'use client';

import React, { useState } from 'react';
import { onboardFarmer } from '@/lib/actions/dashboard-actions';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Layout, MapPin, BarChart3, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function OnboardingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const location = formData.get('location') as string;
    const capacity = parseInt(formData.get('capacity') as string);

    try {
      const result = await onboardFarmer({ name, location, capacity });
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to onboard. Please try again.');
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
            Let's get your farm set up to start tracking your operations.
          </p>
        </div>

        <Card className="glass-morphism border-none shadow-2xl rounded-lg p-3">
          <CardHeader>
            <CardTitle className="text-2xl italic tracking-normal">Farm Profile</CardTitle>
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
                  label="Farm Name"
                  name="name"
                  required
                  placeholder="e.g. Green Valley Farm"
                  disabled={isLoading}
                />
                <Input 
                  label="Location"
                  name="location"
                  required
                  placeholder="e.g. Kumasi, Ghana"
                  disabled={isLoading}
                />
                <Input 
                  label="Total Capacity (Birds)"
                  name="capacity"
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5000"
                  disabled={isLoading}
                />
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  isLoading={isLoading}
                  loadingText="Setting up farm..."
                  size="lg"
                  className="w-full"
                >
                  Start Managing Farm
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
