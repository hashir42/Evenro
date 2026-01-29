import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Phone, Mail, Users, Bell, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const CRM = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [communicationLogs, setCommunicationLogs] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [newLogDialogOpen, setNewLogDialogOpen] = useState(false);
  const [newReminderDialogOpen, setNewReminderDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ type: "call", notes: "" });
  const [reminderForm, setReminderForm] = useState({ title: "", description: "", dueDate: "" });

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchReminders();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("vendor_id", user!.id)
      .order("created_at", { ascending: false });
    if (data) setClients(data);
  };

  const fetchCommunicationLogs = async (clientId: string) => {
    const { data } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    if (data) setCommunicationLogs(data);
  };

  const fetchReminders = async () => {
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true });
    if (data) setReminders(data);
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to reminders for real-time updates
    const remindersSubscription = supabase
      .channel("reminders")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, (payload) => {
        if (payload.new && !payload.new.is_completed) {
          toast.info(`New reminder: ${payload.new.title}`);
          fetchReminders(); // Refresh list
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(remindersSubscription);
    };
  };

  const addCommunicationLog = async () => {
    if (!selectedClient) return;
    const { error } = await supabase.from("communication_logs").insert({
      client_id: selectedClient.id,
      type: logForm.type,
      notes: logForm.notes,
      user_id: user!.id,
    });
    if (!error) {
      toast.success("Log added");
      fetchCommunicationLogs(selectedClient.id);
      setNewLogDialogOpen(false);
      setLogForm({ type: "call", notes: "" });
    } else {
      toast.error("Failed to add log");
    }
  };

  const addReminder = async () => {
    if (!selectedClient) return;
    const { error } = await supabase.from("reminders").insert({
      client_id: selectedClient.id,
      title: reminderForm.title,
      description: reminderForm.description,
      due_date: new Date(reminderForm.dueDate).toISOString(),
      user_id: user!.id,
    });
    if (!error) {
      toast.success("Reminder set");
      fetchReminders();
      setNewReminderDialogOpen(false);
      setReminderForm({ title: "", description: "", dueDate: "" });
    } else {
      toast.error("Failed to set reminder");
    }
  };

  const updateClientStage = async (clientId: string, stage: string) => {
    const { error } = await supabase
      .from("clients")
      .update({ stage })
      .eq("id", clientId);
    if (!error) {
      toast.success("Stage updated");
      fetchClients();
    } else {
      toast.error("Failed to update stage");
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "lead": return "bg-blue-100 text-blue-800";
      case "prospect": return "bg-yellow-100 text-yellow-800";
      case "client": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">CRM - Client Management</h1>
        <p className="text-muted-foreground">Manage leads, prospects, and clients</p>
      </div>

      {/* Client List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Card key={client.id} className="cursor-pointer hover:shadow-md" onClick={() => {
            setSelectedClient(client);
            fetchCommunicationLogs(client.id);
          }}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {client.name}
                <Badge className={getStageColor(client.stage)}>{client.stage || "lead"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{client.email}</p>
              <p className="text-sm text-muted-foreground">{client.phone}</p>
              {client.stage && (
                <Select value={client.stage} onValueChange={(stage) => updateClientStage(client.id, stage)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client Detail Dialog */}
      {selectedClient && (
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedClient.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <p>{selectedClient.email}</p>
              </div>
              <div>
                <Label>Phone</Label>
                <p>{selectedClient.phone}</p>
              </div>
              <div>
                <Label>Stage</Label>
                <Select value={selectedClient.stage} onValueChange={(stage) => updateClientStage(selectedClient.id, stage)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Communication Logs */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Communication Logs</h3>
                  <Dialog open={newLogDialogOpen} onOpenChange={setNewLogDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Log</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Interaction Log</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <Select value={logForm.type} onValueChange={(type) => setLogForm({ ...logForm, type })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea placeholder="Notes" value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} />
                        <Button onClick={addCommunicationLog}>Save Log</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {communicationLogs.map((log) => (
                    <div key={log.id} className="p-2 border rounded">
                      <p className="font-medium">{log.type.toUpperCase()}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(log.date), "MMM d, yyyy")}</p>
                      <p className="text-sm">{log.notes}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reminders */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Reminders</h3>
                  <Dialog open={newReminderDialogOpen} onOpenChange={setNewReminderDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Bell className="mr-2 h-4 w-4" />Set Reminder</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Set Reminder</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <Input placeholder="Title" value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} />
                        <Textarea placeholder="Description" value={reminderForm.description} onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })} />
                        <Input type="datetime-local" value={reminderForm.dueDate} onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })} />
                        <Button onClick={addReminder}>Set Reminder</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-2">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="p-2 border rounded">
                      <p className="font-medium">{reminder.title}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(reminder.due_date), "MMM d, yyyy h:mm a")}</p>
                      <p className="text-sm">{reminder.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Upcoming Reminders Sidebar */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Upcoming Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reminders.length === 0 ? (
              <p className="text-muted-foreground">No upcoming reminders</p>
            ) : (
              reminders.map((reminder) => (
                <div key={reminder.id} className="p-2 border rounded">
                  <p className="font-medium">{reminder.title}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(reminder.due_date), "MMM d, yyyy h:mm a")}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CRM;