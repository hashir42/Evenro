import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Save, Users, User, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    business_name: "",
    email: "",
    phone: ""
  });

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } else if (data) {
      setFormData({
        business_name: data.business_name || "",
        email: data.email || "",
        phone: data.phone || ""
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          business_name: formData.business_name,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (error) throw error;
      
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Manage your account and preferences</p>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span>Account</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader className="pb-4 pt-6 px-6 border-b">
              <CardTitle className="flex items-center gap-3 text-xl font-semibold">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                Business Profile
              </CardTitle>
            </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="business_name" className="text-sm font-medium">Business Name</Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  placeholder="Your Business Name"
                  className="rounded-lg border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-medium">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@example.com"
                  className="rounded-lg border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="rounded-lg border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
              </div>

            </div>

            <div className="flex justify-end pt-3 md:pt-4">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto px-6 md:px-8 py-2 md:py-3 touch-feedback">
                <Save className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
            <CardHeader className="pb-4 md:pb-6 pt-4 md:pt-8 px-4 md:px-8">
              <CardTitle className="text-base md:text-xl font-semibold">Account Information</CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 px-4 md:px-8 pb-4 md:pb-8">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">User ID</p>
                  <p className="text-sm font-mono bg-muted/50 px-4 py-2 rounded-lg">{user?.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Account Email</p>
                  <p className="text-sm bg-muted/50 px-4 py-2 rounded-lg mb-4">{user?.email}</p>
                  <Button 
                    onClick={() => supabase.auth.signOut()}
                    variant="outline"
                    className="w-full mt-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" x2="9" y1="12" y2="12"/>
                    </svg>
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
