import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [isMounted, setIsMounted] = useState(false);
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();

  // Wait for component to mount before using auth context
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // If not mounted yet, show loading state
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp({
      email,
      password,
      businessName,
      phone,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created successfully!");
    }

    setLoading(false);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-0 md:p-8 relative overflow-hidden">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f8fafc_1px,transparent_1px),linear-gradient(to_bottom,#f8fafc_1px,transparent_1px)] bg-[size:6rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <Card className="w-full h-full md:h-auto md:max-w-lg shadow-2xl rounded-none md:rounded-2xl bg-white/70 backdrop-blur-xl border-0 md:border border-slate-200/60 relative z-10 overflow-y-auto">
        {/* Gold accent line */}
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-t-xl md:rounded-t-2xl" />

        <CardHeader className="space-y-2 md:space-y-4 text-center pb-2 pt-4 md:pt-6 px-4 md:px-6">
          {/* Enhanced Logo */}
          <div className="flex items-center justify-center mb-2 md:mb-4">
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-xl md:text-2xl font-bold text-white animate-pulse">B</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-yellow-500 rounded-full animate-ping" />
            </div>
          </div>

          <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
            BuyEvenn Vendor Suite
          </CardTitle>
          <CardDescription className="text-slate-600 text-sm md:text-lg">
            Manage your event business with ease
          </CardDescription>
        </CardHeader>

        <Tabs defaultValue="signin" className="w-full px-4 md:px-6">
          <TabsList className="grid w-full grid-cols-2 gap-1 md:gap-2 p-1 h-auto bg-slate-100/50 rounded-full">
            <TabsTrigger
              value="signin"
              className="rounded-full py-2.5 md:py-3 px-4 md:px-6 text-xs md:text-sm font-medium transition-all duration-300 data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/70 touch-feedback"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="rounded-full py-2.5 md:py-3 px-4 md:px-6 text-xs md:text-sm font-medium transition-all duration-300 data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-200/70 touch-feedback"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4 md:mt-6">
            <form onSubmit={handleSignIn}>
              <CardContent className="space-y-4 md:space-y-6 px-0 pb-3 md:pb-4">
                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="signin-email" className="text-xs md:text-sm font-medium text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="vendor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 md:h-12 bg-white/70 border-slate-200/60 rounded-lg md:rounded-xl px-3 md:px-4 text-sm md:text-base text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300"
                  />
                </div>
                <div className="space-y-2 md:space-y-3">
                  <Label htmlFor="signin-password" className="text-xs md:text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 md:h-12 bg-white/70 border-slate-200/60 rounded-lg md:rounded-xl px-3 md:px-4 text-sm md:text-base text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300"
                  />
                </div>
              </CardContent>
              <CardFooter className="px-0 pb-4 md:pb-6">
                <Button
                  type="submit"
                  className="w-full h-11 md:h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium text-sm md:text-base rounded-lg md:rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 touch-feedback"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In to Your Account
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4 md:mt-6">
            <form onSubmit={handleSignUp}>
              <CardContent className="space-y-3 md:space-y-6 px-0 pb-3 md:pb-4">
                <div className="space-y-3">
                  <Label htmlFor="signup-business" className="text-sm font-medium text-slate-700">
                    Business Name
                  </Label>
                  <Input
                    id="signup-business"
                    type="text"
                    placeholder="Your Event Business"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    className="h-12 bg-white/70 border-slate-200/60 rounded-xl px-4 text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-email" className="text-sm font-medium text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="vendor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-white/70 border-slate-200/60 rounded-xl px-4 text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-phone" className="text-sm font-medium text-slate-700">
                    Phone Number
                  </Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 bg-white/70 border-slate-200/60 rounded-xl px-4 text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 bg-white/70 border-slate-200/60 rounded-xl px-4 text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-300"
                  />
                </div>
              </CardContent>
              <CardFooter className="px-0 pb-6">
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Your Account
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>

        {/* Social Login Section */}
        <div className="px-4 md:px-6 pb-4 md:pb-6">
          <div className="relative">
            <Separator className="my-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-white px-2 text-xs text-slate-500">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3 mt-4">
            <Button
              variant="outline"
              className="h-10 md:h-12 border-slate-200/60 bg-white/70 hover:bg-white hover:border-yellow-500/50 transition-all duration-300 rounded-lg md:rounded-xl text-xs md:text-sm touch-feedback"
              onClick={() => toast.info("Google login coming soon!")}
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              className="h-10 md:h-12 border-slate-200/60 bg-white/70 hover:bg-white hover:border-yellow-500/50 transition-all duration-300 rounded-lg md:rounded-xl text-xs md:text-sm touch-feedback"
              onClick={() => toast.info("Facebook login coming soon!")}
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" viewBox="0 0 24 24">
                <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;