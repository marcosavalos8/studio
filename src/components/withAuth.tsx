'use client'

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const PASSWORD_KEY = 'secure_page_access_granted';

export function withAuth<P extends object>(WrappedComponent: React.ComponentType<P>) {
  const WithAuthComponent: React.FC<P> = (props) => {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [correctPassword, setCorrectPassword] = useState('1234'); // Default password

    useEffect(() => {
        // This will only run on the client side
        const envPassword = process.env.NEXT_PUBLIC_PAYROLL_PASSWORD;
        if (envPassword) {
            setCorrectPassword(envPassword);
        }
        
        // Check session storage on mount
        if (sessionStorage.getItem(PASSWORD_KEY) === 'true') {
            setIsAuthorized(true);
        }
    }, []);

    const handlePasswordSubmit = () => {
      if (password === correctPassword) {
        sessionStorage.setItem(PASSWORD_KEY, 'true');
        setIsAuthorized(true);
        setError('');
      } else {
        setError('Incorrect password. Please try again.');
      }
    };

    if (isAuthorized) {
      return <WrappedComponent {...props} />;
    }

    return (
      <Dialog open={!isAuthorized} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]" hideCloseButton>
          <DialogHeader>
            <DialogTitle>Authorization Required</DialogTitle>
            <DialogDescription>
              Please enter the password to access this page. The default is '1234'. You can change this in the .env.local file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password-input" className="text-right">
                Password
              </Label>
              <Input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="col-span-3"
              />
            </div>
            {error && <p className="text-sm text-destructive col-span-4 text-center">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handlePasswordSubmit}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return WithAuthComponent;
}
