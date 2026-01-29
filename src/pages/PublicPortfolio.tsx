import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const PublicPortfolio = () => {
  const { id } = useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPortfolioItem();
    }
  }, [id]);

  const fetchPortfolioItem = async () => {
    const { data, error } = await supabase
      .from("portfolio_items")
      .select("*, entities(name), profiles(business_name, phone, email)")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error) {
      toast.error("Portfolio item not found");
      setLoading(false);
    } else {
      setItem(data);
      setLoading(false);
    }
  };

  const shareViaWhatsApp = () => {
    if (!item) return;
    const message = `Check out: ${item.title}${item.price ? ` - ₹${item.price}` : ""}\n${window.location.href}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 px-6 text-center">
            <p className="text-muted-foreground">Portfolio item not found</p>
            <Button className="mt-4" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={shareViaWhatsApp}>
            <Share2 className="mr-2 h-4 w-4" />
            Share via WhatsApp
          </Button>
        </div>

        <Card className="shadow-lg">
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img
              src={item.image_url}
              alt={item.title}
              className="object-cover w-full h-full"
            />
          </div>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-3xl">{item.title}</CardTitle>
                {item.entities?.name && (
                  <p className="text-sm text-primary font-medium mt-2">📍 {item.entities.name}</p>
                )}
              </div>
              {item.price && (
                <div className="text-3xl font-bold text-primary">
                  ₹{Number(item.price).toLocaleString()}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {item.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>
              </div>
            )}

            {item.profiles && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-3">Vendor Information</h3>
                <div className="space-y-2">
                  {item.profiles.business_name && (
                    <p className="text-sm">
                      <span className="font-medium">Business:</span> {item.profiles.business_name}
                    </p>
                  )}
                  {item.profiles.phone && (
                    <p className="text-sm">
                      <span className="font-medium">Phone:</span>{" "}
                      <a href={`tel:${item.profiles.phone}`} className="text-primary hover:underline">
                        {item.profiles.phone}
                      </a>
                    </p>
                  )}
                  {item.profiles.email && (
                    <p className="text-sm">
                      <span className="font-medium">Email:</span>{" "}
                      <a href={`mailto:${item.profiles.email}`} className="text-primary hover:underline">
                        {item.profiles.email}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button className="flex-1" onClick={shareViaWhatsApp}>
                <Share2 className="mr-2 h-4 w-4" />
                Share via WhatsApp
              </Button>
              {item.profiles?.phone && (
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`https://wa.me/${item.profiles.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                    Contact Vendor
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicPortfolio;
