import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Plus, Pencil, Trash2, Receipt, TrendingDown, Calendar, Search, X, Filter
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

const EXPENSE_CATEGORIES = [
    "Equipment",
    "Travel",
    "Food & Catering",
    "Decoration",
    "Photography",
    "Videography",
    "Venue",
    "Marketing",
    "Staff",
    "Utilities",
    "Printing",
    "Software",
    "Other",
];

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Other"];

const categoryColors: Record<string, string> = {
    Equipment: "bg-blue-100 text-blue-800",
    Travel: "bg-orange-100 text-orange-800",
    "Food & Catering": "bg-yellow-100 text-yellow-800",
    Decoration: "bg-pink-100 text-pink-800",
    Photography: "bg-purple-100 text-purple-800",
    Videography: "bg-indigo-100 text-indigo-800",
    Venue: "bg-green-100 text-green-800",
    Marketing: "bg-red-100 text-red-800",
    Staff: "bg-teal-100 text-teal-800",
    Utilities: "bg-gray-100 text-gray-800",
    Printing: "bg-cyan-100 text-cyan-800",
    Software: "bg-violet-100 text-violet-800",
    Other: "bg-slate-100 text-slate-800",
};

const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    vendor: "",
    payment_mode: "Cash",
    booking_id: "",
    notes: "",
};

const Expenses = () => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
    const [formData, setFormData] = useState({ ...emptyForm });
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [bookingFilter, setBookingFilter] = useState("all");

    useEffect(() => {
        if (user) {
            fetchExpenses();
            fetchBookings();
        }
    }, [user]);

    const fetchExpenses = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from("expenses")
            .select("*, bookings(event_name, event_date)")
            .eq("vendor_id", user!.id)
            .order("date", { ascending: false });

        if (error) {
            toast.error("Failed to fetch expenses");
            console.error(error);
        } else {
            setExpenses(data || []);
        }
        setIsLoading(false);
    };

    const fetchBookings = async () => {
        const { data, error } = await supabase
            .from("bookings")
            .select("id, event_name, event_date")
            .eq("vendor_id", user!.id)
            .neq("status", "cancelled")
            .order("event_date", { ascending: false });

        if (!error) setBookings(data || []);
    };

    const openAddDialog = () => {
        setEditingExpense(null);
        setFormData({ ...emptyForm });
        setDialogOpen(true);
    };

    const openEditDialog = (expense: any) => {
        setEditingExpense(expense);
        setFormData({
            date: expense.date || new Date().toISOString().split("T")[0],
            category: expense.category || "",
            description: expense.description || "",
            amount: String(expense.amount || ""),
            vendor: expense.vendor || "",
            payment_mode: expense.payment_mode || "Cash",
            booking_id: expense.booking_id || "",
            notes: expense.notes || "",
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.category) { toast.error("Please select a category"); return; }
        if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
            toast.error("Please enter a valid amount"); return;
        }
        if (!formData.vendor.trim()) { toast.error("Please enter a vendor/payee name"); return; }
        if (!formData.date) { toast.error("Please select a date"); return; }

        const payload: any = {
            vendor_id: user!.id,
            date: formData.date,
            category: formData.category,
            description: formData.description || null,
            amount: Number(formData.amount),
            vendor: formData.vendor.trim(),
            payment_mode: formData.payment_mode,
            booking_id: formData.booking_id || null,
        };

        if (editingExpense) {
            const { error } = await supabase
                .from("expenses")
                .update(payload)
                .eq("id", editingExpense.id)
                .eq("vendor_id", user!.id);
            if (error) { toast.error("Failed to update expense"); return; }
            toast.success("Expense updated");
        } else {
            const { error } = await supabase.from("expenses").insert([payload]);
            if (error) { toast.error("Failed to add expense"); return; }
            toast.success("Expense added");
        }

        setDialogOpen(false);
        fetchExpenses();
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;
        const { error } = await supabase
            .from("expenses")
            .delete()
            .eq("id", expenseToDelete)
            .eq("vendor_id", user!.id);
        if (error) { toast.error("Failed to delete expense"); }
        else { toast.success("Expense deleted"); fetchExpenses(); }
        setDeleteDialogOpen(false);
        setExpenseToDelete(null);
    };

    // Computed values
    const now = new Date();
    const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);

    const thisMonthExpenses = useMemo(() => {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        return expenses
            .filter(e => {
                const d = new Date(e.date);
                return d >= start && d <= end;
            })
            .reduce((s, e) => s + Number(e.amount || 0), 0);
    }, [expenses]);

    const categoryTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        expenses.forEach(e => {
            totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
        });
        return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [expenses]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchesSearch =
                !searchQuery ||
                e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.bookings?.event_name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
            const matchesBooking = bookingFilter === "all" || e.booking_id === bookingFilter;
            return matchesSearch && matchesCategory && matchesBooking;
        });
    }, [expenses, searchQuery, categoryFilter, bookingFilter]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Expenses
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Track all your business expenses per booking</p>
                </div>
                <Button onClick={openAddDialog} className="btn-primary w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Add Expense
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="glass card-hover rounded-xl border-0 shadow-card">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <TrendingDown className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Total Expenses</p>
                                <p className="text-xl font-bold text-foreground">₹{totalExpenses.toLocaleString("en-IN")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass card-hover rounded-xl border-0 shadow-card">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">This Month</p>
                                <p className="text-xl font-bold text-foreground">₹{thisMonthExpenses.toLocaleString("en-IN")}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass card-hover rounded-xl border-0 shadow-card">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Receipt className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Total Records</p>
                                <p className="text-xl font-bold text-foreground">{expenses.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Categories */}
            {categoryTotals.length > 0 && (
                <Card className="glass rounded-xl border-0 shadow-card">
                    <CardHeader className="pb-2 pt-4 px-5">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Top Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                        <div className="flex flex-wrap gap-2">
                            {categoryTotals.map(([cat, total]) => (
                                <div key={cat} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                                    <Badge className={`text-xs ${categoryColors[cat] || "bg-gray-100 text-gray-800"}`}>{cat}</Badge>
                                    <span className="text-sm font-semibold">₹{total.toLocaleString("en-IN")}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    )}
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-full sm:w-44">
                        <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={bookingFilter} onValueChange={setBookingFilter}>
                    <SelectTrigger className="h-9 w-full sm:w-52">
                        <SelectValue placeholder="All bookings" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Bookings</SelectItem>
                        <SelectItem value="unlinked">Unlinked</SelectItem>
                        {bookings.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                                {b.event_name}{b.event_date ? ` (${format(new Date(b.event_date), "dd MMM yy")})` : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Expenses Table */}
            <Card className="glass rounded-xl border-0 shadow-card overflow-hidden">
                {isLoading ? (
                    <CardContent className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </CardContent>
                ) : filteredExpenses.length === 0 ? (
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Receipt className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground text-lg mb-1">No expenses found</p>
                        <p className="text-muted-foreground/60 text-sm">Click "Add Expense" to record your first expense</p>
                    </CardContent>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Booking</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Category</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Description</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Vendor / Payee</th>
                                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Mode</th>
                                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {filteredExpenses.map(expense => (
                                    <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                            {expense.date ? format(new Date(expense.date), "dd MMM yyyy") : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            {expense.bookings?.event_name ? (
                                                <span className="text-xs bg-muted rounded px-2 py-0.5 font-medium">
                                                    {expense.bookings.event_name}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/50 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className={`text-xs ${categoryColors[expense.category] || "bg-gray-100 text-gray-800"}`}>
                                                {expense.category}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground max-w-[180px] truncate">
                                            {expense.description || "—"}
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell text-foreground font-medium">
                                            {expense.vendor || "—"}
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                                            {expense.payment_mode || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                                            ₹{Number(expense.amount).toLocaleString("en-IN")}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => openEditDialog(expense)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => { setExpenseToDelete(expense.id); setDeleteDialogOpen(true); }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {filteredExpenses.length > 0 && (
                                <tfoot>
                                    <tr className="border-t-2 border-border bg-muted/20">
                                        <td colSpan={6} className="px-4 py-3 font-semibold text-sm text-muted-foreground hidden md:table-cell">
                                            Total ({filteredExpenses.length} records)
                                        </td>
                                        <td colSpan={6} className="px-4 py-3 font-semibold text-sm text-muted-foreground md:hidden">
                                            Total
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-foreground text-base">
                                            ₹{filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0).toLocaleString("en-IN")}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="md:max-w-lg w-full rounded-t-2xl md:rounded-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">
                            {editingExpense ? "Edit Expense" : "Add Expense"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Booking selector */}
                        <div className="space-y-1.5">
                            <Label htmlFor="booking_id">Booking (optional)</Label>
                            <Select
                                value={formData.booking_id || "none"}
                                onValueChange={v => setFormData(p => ({ ...p, booking_id: v === "none" ? "" : v }))}
                            >
                                <SelectTrigger id="booking_id" className="h-10">
                                    <SelectValue placeholder="Select a booking…" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— No booking —</SelectItem>
                                    {bookings.map(b => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.event_name}{b.event_date ? ` · ${format(new Date(b.event_date), "dd MMM yyyy")}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="date">Date *</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="amount">Amount (₹) *</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="category">Category *</Label>
                                <Select value={formData.category || "none"} onValueChange={v => setFormData(p => ({ ...p, category: v === "none" ? "" : v }))}>
                                    <SelectTrigger id="category" className="h-10">
                                        <SelectValue placeholder="Select…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" disabled>Select category</SelectItem>
                                        {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="payment_mode">Payment Mode</Label>
                                <Select value={formData.payment_mode} onValueChange={v => setFormData(p => ({ ...p, payment_mode: v }))}>
                                    <SelectTrigger id="payment_mode" className="h-10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="vendor">Vendor / Payee *</Label>
                            <Input
                                id="vendor"
                                placeholder="e.g. ABC Rentals, Uber, etc."
                                value={formData.vendor}
                                onChange={e => setFormData(p => ({ ...p, vendor: e.target.value }))}
                                className="h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="What was this expense for?"
                                value={formData.description}
                                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                rows={2}
                                className="resize-none"
                            />
                        </div>
                    </div>

                    <Separator />
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className="btn-primary flex-1 sm:flex-none">
                            {editingExpense ? "Update" : "Add Expense"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="md:max-w-sm w-full rounded-t-2xl md:rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Delete Expense</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure you want to delete this expense? This action cannot be undone.</p>
                    <DialogFooter className="gap-2 pt-2">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} className="flex-1 sm:flex-none">Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Expenses;
