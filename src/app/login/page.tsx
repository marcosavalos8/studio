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
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { verifyPassword } from "@/lib/auth-utils";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const firestore = useFirestore();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Trim whitespace from email/username and password
      const trimmedInput = emailOrUsername.trim();
      const trimmedPassword = password.trim();

      // First, try the hardcoded credentials for backward compatibility
      if (trimmedInput === "JMAG" && trimmedPassword === "2025") {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("username", trimmedInput);
        localStorage.setItem("userRole", "Admin"); // JMAG is an admin
        login(trimmedInput, "Admin");
        router.push("/dashboard");
        return;
      }

      // Determine if input is email or username
      const isEmail = trimmedInput.includes('@');

      // For username-based logins only: look up user in Firestore first
      // (skip this for email logins to avoid unnecessary DB calls)
      if (!isEmail && firestore) {
        const usersQuery = query(collection(firestore, 'users'), where('username', '==', trimmedInput));
        const usersSnapshot = await getDocs(usersQuery);

        if (!usersSnapshot.empty) {
          const userDoc = usersSnapshot.docs[0];
          const userData = userDoc.data();

          // Handle non-auth (User role) login: verify password hash in Firestore
          if (userData.noAuth === true) {
            if (userData.status === "Inactive") {
              setError("Your account is inactive. Please contact an administrator.");
              setLoading(false);
              return;
            }

            // Verify password using salt if available, fall back to unsalted hash
            let passwordMatch = false;
            if (userData.passwordSalt) {
              passwordMatch = await verifyPassword(trimmedPassword, userData.passwordSalt, userData.passwordHash);
            } else {
              // Legacy: unsalted SHA-256 (for accounts created before salt was added)
              const msgBuffer = new TextEncoder().encode(trimmedPassword);
              const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              const legacyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
              passwordMatch = legacyHash === userData.passwordHash;
            }

            if (!passwordMatch) {
              setError("Invalid credentials. Please check your username and password.");
              setLoading(false);
              return;
            }

            const displayName = userData.displayName || userData.fullName || trimmedInput;
            const role = userData.role || "User";
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("username", displayName);
            localStorage.setItem("userRole", role);
            login(displayName, role);
            router.push("/dashboard");
            return;
          }
        }
      }

      // Auth-based login (email or username → email lookup)
      let userEmail = trimmedInput;

      // If it's a username, look up the email in Firestore
      if (!isEmail && firestore) {
        const usersQuery = query(collection(firestore, 'users'), where('username', '==', trimmedInput));
        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
          setError("User not found. Please check your username.");
          setLoading(false);
          return;
        }

        // Get the email from the user document
        const userDoc = usersSnapshot.docs[0];
        userEmail = userDoc.data().email;
      }

      // Try Firebase Authentication with email
      const userCredential = await signInWithEmailAndPassword(auth, userEmail, trimmedPassword);
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
          const displayName = userData.displayName || userData.fullName || user.email || "User";
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
    } catch (error: unknown) {
      console.error("Login error:", error);
      const firebaseError = error as { code?: string };
      
      // Handle specific Firebase Auth errors
      if (firebaseError.code === "auth/user-not-found" || firebaseError.code === "auth/wrong-password") {
        setError("Invalid credentials. Please check your email/username and password.");
      } else if (firebaseError.code === "auth/invalid-email") {
        setError("Invalid email format. If using a username, make sure it's correct.");
      } else if (firebaseError.code === "auth/user-disabled") {
        setError("This account has been disabled");
      } else if (firebaseError.code === "auth/invalid-credential") {
        setError("Invalid credentials. Please check your email/username and password.");
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
              <Label htmlFor="emailOrUsername">Email / Username</Label>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder="Enter your email or username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                className="w-full"
                autoComplete="username"
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
