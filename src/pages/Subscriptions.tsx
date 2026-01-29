import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Crown, Zap, Download, CreditCard, History, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import ErrorBoundary from "@/components/ErrorBoundary";

const Subscriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [currentVendorSub, setCurrentVendorSub] = useState<any>(null); // from new user_subscriptions
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [vendorPayments, setVendorPayments] = useState<any[]>([]); // from new subscription_payments
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchPlans();
    fetchCurrentSubscription();
    fetchVendorSubscription();
    fetchPaymentHistory();
    fetchVendorPayments();
    fetchInvoices();
  }, [user]);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive",
      });
    } else {
      setPlans(data || []);
    }
  };

  const fetchCurrentSubscription = async () => {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq("user_id", user!.id)
      .eq("status", "active")
      .single();

    if (!error && data) {
      setCurrentSubscription(data);
    }
  };

  // New schema: user_subscriptions with vendor_id, plan, renews_at
  const fetchVendorSubscription = async () => {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("plan, renews_at, status")
      .eq("vendor_id", user!.id)
      .single();
    if (!error && data) setCurrentVendorSub(data);
  };

  const fetchPaymentHistory = async () => {
    const { data } = await supabase
      .from("payment_history")
      .select(`
        *,
        subscription_plans (name)
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setPaymentHistory(data || []);
  };

  // New schema: subscription_payments by vendor_id
  const fetchVendorPayments = async () => {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select("id, amount, currency, paid_at, notes")
      .eq("vendor_id", user!.id)
      .order("paid_at", { ascending: false })
      .limit(10);
    if (!error && data) setVendorPayments(data);
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select(`
        *,
        subscription_plans (name)
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setInvoices(data || []);
  };

  const handleSubscribe = async (planId: string, planName: string, price: number) => {
    // Demo: In production, integrate with Razorpay
    const { data: payment, error: paymentError } = await supabase
      .from("payment_history")
      .insert({
        user_id: user!.id,
        subscription_plan_id: planId,
        amount: price,
        status: "pending",
        payment_method: "razorpay",
      })
      .select()
      .single();

    if (paymentError) {
      toast({
        title: "Error",
        description: "Failed to initiate payment",
        variant: "destructive",
      });
      return;
    }

    // Create subscription
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription

    const { error: subError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: user!.id,
        subscription_plan_id: planId,
        status: "active",
        end_date: endDate.toISOString(),
      });

    if (subError) {
      toast({
        title: "Error",
        description: "Failed to create subscription",
        variant: "destructive",
      });
      return;
    }

    // Update payment status
    await supabase
      .from("payment_history")
      .update({ status: "completed" })
      .eq("id", payment.id);

    // Generate invoice
    const invoiceNumber = `INV-${Date.now()}`;
    await supabase
      .from("invoices")
      .insert({
        user_id: user!.id,
        invoice_number: invoiceNumber,
        subscription_plan_id: planId,
        amount: price,
        tax_amount: price * 0.18, // 18% GST
        total_amount: price * 1.18,
        status: "paid",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        payment_history_id: payment.id,
      });

    toast({
      title: "Success",
      description: `Successfully subscribed to ${planName}!`,
    });

    fetchCurrentSubscription();
    fetchPaymentHistory();
    fetchInvoices();
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) return;

    // Try legacy user-centric schema: update by id if present
    if (currentSubscription?.id) {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({ status: "cancelled", auto_renew: false })
        .eq("id", currentSubscription.id);

      if (error) {
        toast({ title: "Error", description: `Failed to cancel subscription (legacy): ${error.message}`, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Subscription cancelled", });
        fetchCurrentSubscription();
      }
      return;
    }

    // New vendor-centric schema: update by vendor_id; field auto_renew may not exist
    if (currentVendorSub) {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({ status: "cancelled" })
        .eq("vendor_id", user!.id);

      if (error) {
        toast({ title: "Error", description: `Failed to cancel subscription: ${error.message}` , variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Subscription cancelled", });
        fetchVendorSubscription();
      }
    }
  };

  const downloadInvoice = async (invoice: any) => {
    // Simple invoice download - in production, generate PDF
    const invoiceData = `
Invoice #${invoice.invoice_number}
Date: ${format(new Date(invoice.issue_date), "PPP")}
Plan: ${invoice.subscription_plans?.name || "N/A"}
Amount: ₹${invoice.amount}
Tax (18%): ₹${invoice.tax_amount}
Total: ₹${invoice.total_amount}
Status: ${invoice.status}
    `;
    
    const blob = new Blob([invoiceData], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.invoice_number}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your plans, payments, and invoices
          </p>
        </div>

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          {(currentSubscription || currentVendorSub) && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentSubscription && (
                    <>
                      <p>
                        <span className="font-medium">Plan:</span>{" "}
                        <Badge variant="secondary" className="ml-2">
                          {currentSubscription.subscription_plans?.name}
                        </Badge>
                      </p>
                      <p>
                        <span className="font-medium">Status:</span>{" "}
                        <Badge variant={currentSubscription.status === "active" ? "default" : "secondary"}>
                          {currentSubscription.status}
                        </Badge>
                      </p>
                      <p>
                        <span className="font-medium">Started:</span>{" "}
                        {format(new Date(currentSubscription.start_date), "PPP")}
                      </p>
                      <p>
                        <span className="font-medium">Expires:</span>{" "}
                        {format(new Date(currentSubscription.end_date), "PPP")}
                      </p>
                      <p>
                        <span className="font-medium">Auto Renew:</span>{" "}
                        {currentSubscription.auto_renew ? "Yes" : "No"}
                      </p>
                    </>
                  )}
                  {currentVendorSub && (
                    <>
                      <p>
                        <span className="font-medium">Plan:</span>{" "}
                        <Badge variant="secondary" className="ml-2">
                          {currentVendorSub.plan}
                        </Badge>
                      </p>
                      <p>
                        <span className="font-medium">Status:</span>{" "}
                        <Badge variant={currentVendorSub.status === "active" ? "default" : "secondary"}>
                          {currentVendorSub.status}
                        </Badge>
                      </p>
                      {currentVendorSub.renews_at && (
                        <p>
                          <span className="font-medium">Renews At:</span>{" "}
                          {format(new Date(currentVendorSub.renews_at), "PPP")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  onClick={handleCancelSubscription}
                  className="w-full"
                >
                  Cancel Subscription
                </Button>
              </CardFooter>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  currentSubscription?.subscription_plan_id === plan.id
                    ? "border-primary shadow-lg"
                    : ""
                }`}
              >
                {currentSubscription?.subscription_plan_id === plan.id && (
                  <Badge className="absolute top-4 right-4">Current Plan</Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-4xl font-bold">₹{plan.price.toLocaleString()}</span>
                    <span className="text-muted-foreground">/{plan.billing_cycle}</span>
                  </div>

                  {plan.features && Array.isArray(plan.features) && (
                    <ul className="space-y-2">
                      {plan.features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.id, plan.name, plan.price)}
                    disabled={currentSubscription?.subscription_plan_id === plan.id}
                  >
                    {currentSubscription?.subscription_plan_id === plan.id
                      ? "Current Plan"
                      : plan.price === 0
                      ? "Start Free"
                      : "Subscribe Now"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {plans.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground text-center">
                  No subscription plans available at the moment.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentHistory.length === 0 && vendorPayments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No payment history yet
                </p>
              ) : (
                <div className="space-y-4">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">{payment.subscription_plans?.name || "Payment"}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(payment.created_at), "PPP")}</p>
                        <p className="text-xs text-muted-foreground">Method: {payment.payment_method} • Gateway: {payment.payment_gateway}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-bold text-lg">₹{payment.amount.toLocaleString()}</p>
                        <Badge variant={payment.status === "completed" ? "default" : payment.status === "pending" ? "secondary" : "destructive"}>{payment.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {vendorPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Subscription Payment</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(p.paid_at), "PPP")}</p>
                        {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-bold text-lg">{p.currency === 'INR' ? '₹' : p.currency} {Number(p.amount).toLocaleString()}</p>
                        <Badge variant="default">paid</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No invoices yet
                </p>
              ) : (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.subscription_plans?.name || "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Issue Date: {format(new Date(invoice.issue_date), "PP")} • 
                          Due: {format(new Date(invoice.due_date), "PP")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right space-y-1">
                          <p className="font-bold">₹{invoice.total_amount.toLocaleString()}</p>
                          <Badge
                            variant={
                              invoice.status === "paid"
                                ? "default"
                                : invoice.status === "draft"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadInvoice(invoice)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </ErrorBoundary>
  );
};

export default Subscriptions;