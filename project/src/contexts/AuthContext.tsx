import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  classNum?: string;
  subjects?: string[];
  examDate?: string;
  studyMode?: 'dependent' | 'independent';
  onboarded: boolean;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('clarity_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
    setLoading(false);
  }, []);

  // Save to localStorage when user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('clarity_user', JSON.stringify(user));
      // Also update the legacy ncertai_user so existing API calls keep working
      localStorage.setItem('ncertai_user', JSON.stringify({
        name: user.id, // Using ID as the X-User-ID for now
        class: user.classNum || '10',
        subjects: user.subjects || []
      }));
    } else {
      localStorage.removeItem('clarity_user');
    }
  }, [user]);


  const loginWithEmail = async (email: string) => {
    // Mock Email Login
    const mockUser: UserProfile = {
      id: 'mock-email-user-' + Date.now(),
      email,
      onboarded: false,
    };
    setUser(mockUser);
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
