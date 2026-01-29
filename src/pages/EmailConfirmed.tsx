import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

const EmailConfirmed = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/auth");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 relative overflow-hidden">
      {/* Subtle grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f8fafc_1px,transparent_1px),linear-gradient(to_bottom,#f8fafc_1px,transparent_1px)] bg-[size:6rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <Card className="w-full max-w-md shadow-2xl rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200/60 relative z-10 animate-fade-in">
        {/* Success accent line */}
        <div className="h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-600 rounded-t-2xl" />

        <CardHeader className="space-y-4 text-center pb-4 pt-8 px-6">
          {/* Success Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-bounce-slow">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
            </div>
          </div>

          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
            Email Confirmed!
          </CardTitle>
          <CardDescription className="text-slate-600 text-lg">
            Your email has been successfully verified
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-6 pb-8">
          <div className="space-y-4 text-center">
            <p className="text-slate-700">
              Thank you for confirming your email address. Your account is now fully activated and ready to use.
            </p>
            
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to login in {countdown} seconds...</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Go to Login Now
            </Button>
            
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full h-12 border-slate-200/60 bg-white/70 hover:bg-white hover:border-green-500/50 transition-all duration-300 rounded-xl"
            >
              Go to Dashboard
            </Button>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-center text-slate-500">
              You can now sign in with your email and password to access all features of BuyEvenn Vendor Suite.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmed;
