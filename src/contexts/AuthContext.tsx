import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, getAdminClient } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SignUpData {
  email: string;
  password: string;
  businessName: string;
  phone?: string;
}

interface Profile {
  id: string;
  business_name: string;
  phone?: string | null;
  category?: string | null;
  subscription_tier: string;
  subscription_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffProfile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  modules: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  staffProfile: StaffProfile | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isStaff: () => boolean;
  hasModuleAccess: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch user profile from public.profiles
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      setProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return { data: null, error };
    }
  };

  // Create or update profile
  const upsertProfile = async (userId: string, updates: Partial<Profile>) => {
    try {
      // Only include fields that exist in the Profile interface
      const validUpdates: Partial<Profile> = {
        business_name: updates.business_name,
        phone: updates.phone,
        category: updates.category,
        subscription_tier: updates.subscription_tier,
        subscription_expires_at: updates.subscription_expires_at,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...validUpdates })
        .select()
        .single();

      if (error) throw error;
      
      setProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { data: null, error };
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (data: SignUpData) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      // 1. Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (signUpError) {
        return { error: signUpError };
      }

      // 2. Create profile in public.profiles
      if (authData.user) {
        await upsertProfile(authData.user.id, {
          email: data.email,
          business_name: data.businessName,
          phone: data.phone,
          subscription_tier: 'free',
        });
      }

      navigate("/");
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { 
        error: { 
          message: 'Failed to create account. Please try again.' 
        } 
      };
    }
  };

  // Helper function to handle regular user login
  const handleRegularUserLogin = async (userId: string) => {
    try {
      // First, try to get the user's email from auth.users
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user data:', userError);
        return { error: userError };
      }

      const userEmail = userData.user?.email || `${userId}@user.com`;
      const currentTime = new Date().toISOString();

      // Check if profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profileData) {
        console.log('Creating new profile for user:', userId);
        
        // Minimal profile with only essential fields
        const newProfile: Partial<Profile> = {
          id: userId,
          email: userEmail,
          business_name: userEmail.split('@')[0] || 'New User',
          subscription_tier: 'free',
          created_at: currentTime,
          updated_at: currentTime
        };

        try {
          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();

          if (createError) throw createError;

          console.log('New profile created:', createdProfile);
          setProfile(createdProfile);
          navigate("/profile/setup");
          return { error: null };
        } catch (createError) {
          console.error('Error creating profile:', createError);
          // Try with even fewer fields if the first attempt fails
          const minimalProfile = {
            id: userId,
            email: userEmail,
            business_name: 'New User',
            created_at: currentTime,
            updated_at: currentTime
          };

          const { data: createdProfile, error: minimalError } = await supabase
            .from('profiles')
            .insert(minimalProfile)
            .select()
            .single();

          if (minimalError) {
            console.error('Minimal profile creation failed:', minimalError);
            return { 
              error: { 
                message: 'Failed to create user profile. Please contact support.' 
              } 
            };
          }

          console.log('Minimal profile created:', createdProfile);
          setProfile(createdProfile);
          navigate("/profile/setup");
          return { error: null };
        }

        console.log('New profile created:', createdProfile);
        setProfile(createdProfile);
        navigate("/profile/setup");
        return { error: null };
      }

      setProfile(profileData);
      navigate("/dashboard");
      return { error: null };
    } catch (error) {
      console.error('Error in handleRegularUserLogin:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with email:', email);
      
      // 1. Sign in with Supabase Auth
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        console.error('Authentication error:', signInError);
        return { error: signInError };
      }

      console.log('User authenticated, checking staff status for user ID:', authData.user.id);

      // 2. Get admin client to bypass RLS
      const adminClient = getAdminClient();
      if (!adminClient) {
        console.error('Admin client not available');
        return await handleRegularUserLogin(authData.user.id);
      }

      // 3. Check if user is a staff member using admin client
      const { data: staffData, error: staffError } = await adminClient
        .from('staff')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();  // Use maybeSingle to handle case when no staff record exists

      // If staff record exists and is active
      if (staffData && staffData.is_active) {
        console.log('Setting staff profile and redirecting to dashboard');
        setStaffProfile(staffData);
        navigate("/dashboard");
        return { error: null };
      }

      // If staff record exists but is inactive
      if (staffData && !staffData.is_active) {
        console.log('Staff account is deactivated, signing out');
        await supabase.auth.signOut();
        return { 
          error: { 
            message: 'This staff account has been deactivated. Please contact an administrator.' 
          } 
        };
      }

      // If no staff record found, proceed with regular user login
      console.log('No staff record found, checking for regular user profile');
      return await handleRegularUserLogin(authData.user.id);
      
      // 3. If not a staff member, check if it's a regular user with a profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
        navigate("/dashboard");
        return { error: null };
      }
      
      // If no profile found, sign them out and show error
      await supabase.auth.signOut();
      return { 
        error: { 
          message: 'No account found with these credentials.' 
        } 
      };
      
    } catch (error) {
      console.error('Error during sign in:', error);
      return { 
        error: { 
          message: 'An error occurred during sign in. Please try again.' 
        } 
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStaffProfile(null);
    setProfile(null);
    navigate("/auth");
  };
  
  const isStaff = () => {
    return staffProfile !== null;
  };
  
  const hasModuleAccess = (module: string) => {
    if (!staffProfile) return false;
    if (staffProfile.role === 'admin') return true;
    return staffProfile.modules?.includes(module) || false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      staffProfile,
      loading, 
      signUp, 
      signIn, 
      signOut,
      isStaff,
      hasModuleAccess,
      fetchProfile,
      upsertProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};