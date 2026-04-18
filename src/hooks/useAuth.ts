import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export interface AppUser {
  uid: string;
  email: string | null;
  role: "admin" | "editor";
  displayName: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setAppUser(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "app_users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setAppUser({ uid: user.uid, ...docSnap.data() } as AppUser);
      } else {
        // Fallback for super admin or new users
        if (user.email === "akashkamble.jb007@gmail.com") {
          setAppUser({
            uid: user.uid,
            email: user.email,
            role: "admin",
            displayName: user.displayName,
          });
        } else {
          setAppUser(null);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Auth snapshot error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  return { user, appUser, loading };
}
