import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTopOnChange";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import { Download, Plus, Upload, DollarSign, TrendingUp, TrendingDown, FileText, Calendar, Filter, FileDown, FileText as FileTextIcon, MoreHorizontal, Edit, Trash2, CheckCircle2, Banknote, Smartphone, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface Expense {
  id?: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_mode: string;
  receipt_url?: string;
}

const Accounts = () => {
  // Set initial date at the start of the component
  const currentDate = new Date();
  
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [pnlViewMode, setPnlViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  
  // Update selected month when year changes to ensure it's valid
  useEffect(() => {
    const currentDate = new Date();
    if (selectedYear === currentDate.getFullYear()) {
      setSelectedMonth(currentDate.getMonth() + 1);
    } else {
      // If not current year, default to January
      setSelectedMonth(1);
    }
  }, [selectedYear]);
  
  // Date range filters
  const [incomeDateFrom, setIncomeDateFrom] = useState("");
  const [incomeDateTo, setIncomeDateTo] = useState("");
  const [expenseDateFrom, setExpenseDateFrom] = useState("");
  const [expenseDateTo, setExpenseDateTo] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  
  // Month pagination
  const [incomeCurrentMonth, setIncomeCurrentMonth] = useState(new Date());
  const [expenseCurrentMonth, setExpenseCurrentMonth] = useState(new Date());
  const [ledgerCurrentMonth, setLedgerCurrentMonth] = useState(new Date());
  
  // Pagination state for income
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Scroll to top when pagination changes
  useScrollToTopOnChange([currentPage, itemsPerPage]);
  
  // Pagination state for expenses
  const [expenseCurrentPage, setExpenseCurrentPage] = useState(1);
  const [expenseItemsPerPage, setExpenseItemsPerPage] = useState(10);
  
  // Scroll to top when expense pagination changes
  useScrollToTopOnChange([expenseCurrentPage, expenseItemsPerPage]);
  
  // Pagination state for ledger
  const [ledgerCurrentPage, setLedgerCurrentPage] = useState(1);
  const [ledgerItemsPerPage, setLedgerItemsPerPage] = useState(10);
  
  // Scroll to top when ledger pagination changes
  useScrollToTopOnChange([ledgerCurrentPage, ledgerItemsPerPage]);
  
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  
  const [expenseForm, setExpenseForm] = useState<Expense & { entity_id?: string }>({
    date: currentDate.toISOString().split("T")[0],
    category: "",
    description: "",
    amount: NaN, // Changed from 0 to NaN to make it empty by default
    payment_mode: "cash",
    entity_id: ""
  });

  // Function to handle editing an expense
  const handleEditExpense = (expense: Expense) => {
    setExpenseForm({
      ...expense,
      amount: Number(expense.amount) // Ensure amount is a number
    });
    setIsEditingExpense(true);
    setIsExpenseDialogOpen(true);
  };

  // Function to reset the expense form
  const resetExpenseForm = () => {
    setExpenseForm({
      date: new Date().toISOString().split("T")[0],
      category: "",
      description: "",
      amount: NaN, // Changed from 0 to NaN to make it empty by default
      payment_mode: "cash",
      entity_id: ""
    });
    setSelectedEntityId('');
    setIsEditingExpense(false);
  };

  // Default expense categories
  const defaultCategories = [
    { value: "staff_salaries", label: "Staff Salaries" },
    { value: "material_equipment", label: "Material / Equipment" },
    { value: "venue_rent", label: "Venue Rent" },
    { value: "travel", label: "Travel" },
    { value: "marketing", label: "Marketing" },
    { value: "utilities", label: "Utilities" },
    { value: "refunds", label: "Refunds" },
    { value: "miscellaneous", label: "Miscellaneous" },
  ];

  // Update selected month and year when expenseCurrentMonth changes
  useEffect(() => {
    setSelectedYear(expenseCurrentMonth.getFullYear());
    setSelectedMonth(expenseCurrentMonth.getMonth() + 1);
  }, [expenseCurrentMonth]);

  // Calculate overview data for the selected month and year
  const calculateTotals = () => {
    // Filter payments for the selected month and year
    const monthFilteredPmts = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return (
        paymentDate.getFullYear() === selectedYear &&
        paymentDate.getMonth() + 1 === selectedMonth
      );
    });

    // Filter expenses for the selected month and year
    const monthFilteredExps = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getFullYear() === selectedYear &&
        expenseDate.getMonth() + 1 === selectedMonth
      );
    });

    const income = monthFilteredPmts.reduce((sum, p) => sum + Number(p.amount), 0);
    const expensesTotal = monthFilteredExps.reduce((sum, e) => sum + e.amount, 0);
    
    return {
      income,
      expenses: expensesTotal,
      profit: income - expensesTotal
    };
  };
  
  // Update expenseCurrentMonth when selectedMonth or selectedYear changes
  useEffect(() => {
    setExpenseCurrentMonth(new Date(selectedYear, selectedMonth - 1));
  }, [selectedMonth, selectedYear]);

  const { income: totalIncome, expenses: totalExpenses, profit: netProfit } = calculateTotals();

  // Format month and year for display
  const currentMonthYear = expenseCurrentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (user) {
      fetchEntities();
      fetchPayments();
      fetchExpenses();
      fetchPendingPayments();
      loadCustomCategories();
    }
  }, [user]);

  const loadCustomCategories = () => {
    const saved = localStorage.getItem(`expense_categories_${user?.id}`);
    if (saved) {
      setCustomCategories(JSON.parse(saved));
    }
  };

  const saveCustomCategories = (categories: string[]) => {
    localStorage.setItem(`expense_categories_${user?.id}`, JSON.stringify(categories));
    setCustomCategories(categories);
  };

  const addCustomCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    const categoryValue = newCategoryName.toLowerCase().replace(/\s+/g, "_");
    if (defaultCategories.some(c => c.value === categoryValue) || customCategories.includes(categoryValue)) {
      toast.error("Category already exists");
      return;
    }
    const updated = [...customCategories, categoryValue];
    saveCustomCategories(updated);
    toast.success("Category added successfully");
    setNewCategoryName("");
    setIsCategoryDialogOpen(false);
  };

  const deleteCustomCategory = (category: string) => {
    const updated = customCategories.filter(c => c !== category);
    saveCustomCategories(updated);
    toast.success("Category deleted");
  };

  // Combine default and custom categories
  const allCategories = [
    ...defaultCategories,
    ...customCategories.map(cat => ({
      value: cat,
      label: cat.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    }))
  ];

  const fetchEntities = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('vendor_id', user.id)
        .order('name');
        
      if (error) throw error;
      
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      toast.error('Failed to load entities');
    }
  };

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select(`
        *,
        bookings (
          id,
          event_name,
          clients (
            id,
            name,
            email,
            phone
          )
        )
      `)
      .eq("vendor_id", user!.id)
      .order('payment_date', { ascending: false });
      
    if (error) {
      console.error("Failed to fetch payments:", error);
      toast.error("Failed to fetch payments");
    } else {
      // Filter out refunds from income - they'll be shown as expenses
      const nonRefundPayments = (data || []).filter(p => p.payment_type !== 'refund');
      setPayments(nonRefundPayments);
    }
  };

  const fetchExpenses = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("vendor_id", user.id)
        .order("date", { ascending: false });
    
      if (error) {
        console.error('Error fetching expenses:', error);
        toast.error('Failed to load expenses');
        return;
      }
      
      setExpenses(data || []);
    } catch (error) {
      console.error('Error in fetchExpenses:', error);
      toast.error('Failed to load expenses');
    }
  };

  const fetchPendingPayments = async () => {
    // Fetch all bookings (excluding cancelled)
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("total_amount")
      .eq("vendor_id", user!.id)
      .neq("status", "cancelled");

    // Fetch all payments
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("amount, payment_type")
      .eq("vendor_id", user!.id);

    if (bookingsData && paymentsData) {
      const totalBookingAmount = bookingsData.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      const totalReceived = paymentsData
        .filter(p => p.payment_type !== 'refund')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const pending = Math.max(0, totalBookingAmount - totalReceived);
      setPendingPayments(pending);
    }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!expenseForm.category) {
      toast.error('Please select a category');
      return;
    }
    
    if (isNaN(expenseForm.amount) || expenseForm.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (!expenseForm.entity_id) {
      toast.error('Please select an entity');
      return;
    }
    
    try {
      // Ensure amount is a number and include vendor_id
      const expenseToSave = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        vendor_id: user?.id,  // Make sure vendor_id is included
        created_at: new Date().toISOString()
      };

      if (isEditingExpense && expenseForm.id) {
        // Update existing expense
        const { data, error } = await supabase
          .from('expenses')
          .update(expenseToSave)
          .eq('id', expenseForm.id)
          .select();

        if (error) {
          console.error('Update error:', error);
          throw new Error(error.message);
        }

        setExpenses(expenses.map(exp => 
          exp.id === expenseForm.id ? { ...data[0], amount: Number(data[0].amount) } : exp
        ));
        toast.success('Expense updated successfully');
      } else {
        // Add new expense
        const { data, error } = await supabase
          .from('expenses')
          .insert([expenseToSave])
          .select();

        if (error) {
          console.error('Insert error:', error);
          throw new Error(error.message);
        }

        setExpenses(prevExpenses => [
          { ...data[0], amount: Number(data[0].amount) },
          ...prevExpenses
        ]);
        toast.success('Expense added successfully');
      }

      setIsExpenseDialogOpen(false);
      resetExpenseForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(error instanceof Error ? error.message : `Failed to ${isEditingExpense ? 'update' : 'add'} expense`);
    }
  };

  // Chart data: Show all 12 months of selected year
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Get available years from data
  const availableYears = Array.from(new Set([
    ...payments.map(p => new Date(p.payment_date).getFullYear()),
    ...expenses.map(e => new Date(e.date).getFullYear()),
    new Date().getFullYear()
  ])).sort((a, b) => b - a);
  
  // Initialize all 12 months with zero values for selected year
  const monthlyDataMap: Record<string, { month: string; income: number; expenses: number; monthIndex: number }> = {};
  monthNames.forEach((monthName, index) => {
    const monthNum = index + 1;
    const date = new Date(selectedYear, index, 1);
    const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlyDataMap[key] = { month: key, income: 0, expenses: 0, monthIndex: index };
  });
  
  // Add actual payment data
  payments.forEach((p) => {
    const d = new Date(p.payment_date);
    if (d.getFullYear() === selectedYear) {
      const key = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].income += Number(p.amount) || 0;
      }
    }
  });
  
  // Add actual expense data
  expenses.forEach((e) => {
    const d = new Date(e.date);
    if (d.getFullYear() === selectedYear) {
      const key = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      if (monthlyDataMap[key]) {
        monthlyDataMap[key].expenses += Number(e.amount) || 0;
      }
    }
  });
  
  // Force re-render when selectedYear changes
  useEffect(() => {
    // This will trigger a re-render when selectedYear changes
  }, [selectedYear]);
  
  // Sort by month order and format month labels
  const monthlyData = Object.values(monthlyDataMap)
    .sort((a, b) => a.monthIndex - b.monthIndex)
    .map(({ monthIndex, month, ...rest }) => ({
      ...rest,
      // Extract just the 3-letter month (first 3 characters)
      month: month.split(' ')[0]
    }));

  // Yearly data: aggregate by year
  const yearlyDataMap: Record<number, { year: string; income: number; expenses: number }> = {};
  payments.forEach((p) => {
    const year = new Date(p.payment_date).getFullYear();
    if (!yearlyDataMap[year]) yearlyDataMap[year] = { year: year.toString(), income: 0, expenses: 0 };
    yearlyDataMap[year].income += Number(p.amount) || 0;
  });
  expenses.forEach((e) => {
    const year = new Date(e.date).getFullYear();
    if (!yearlyDataMap[year]) yearlyDataMap[year] = { year: year.toString(), income: 0, expenses: 0 };
    yearlyDataMap[year].expenses += Number(e.amount) || 0;
  });
  const yearlyData = Object.values(yearlyDataMap).sort((a, b) => parseInt(a.year) - parseInt(b.year));

  // Use appropriate data based on view mode
  const displayData = pnlViewMode === "monthly" ? monthlyData : yearlyData;
  const displayLabel = pnlViewMode === "monthly" ? "month" : "year";

  // Expense Breakdown - filter by selected year and month
  const expenseCategories = expenses
    .filter(e => {
      const date = new Date(e.date);
      return date.getFullYear() === selectedYear && date.getMonth() + 1 === selectedMonth;
    })
    .reduce((acc: any[], e) => {
      const existing = acc.find(a => a.name === e.category);
      if (existing) existing.value += e.amount;
      else acc.push({ name: e.category, value: e.amount });
      return acc;
    }, []);

  // Get month name for display
  const selectedMonthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' });

  // Helper function to format currency values
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(amount).replace('₹', '₹ ');
  };

  // Export Ledger to CSV
  const exportLedgerToCSV = () => {
    if (ledgerEntries.length === 0) {
      toast.error('No ledger entries to export');
      return;
    }

    // Create CSV header
    const headers = ['Date', 'Particulars', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)'];
    
    // Create CSV rows
    const rows = ledgerEntries.map(entry => [
      entry.date,
      entry.particulars,
      entry.debit ? entry.debit.toLocaleString('en-IN') : '0',
      entry.credit ? entry.credit.toLocaleString('en-IN') : '0',
      entry.balance.toLocaleString('en-IN')
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const exportToPDF = (type: 'income' | 'pnl') => {
    if (type === 'income') {
      if (filteredPayments.length === 0) {
        toast.error('No income records to export');
        return;
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set font
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(16);
      
      // Add title
      doc.text('Income Report', 14, 20);
      
      // Add date range
      doc.setFontSize(10);
      const dateRange = incomeDateFrom && incomeDateTo 
        ? `From ${incomeDateFrom} to ${incomeDateTo}`
        : `For ${incomeCurrentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      doc.text(dateRange, 14, 28);

      // Prepare table data
      const tableColumn = ['Date', 'Client', 'Booking ID', 'Amount (Rs.)', 'Payment Method'];
      const tableRows = filteredPayments.map(payment => [
        new Date(payment.payment_date).toLocaleDateString('en-IN'),
        payment.bookings?.clients?.name || 'N/A',
        payment.booking_id ? `#${payment.booking_id.slice(0, 6).toUpperCase()}` : 'N/A',
        Number(payment.amount).toLocaleString('en-IN'),
        payment.payment_method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      ]);

      // Add table
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
        },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Date
          1: { cellWidth: 60 }, // Client
          2: { cellWidth: 30 }, // Booking ID
          3: { cellWidth: 25, halign: 'right' }, // Amount
          4: { cellWidth: 40 }, // Payment Method
        },
      });

      // Add total
      const total = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      autoTable(doc, {
        body: [
          [
            { content: 'Total Income:', styles: { fontStyle: 'bold' } },
            { content: `Rs. ${total.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold', halign: 'right' } }
          ]
        ],
        startY: (doc as any).lastAutoTable.finalY + 10,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 100, halign: 'right' },
          1: { cellWidth: 40, halign: 'right' },
        },
      });

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 5,
          { align: 'right' } as any
        );
        doc.text(
          `Generated on: ${new Date().toLocaleString()}`,
          14,
          doc.internal.pageSize.height - 5
        );
      }

      // Save the PDF
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      doc.save(`income_report_${timestamp}.pdf`);
    } else if (type === 'pnl') {
      // PnL report implementation
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set font
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(16);
      
      // Add title
      doc.text('Profit & Loss Statement', 14, 20);
      
      // Add period
      doc.setFontSize(10);
      const period = pnlViewMode === 'monthly'
        ? `For ${new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        : `For Year ${selectedYear}`;
      doc.text(period, 14, 28);

      // Prepare data for the summary table
      const summaryData = [
        { label: 'Total Income', value: 0, isBold: false },
        { label: 'Total Expenses', value: 0, isBold: false },
        { label: 'Net Profit/Loss', value: 0, isBold: true }
      ];

      // Calculate income and expenses based on view mode
      if (pnlViewMode === 'monthly') {
        const monthData = monthlyData.find(m => m.month === monthNames[selectedMonth - 1]);
        if (monthData) {
          summaryData[0].value = monthData.income;
          summaryData[1].value = monthData.expenses;
          summaryData[2].value = monthData.income - monthData.expenses;
        }
      } else {
        const yearData = yearlyData.find(y => y.year === selectedYear.toString());
        if (yearData) {
          summaryData[0].value = yearData.income;
          summaryData[1].value = yearData.expenses;
          summaryData[2].value = yearData.income - yearData.expenses;
        }
      }

      // Prepare table data
      const tableData = summaryData.map(item => [
        item.label,
        item.isBold 
          ? { content: item.value.toLocaleString('en-IN'), styles: { fontStyle: 'bold' } }
          : item.value.toLocaleString('en-IN')
      ]);

      // Add summary table
      autoTable(doc, {
        startY: 40,
        head: [['Description', 'Amount (Rs.)']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
        },
        styles: {
          fontSize: 10,
          cellPadding: 5,
        },
        columnStyles: {
          0: { cellWidth: 140, halign: 'left' },
          1: { cellWidth: 40, halign: 'right' },
        },
        didDrawCell: (data) => {
          // Highlight the profit/loss row
          if (data.section === 'body' && data.row.index === 2) {
            doc.setFillColor(243, 244, 246); // gray-100
            doc.rect(
              data.cell.x,
              data.cell.y,
              data.cell.width,
              data.cell.height,
              'F'
            );
          }
        }
      });

      // Add detailed breakdown if there's space
      let finalY = (doc as any).lastAutoTable.finalY + 10;
      
      if (finalY < 250) { // Check if there's enough space for the breakdown
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Breakdown', 14, finalY);
        
        // Prepare detailed breakdown data
        const breakdownData = pnlViewMode === 'monthly' 
          ? monthlyData
              .filter(m => new Date(`1 ${m.month} ${selectedYear}`).getMonth() <= selectedMonth - 1)
              .map(m => ({
                period: m.month,
                income: m.income,
                expenses: m.expenses,
                profit: m.income - m.expenses
              }))
          : yearlyData.map(y => ({
              period: y.year,
              income: y.income,
              expenses: y.expenses,
              profit: y.income - y.expenses
            }));

        // Add detailed breakdown table
        autoTable(doc, {
          startY: finalY + 5,
          head: [[
            pnlViewMode === 'monthly' ? 'Month' : 'Year',
            'Income (Rs.)',
            'Expenses (Rs.)',
            'Profit/Loss (Rs.)',
            'Margin %'
          ]],
          body: breakdownData.map(item => [
            item.period,
            item.income.toLocaleString('en-IN'),
            item.expenses.toLocaleString('en-IN'),
            { 
              content: item.profit.toLocaleString('en-IN'),
              styles: { 
                fontStyle: 'bold',
                textColor: item.profit >= 0 ? [34, 197, 94] : [239, 68, 68] // green-500 or red-500
              } 
            },
            { 
              content: item.income > 0 ? ((item.profit / item.income) * 100).toFixed(1) + '%' : '0.0%',
              styles: { 
                textColor: item.profit >= 0 ? [34, 197, 94] : [239, 68, 68] // green-500 or red-500
              }
            }
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
          },
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          columnStyles: {
            0: { cellWidth: 40, halign: 'left' },
            1: { cellWidth: 35, halign: 'right' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
            4: { cellWidth: 25, halign: 'right' },
          },
          didParseCell: (data) => {
            // Highlight the current month/year row
            if (data.section === 'body') {
              const currentPeriod = pnlViewMode === 'monthly' 
                ? monthNames[selectedMonth - 1]
                : selectedYear.toString();
                
              if (data.row.cells[0].text[0] === currentPeriod) {
                data.cell.styles.fillColor = [243, 244, 246]; // gray-100
              }
            }
          }
        });
      }

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 5,
          { align: 'right' } as any
        );
        doc.text(
          `Generated on: ${new Date().toLocaleString()}`,
          14,
          doc.internal.pageSize.height - 5
        );
      }

      // Save the PDF
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      doc.save(`pnl_report_${timestamp}.pdf`);
    }
  };

  // Export Ledger to PDF
  const exportLedgerToPDF = () => {
    if (ledgerEntries.length === 0) {
      toast.error('No ledger entries to export');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Set font
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    
    // Add title
    doc.text('Ledger Report', 14, 20);
    
    // Add date range
    doc.setFontSize(10);
    const dateRange = ledgerDateFrom && ledgerDateTo 
      ? `From ${ledgerDateFrom} to ${ledgerDateTo}`
      : `For ${ledgerCurrentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    doc.text(dateRange, 14, 28);

    // Prepare table data
    const tableColumn = ['Date', 'Particulars', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)'];
    const tableRows = ledgerEntries.map(entry => [
      entry.date,
      entry.particulars,
      entry.debit ? entry.debit.toLocaleString('en-IN') : '0',
      entry.credit ? entry.credit.toLocaleString('en-IN') : '0',
      entry.balance.toLocaleString('en-IN')
    ]);

    // Add table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Date
        1: { cellWidth: 80 }, // Particulars
        2: { cellWidth: 30, halign: 'right' }, // Debit
        3: { cellWidth: 30, halign: 'right' }, // Credit
        4: { cellWidth: 35, halign: 'right' }, // Balance
      },
    });

    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width - 20,
        doc.internal.pageSize.height - 5,
        { align: 'right' } as any
      );
      doc.text(
        `Generated on: ${new Date().toLocaleString()}`,
        14,
        doc.internal.pageSize.height - 5
      );
    }

    // Save the PDF
    // Save the PDF with a timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    doc.save(`ledger_${timestamp}.pdf`);
  };

  // Filter functions
  const filterByDateRange = (items: any[], dateField: string, fromDate: string, toDate: string) => {
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      
      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
      return true;
    });
  };

  // Month filtering functions
  const filterByMonth = (items: any[], dateField: string, currentMonth: Date) => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
    
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= monthStart && itemDate <= monthEnd;
    });
  };

  // Filtered data by month and date range
  const getFilteredData = () => {
    const monthFilteredPmts = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return (
        paymentDate.getFullYear() === selectedYear &&
        paymentDate.getMonth() + 1 === selectedMonth
      );
    });
    
    const monthFilteredExps = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getFullYear() === selectedYear &&
        expenseDate.getMonth() + 1 === selectedMonth
      );
    });
    
    // Apply date range filter on top of month filter
    return {
      filteredPayments: incomeDateFrom || incomeDateTo 
        ? filterByDateRange(monthFilteredPmts, 'payment_date', incomeDateFrom, incomeDateTo)
        : monthFilteredPmts,
      filteredExpenses: expenseDateFrom || expenseDateTo
        ? filterByDateRange(monthFilteredExps, 'date', expenseDateFrom, expenseDateTo)
        : monthFilteredExps
    };
  };

  const { filteredPayments, filteredExpenses } = getFilteredData();
  
  // Pagination logic for income records
  const totalPayments = filteredPayments.length;
  const totalPages = Math.ceil(totalPayments / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };
  
  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value, 10);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };
  
  // Reset to first page when filters change for income
  useEffect(() => {
    setCurrentPage(1);
  }, [incomeDateFrom, incomeDateTo, filteredPayments.length]);
  
  // Reset to first page when filters change for expenses
  useEffect(() => {
    setExpenseCurrentPage(1);
  }, [expenseDateFrom, expenseDateTo, filteredExpenses.length]);

  // Ledger entries with running balance
  type LedgerRow = { date: Date; particulars: string; debit: number; credit: number };
  const ledgerRaw: LedgerRow[] = [
    ...payments.map((p) => ({
      date: new Date(p.payment_date),
      particulars: "Payment Received",
      debit: 0,
      credit: Number(p.amount) || 0,
    })),
    ...expenses.map((e) => ({
      date: new Date(e.date),
      particulars: e.description || e.category,
      debit: Number(e.amount) || 0,
      credit: 0,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Filter ledger by month first
  const monthStart = new Date(ledgerCurrentMonth.getFullYear(), ledgerCurrentMonth.getMonth(), 1);
  const monthEnd = new Date(ledgerCurrentMonth.getFullYear(), ledgerCurrentMonth.getMonth() + 1, 0, 23, 59, 59);
  
  const monthFilteredLedger = ledgerRaw.filter(r => {
    return r.date >= monthStart && r.date <= monthEnd;
  });
  
  // Then apply date range filter if specified
  const filteredLedgerRaw = (ledgerDateFrom || ledgerDateTo) ? monthFilteredLedger.filter(r => {
    const from = ledgerDateFrom ? new Date(ledgerDateFrom) : null;
    const to = ledgerDateTo ? new Date(ledgerDateTo) : null;
    
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  }) : monthFilteredLedger;

  // Calculate ledger entries with running balance
  let running = 0;
  const ledgerEntries = (filteredLedgerRaw || []).map((r) => {
    running += r.credit - r.debit;
    return {
      date: r.date.toISOString().split("T")[0],
      particulars: r.particulars || '',
      debit: r.debit,
      credit: r.credit,
      balance: running
    };
  });

  // Reset to first page when filters change for ledger
  useEffect(() => {
    setLedgerCurrentPage(1);
  }, [ledgerDateFrom, ledgerDateTo, ledgerEntries.length]);
  
  // Pagination logic for ledger
  const totalLedgerEntries = ledgerEntries.length;
  const totalLedgerPages = Math.ceil(totalLedgerEntries / ledgerItemsPerPage);
  const ledgerStartIndex = (ledgerCurrentPage - 1) * ledgerItemsPerPage;
  const paginatedLedgerEntries = ledgerEntries.slice(ledgerStartIndex, ledgerStartIndex + ledgerItemsPerPage);
  
  const handleLedgerPageChange = (page: number) => {
    setLedgerCurrentPage(Math.max(1, Math.min(page, totalLedgerPages)));
  };
  
  const handleLedgerItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value, 10);
    setLedgerItemsPerPage(newItemsPerPage);
    setLedgerCurrentPage(1);
  };
  
  // Pagination logic for expenses
  const filteredExpensesCount = filteredExpenses.length;
  const totalExpensePages = Math.ceil(filteredExpensesCount / expenseItemsPerPage);
  const expenseStartIndex = (expenseCurrentPage - 1) * expenseItemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(expenseStartIndex, expenseStartIndex + expenseItemsPerPage);
  
  const handleExpensePageChange = (page: number) => {
    setExpenseCurrentPage(Math.max(1, Math.min(page, totalExpensePages)));
  };
  
  const handleExpenseItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value, 10);
    setExpenseItemsPerPage(newItemsPerPage);
    setExpenseCurrentPage(1); // Reset to first page when changing items per page
  };


  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Accounts
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Manage your finances and track profit/loss</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="text-xs md:text-sm py-2 md:py-2.5">Overview</TabsTrigger>
          <TabsTrigger value="income" className="text-xs md:text-sm py-2 md:py-2.5">Income</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs md:text-sm py-2 md:py-2.5">Expenses</TabsTrigger>
          <TabsTrigger value="pnl" className="text-xs md:text-sm py-2 md:py-2.5">P&L Report</TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs md:text-sm py-2 md:py-2.5">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 md:space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Monthly Overview</h2>
            <div className="flex items-center gap-2">
              <Select 
                value={selectedMonth.toString()} 
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 md:pb-2 px-3 md:px-4 pt-3 md:pt-4">
                <CardTitle className="text-[10px] md:text-xs font-medium truncate pr-1">Total Income</CardTitle>
                <TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="px-3 md:px-4 pb-3 md:pb-4 flex-1 flex flex-col justify-end">
                <div className="text-base md:text-xl font-bold truncate">₹{totalIncome.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 md:pb-2 px-3 md:px-4 pt-3 md:pt-4">
                <CardTitle className="text-[10px] md:text-xs font-medium truncate pr-1">Total Expenses</CardTitle>
                <TrendingDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="px-3 md:px-4 pb-3 md:pb-4 flex-1 flex flex-col justify-end">
                <div className="text-base md:text-xl font-bold truncate">₹{totalExpenses.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 md:pb-2 px-3 md:px-4 pt-3 md:pt-4">
                <div>
                  <div className="text-sm font-semibold truncate">Pending Payments</div>
                  <div className="text-xs text-muted-foreground font-medium">All-time total</div>
                </div>
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="px-3 md:px-4 pb-3 md:pb-4 flex-1 flex flex-col justify-end">
                <div className="text-base md:text-xl font-bold text-yellow-600">₹{pendingPayments.toLocaleString()}</div>
                <p className="text-[9px] text-muted-foreground mt-0.5 truncate">Outstanding dues</p>
              </CardContent>
            </Card>
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 md:pb-2 px-3 md:px-4 pt-3 md:pt-4">
                <CardTitle className="text-[10px] md:text-xs font-medium truncate pr-1">Net Profit</CardTitle>
                <DollarSign className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground shrink-0" />
              </CardHeader>
              <CardContent className="px-3 md:px-4 pb-3 md:pb-4 flex-1 flex flex-col justify-end">
                <div className={`text-base md:text-xl font-bold truncate ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ₹{netProfit.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
              <CardHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base md:text-lg">Monthly Income vs Expenses</CardTitle>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => {
                        // Get the full month name and year for the tooltip
                        const monthIndex = monthNames.findIndex(m => m === value);
                        const date = new Date(selectedYear, monthIndex, 1);
                        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      }}
                    />
                    <Bar dataKey="income" name="Income" fill="#8884d8" />
                    <Bar dataKey="expenses" name="Expenses" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
              <CardHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base md:text-lg">Expense Breakdown</CardTitle>
                  <div className="flex gap-2">
                    <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">January</SelectItem>
                        <SelectItem value="2">February</SelectItem>
                        <SelectItem value="3">March</SelectItem>
                        <SelectItem value="4">April</SelectItem>
                        <SelectItem value="5">May</SelectItem>
                        <SelectItem value="6">June</SelectItem>
                        <SelectItem value="7">July</SelectItem>
                        <SelectItem value="8">August</SelectItem>
                        <SelectItem value="9">September</SelectItem>
                        <SelectItem value="10">October</SelectItem>
                        <SelectItem value="11">November</SelectItem>
                        <SelectItem value="12">December</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                      <SelectTrigger className="w-[90px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseCategories} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                      {expenseCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="income" className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="w-full">
                <h2 className="text-lg md:text-2xl font-semibold">Income Records</h2>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button variant="outline" onClick={() => exportToCSV("income")} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm touch-feedback">
                <Download className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
              <Button variant="outline" onClick={() => exportToPDF("income")} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm touch-feedback">
                <Download className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs md:text-sm font-medium">Filter by Date:</Label>
              <div className="flex gap-2 flex-wrap items-center">
                <Input
                  type="date"
                  value={incomeDateFrom}
                  onChange={(e) => setIncomeDateFrom(e.target.value)}
                  className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm"
                  placeholder="From"
                />
                <span className="text-xs md:text-sm text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={incomeDateTo}
                  onChange={(e) => setIncomeDateTo(e.target.value)}
                  className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm"
                  placeholder="To"
                />
                {(incomeDateFrom || incomeDateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIncomeDateFrom("");
                      setIncomeDateTo("");
                    }}
                    className="h-8 px-2 md:px-3 text-xs md:text-sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPayments.map((p) => {
                    // Format the payment date
                    const paymentDate = new Date(p.payment_date);
                    const formattedDate = paymentDate.toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });
                    
                    // Get client name from the nested bookings.clients relationship
                    const clientName = p.bookings?.clients?.name || 'N/A';
                    
                    // Create a more user-friendly booking ID display
                    const bookingId = p.booking_id ? `#${p.booking_id.slice(0, 6).toUpperCase()}` : 'N/A';
                    
                    // Get event name from bookings if available
                    const eventName = p.bookings?.event_name ? ` (${p.bookings.event_name})` : '';
                    
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{formattedDate}</TableCell>
                        <TableCell className="font-medium">
                          {clientName}
                          {eventName && (
                            <span className="block text-xs text-muted-foreground">
                              {eventName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                            {bookingId}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="capitalize">
                          <span className="inline-flex items-center">
                            {p.payment_method === 'bank_transfer' && <Banknote className="h-4 w-4 mr-1" />}
                            {p.payment_method === 'upi' && <Smartphone className="h-4 w-4 mr-1" />}
                            {p.payment_method === 'cash' && <DollarSign className="h-4 w-4 mr-1" />}
                            {p.payment_method?.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Received
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={p.notes || ''}>
                          {p.notes || '—'}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {/* Pagination Controls - Responsive */}
              {totalPages > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 sm:px-4 sm:py-3 border-t">
                  <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-0">
                    <span className="hidden sm:inline">Showing </span>
                    <span className="font-medium">
                      {Math.min(startIndex + 1, totalPayments)}-{Math.min(currentPage * itemsPerPage, totalPayments)}
                    </span>
                    <span className="hidden sm:inline"> of <span className="font-medium">{totalPayments}</span> records</span>
                    <span className="sm:hidden"> of {totalPayments}</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    {/* Rows per page selector */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mb-2 sm:mb-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Rows:</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={handleItemsPerPageChange}
                      >
                        <SelectTrigger className="h-8 w-16 sm:w-20 text-xs">
                          <SelectValue placeholder="Rows" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Pagination buttons */}
                    <div className="flex items-center gap-1 w-full sm:w-auto justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 sm:w-9 p-0"
                        title="First page"
                      >
                        <span className="hidden sm:inline">«</span>
                        <span className="sm:hidden">First</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                        title="Previous page"
                      >
                        ‹
                      </Button>
                      
                      {/* Page numbers - only show on larger screens */}
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="min-w-8 h-8 p-0"
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      {/* Mobile page indicator */}
                      <div className="sm:hidden text-sm font-medium px-2">
                        {currentPage} / {totalPages}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                        title="Next page"
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 sm:w-9 p-0"
                        title="Last page"
                      >
                        <span className="hidden sm:inline">»</span>
                        <span className="sm:hidden">Last</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="w-full">
                <h2 className="text-lg md:text-2xl font-semibold">Expenses</h2>
              </div>
            <Dialog open={isExpenseDialogOpen} onOpenChange={(open) => {
              if (!open) resetExpenseForm();
              setIsExpenseDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm touch-feedback"
                  onClick={() => {
                    resetExpenseForm();
                    setIsExpenseDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Add Expense</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEditingExpense ? 'Edit' : 'Add'} Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={saveExpense} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="date">
                        Date <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                        required
                        className={!expenseForm.date ? 'border-red-300 focus-visible:ring-red-300' : ''}
                      />
                      {!expenseForm.date && <p className="text-xs text-red-500">Date is required</p>}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="category">
                          Category <span className="text-red-500">*</span>
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCategoryDialogOpen(true)}
                          className="h-6 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Category
                        </Button>
                      </div>
                      <Select 
                        value={expenseForm.category} 
                        onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}
                        required
                      >
                        <SelectTrigger className={!expenseForm.category ? 'border-red-300' : ''}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!expenseForm.category && <p className="text-xs text-red-500">Please select a category</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">
                        Amount <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        value={isNaN(expenseForm.amount) ? '' : expenseForm.amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          setExpenseForm({ 
                            ...expenseForm, 
                            amount: value === '' ? NaN : parseFloat(value) 
                          });
                        }}
                        required
                        min="0"
                        step="0.01"
                        className={isNaN(expenseForm.amount) ? 'border-red-300 focus-visible:ring-red-300' : ''}
                      />
                      {isNaN(expenseForm.amount) && <p className="text-xs text-red-500">Amount is required</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="entity">
                        Entity <span className="text-red-500">*</span>
                      </Label>
                      <Select 
                        value={expenseForm.entity_id || ''} 
                        onValueChange={(value) => setExpenseForm({ ...expenseForm, entity_id: value })}
                        required
                      >
                        <SelectTrigger className={!expenseForm.entity_id ? 'border-red-300' : ''}>
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                        <SelectContent>
                          {entities.map((entity) => (
                            <SelectItem key={entity.id} value={entity.id}>
                              {entity.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!expenseForm.entity_id && <p className="text-xs text-red-500">Please select an entity</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="payment_mode">Payment Mode</Label>
                      <Select 
                        value={expenseForm.payment_mode} 
                        onValueChange={(value) => setExpenseForm({ ...expenseForm, payment_mode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">
                      Description <span className="text-muted-foreground text-xs">(Optional)</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      placeholder="Add any additional details about this expense"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="receipt">
                      Receipt Upload <span className="text-muted-foreground text-xs">(Optional)</span>
                    </Label>
                    <Input 
                      id="receipt" 
                      type="file" 
                      accept="image/*,application/pdf" 
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported formats: JPG, PNG, PDF (max 5MB)
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="text-red-500">*</span> Indicates required field
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full">
                      {isEditingExpense ? 'Update' : 'Add'} Expense
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs md:text-sm font-medium">Filter by Date:</Label>
              <div className="flex gap-2 flex-wrap items-center">
                <Input
                  type="date"
                  value={expenseDateFrom}
                  onChange={(e) => setExpenseDateFrom(e.target.value)}
                  className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm"
                  placeholder="From"
                />
                <span className="text-xs md:text-sm text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={expenseDateTo}
                  onChange={(e) => setExpenseDateTo(e.target.value)}
                  className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm"
                  placeholder="To"
                />
                {(expenseDateFrom || expenseDateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpenseDateFrom("");
                      setExpenseDateTo("");
                    }}
                    className="h-8 px-2 md:px-3 text-xs md:text-sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.map((e, index) => (
                    <TableRow key={e.id || index}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell className="capitalize">{e.category.replace("_", " ")}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>₹{e.amount.toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{e.payment_mode.replace("_", " ")}</TableCell>
                      <TableCell>
                        {e.receipt_url ? <Button size="sm" variant="outline">View</Button> : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditExpense(e)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => {
                                setExpenseToDelete(e);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination Controls - Responsive */}
              {totalExpensePages > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 sm:px-4 sm:py-3 border-t">
                  <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-0">
                    <span className="hidden sm:inline">Showing </span>
                    <span className="font-medium">
                      {Math.min(expenseStartIndex + 1, filteredExpensesCount)}-{Math.min(expenseCurrentPage * expenseItemsPerPage, filteredExpensesCount)}
                    </span>
                    <span className="hidden sm:inline"> of <span className="font-medium">{filteredExpensesCount}</span> records</span>
                    <span className="sm:hidden"> of {filteredExpensesCount}</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    {/* Rows per page selector */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mb-2 sm:mb-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Rows:</span>
                      <Select
                        value={expenseItemsPerPage.toString()}
                        onValueChange={handleExpenseItemsPerPageChange}
                      >
                        <SelectTrigger className="h-8 w-16 sm:w-20 text-xs">
                          <SelectValue placeholder="Rows" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Pagination buttons */}
                    <div className="flex items-center gap-1 w-full sm:w-auto justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExpensePageChange(1)}
                        disabled={expenseCurrentPage === 1}
                        className="h-8 w-8 sm:w-9 p-0"
                        title="First page"
                      >
                        <span className="hidden sm:inline">«</span>
                        <span className="sm:hidden">First</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExpensePageChange(expenseCurrentPage - 1)}
                        disabled={expenseCurrentPage === 1}
                        className="h-8 w-8 p-0"
                        title="Previous page"
                      >
                        ‹
                      </Button>
                      
                      {/* Page numbers - only show on larger screens */}
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalExpensePages) }, (_, i) => {
                          let pageNum;
                          if (totalExpensePages <= 5) {
                            pageNum = i + 1;
                          } else if (expenseCurrentPage <= 3) {
                            pageNum = i + 1;
                          } else if (expenseCurrentPage >= totalExpensePages - 2) {
                            pageNum = totalExpensePages - 4 + i;
                          } else {
                            pageNum = expenseCurrentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={expenseCurrentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="min-w-8 h-8 p-0"
                              onClick={() => handleExpensePageChange(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      {/* Mobile page indicator */}
                      <div className="sm:hidden text-sm font-medium px-2">
                        {expenseCurrentPage} / {totalExpensePages}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExpensePageChange(expenseCurrentPage + 1)}
                        disabled={expenseCurrentPage === totalExpensePages}
                        className="h-8 w-8 p-0"
                        title="Next page"
                      >
                        ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExpensePageChange(totalExpensePages)}
                        disabled={expenseCurrentPage === totalExpensePages}
                        className="h-8 w-8 sm:w-9 p-0"
                        title="Last page"
                      >
                        <span className="hidden sm:inline">»</span>
                        <span className="sm:hidden">Last</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pnl" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-2xl font-semibold">Profit & Loss Report</h2>
            <div className="flex gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex gap-1 border rounded-lg p-1">
                  <Button
                    size="sm"
                    variant={pnlViewMode === "monthly" ? "default" : "ghost"}
                    onClick={() => setPnlViewMode("monthly")}
                    className="h-8"
                  >
                    <Calendar className="mr-1 h-3 w-3" />
                    Monthly
                  </Button>
                  <Button
                    size="sm"
                    variant={pnlViewMode === "yearly" ? "default" : "ghost"}
                    onClick={() => setPnlViewMode("yearly")}
                    className="h-8"
                  >
                    <TrendingUp className="mr-1 h-3 w-3" />
                    Yearly
                  </Button>
                </div>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(Number(value))}
                >
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => exportToPDF("pnl")} size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {pnlViewMode === 'monthly' ? 'Monthly' : 'Yearly'} Revenue
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {pnlViewMode === 'monthly' 
                      ? new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })
                      : selectedYear}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ₹{(
                    pnlViewMode === 'monthly' 
                      ? monthlyData.find(m => m.month === monthNames[selectedMonth - 1])?.income || 0
                      : yearlyData.find(y => y.year === selectedYear.toString())?.income || 0
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pnlViewMode === 'monthly' 
                    ? `Revenue for ${monthNames[selectedMonth - 1]} ${selectedYear}`
                    : `Total revenue for ${selectedYear}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {pnlViewMode === 'monthly' ? 'Monthly' : 'Yearly'} Expenses
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {pnlViewMode === 'monthly' 
                      ? new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })
                      : selectedYear}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ₹{(
                    pnlViewMode === 'monthly'
                      ? monthlyData.find(m => m.month === monthNames[selectedMonth - 1])?.expenses || 0
                      : yearlyData.find(y => y.year === selectedYear.toString())?.expenses || 0
                  ).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pnlViewMode === 'monthly' 
                    ? `Expenses for ${monthNames[selectedMonth - 1]} ${selectedYear}`
                    : `Total expenses for ${selectedYear}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {pnlViewMode === 'monthly' ? 'Monthly' : 'Yearly'} Net Profit
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {pnlViewMode === 'monthly' 
                      ? new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })
                      : selectedYear}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const income = pnlViewMode === 'monthly'
                    ? monthlyData.find(m => m.month === monthNames[selectedMonth - 1])?.income || 0
                    : yearlyData.find(y => y.year === selectedYear.toString())?.income || 0;
                  const expenses = pnlViewMode === 'monthly'
                    ? monthlyData.find(m => m.month === monthNames[selectedMonth - 1])?.expenses || 0
                    : yearlyData.find(y => y.year === selectedYear.toString())?.expenses || 0;
                  const profit = income - expenses;
                  const margin = income > 0 ? (profit / income) * 100 : 0;
                  
                  return (
                    <>
                      <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{profit.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Profit Margin: {margin.toFixed(1)}%
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Profit Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{pnlViewMode === "monthly" ? "Monthly" : "Yearly"} Profit Trend</CardTitle>
              <CardDescription>Track your profit/loss over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={displayData.map(m => ({ ...m, profit: m.income - m.expenses }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={displayLabel} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `₹${value.toLocaleString()}`}
                    labelStyle={{ color: '#000' }}
                  />
                  <Bar dataKey="profit" fill="#8884d8" name={`${pnlViewMode === "monthly" ? "Monthly" : "Yearly"} Profit`}>
                    {displayData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={(entry.income - entry.expenses) >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>{pnlViewMode === "monthly" ? "Monthly" : "Yearly"} Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{pnlViewMode === "monthly" ? "Month" : "Year"}</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Profit/Loss</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((row, idx) => {
                    const profit = row.income - row.expenses;
                    const margin = row.income > 0 ? ((profit / row.income) * 100).toFixed(1) : '0.0';
                    const periodLabel = pnlViewMode === "monthly" ? row.month : row.year;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{periodLabel}</TableCell>
                        <TableCell className="text-right text-green-600">₹{row.income.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-600">₹{row.expenses.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{profit.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{margin}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {displayData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 w-full">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Ledger View</h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportLedgerToCSV}
                    className="flex items-center gap-1 h-8 text-xs"
                  >
                    <FileTextIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={exportLedgerToPDF}
                    className="flex items-center gap-1 h-8 text-xs"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </Button>
                </div>
              </div>
              <div></div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Label className="text-xs md:text-sm font-medium">Filter by Date:</Label>
              <div className="flex gap-2 flex-wrap items-center">
                <Input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(e) => setLedgerDateFrom(e.target.value)}
                  className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm"
                  placeholder="From"
                />
                <span className="text-xs md:text-sm text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(e) => setLedgerDateTo(e.target.value)}
                  className="w-32 md:w-40 h-8 md:h-9 text-xs md:text-sm"
                  placeholder="To"
                />
                {(ledgerDateFrom || ledgerDateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLedgerDateFrom("");
                      setLedgerDateTo("");
                    }}
                    className="h-8 px-2 md:px-3 text-xs md:text-sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLedgerEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No ledger entries</TableCell>
                    </TableRow>
                  ) : (
                    paginatedLedgerEntries.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.particulars}</TableCell>
                        <TableCell>{row.debit ? `₹${row.debit.toLocaleString()}` : ""}</TableCell>
                        <TableCell>{row.credit ? `₹${row.credit.toLocaleString()}` : ""}</TableCell>
                        <TableCell>₹{row.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="p-0">
                      {totalLedgerPages > 0 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 sm:px-4 sm:py-3 border-t">
                          <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-0">
                            <span className="hidden sm:inline">Showing </span>
                            <span className="font-medium">
                              {Math.min(ledgerStartIndex + 1, totalLedgerEntries)}-{Math.min(ledgerCurrentPage * ledgerItemsPerPage, totalLedgerEntries)}
                            </span>
                            <span className="hidden sm:inline"> of <span className="font-medium">{totalLedgerEntries}</span> records</span>
                            <span className="sm:hidden"> of {totalLedgerEntries}</span>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                            {/* Rows per page selector */}
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mb-2 sm:mb-0">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">Rows:</span>
                              <Select
                                value={ledgerItemsPerPage.toString()}
                                onValueChange={handleLedgerItemsPerPageChange}
                              >
                                <SelectTrigger className="h-8 w-16 sm:w-20 text-xs">
                                  <SelectValue placeholder="Rows" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="5">5</SelectItem>
                                  <SelectItem value="10">10</SelectItem>
                                  <SelectItem value="20">20</SelectItem>
                                  <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Pagination buttons */}
                            <div className="flex items-center gap-1 w-full sm:w-auto justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLedgerPageChange(1)}
                                disabled={ledgerCurrentPage === 1}
                                className="h-8 w-8 sm:w-9 p-0"
                                title="First page"
                              >
                                <span className="hidden sm:inline">«</span>
                                <span className="sm:hidden">First</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLedgerPageChange(ledgerCurrentPage - 1)}
                                disabled={ledgerCurrentPage === 1}
                                className="h-8 w-8 p-0"
                                title="Previous page"
                              >
                                ‹
                              </Button>
                              
                              {/* Page numbers - only show on larger screens */}
                              <div className="hidden sm:flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalLedgerPages) }, (_, i) => {
                                  let pageNum;
                                  if (totalLedgerPages <= 5) {
                                    pageNum = i + 1;
                                  } else if (ledgerCurrentPage <= 3) {
                                    pageNum = i + 1;
                                  } else if (ledgerCurrentPage >= totalLedgerPages - 2) {
                                    pageNum = totalLedgerPages - 4 + i;
                                  } else {
                                    pageNum = ledgerCurrentPage - 2 + i;
                                  }
                                  
                                  return (
                                    <Button
                                      key={pageNum}
                                      variant={ledgerCurrentPage === pageNum ? "default" : "outline"}
                                      size="sm"
                                      className="min-w-8 h-8 p-0"
                                      onClick={() => handleLedgerPageChange(pageNum)}
                                    >
                                      {pageNum}
                                    </Button>
                                  );
                                })}
                              </div>
                              
                              {/* Mobile page indicator */}
                              <div className="sm:hidden text-sm font-medium px-2">
                                {ledgerCurrentPage} / {totalLedgerPages}
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLedgerPageChange(ledgerCurrentPage + 1)}
                                disabled={ledgerCurrentPage === totalLedgerPages}
                                className="h-8 w-8 p-0"
                                title="Next page"
                              >
                                ›
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLedgerPageChange(totalLedgerPages)}
                                disabled={ledgerCurrentPage === totalLedgerPages}
                                className="h-8 w-8 sm:w-9 p-0"
                                title="Last page"
                              >
                                <span className="hidden sm:inline">»</span>
                                <span className="sm:hidden">Last</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Expense Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCategory">Add New Category</Label>
              <div className="flex gap-2">
                <Input
                  id="newCategory"
                  placeholder="e.g., Office Supplies"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomCategory()}
                />
                <Button onClick={addCustomCategory} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {customCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Custom Categories</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customCategories.map((cat) => (
                    <div key={cat} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm capitalize">
                        {cat.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCustomCategory(cat)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <span className="sr-only">Delete</span>
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="md:max-w-sm w-full md:w-auto rounded-t-2xl md:rounded-lg">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this expense? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setExpenseToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={async () => {
                if (!expenseToDelete) return;
                
                try {
                  const { error } = await supabase
                    .from('expenses')
                    .delete()
                    .eq('id', expenseToDelete.id);
                  
                  if (error) throw error;
                  
                  setExpenses(expenses.filter(e => e.id !== expenseToDelete.id));
                  setDeleteDialogOpen(false);
                  setExpenseToDelete(null);
                  toast.success('Expense deleted successfully');
                } catch (error) {
                  console.error('Error deleting expense:', error);
                  toast.error('Failed to delete expense');
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounts;
