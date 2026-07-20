'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

export function AuthCards() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Login Card */}
          <div className={`transition-all duration-300 ${activeTab === 'login' ? 'opacity-100 scale-100' : 'opacity-50 scale-95 lg:opacity-100 lg:scale-100'
            }`}>
            <div className="mb-4 lg:hidden">
              <Button
                variant={activeTab === 'login' ? 'default' : 'outline'}
                onClick={() => setActiveTab('login')}
                className="w-full"
              >
                Sign In
              </Button>
            </div>
            <div className={`${activeTab === 'login' ? 'block' : 'hidden lg:block'}`}>
              <LoginForm />
            </div>
          </div>

          {/* Register Card */}
          <div className={`transition-all duration-300 ${activeTab === 'register' ? 'opacity-100 scale-100' : 'opacity-50 scale-95 lg:opacity-100 lg:scale-100'
            }`}>
            <div className="mb-4 lg:hidden">
              <Button
                variant={activeTab === 'register' ? 'default' : 'outline'}
                onClick={() => setActiveTab('register')}
                className="w-full"
              >
                Sign Up
              </Button>
            </div>
            <div className={`${activeTab === 'register' ? 'block' : 'hidden lg:block'}`}>
              <RegisterForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}