"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/icons/logo";
import { useAuth } from "@/contexts/auth-context";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const firestore = useFirestore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Trim whitespace from email and password
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      // First, try the hardcoded credentials for backward compatibility
      if (trimmedEmail === "David" && trimmedPassword === "1234") {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("username", trimmedEmail);
        localStorage.setItem("userRole", "Admin"); // David is an admin
        login(trimmedEmail, "Admin");
        router.push("/dashboard");
        return;
      }

      // Try Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const user = userCredential.user;

      // Check if user exists in Firestore and is active
      if (firestore) {
        const userDocRef = doc(firestore, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.status === "Inactive") {
            setError("Your account is inactive. Please contact an administrator.");
            setLoading(false);
            return;
          }

          // Store user info and redirect
          const displayName = userData.displayName || user.email || "User";
          const role = userData.role || "User";
          
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("username", displayName);
          localStorage.setItem("userRole", role);
          login(displayName, role);
          router.push("/dashboard");
        } else {
          setError("User not found in system. Please contact an administrator.");
          setLoading(false);
        }
      } else {
        // Firestore not available, allow login anyway
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("username", user.email || "User");
        localStorage.setItem("userRole", "User");
        login(user.email || "User", "User");
        router.push("/dashboard");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Handle specific Firebase Auth errors
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        setError("Invalid email or password");
      } else if (error.code === "auth/invalid-email") {
        setError("Please enter a valid email address");
      } else if (error.code === "auth/user-disabled") {
        setError("This account has been disabled");
      } else if (error.code === "auth/invalid-credential") {
        setError("Invalid email or password. Please check your credentials.");
      } else {
        setError("Failed to login. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Enter your credentials to access FieldTack WA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="text"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive text-center">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
