# 🚀 Enhanced Features Roadmap

## Overview
This document outlines the comprehensive enhancements for Payments, Invoices, Documents, Reports, and Settings modules.

---

## ✅ Database Schema - COMPLETED

All database tables, columns, and triggers have been created in migration:
`20251014240000_enhance_all_modules.sql`

### What's Been Added:
- ✅ Payment gateway integration fields
- ✅ Partial payments and refunds tracking
- ✅ Settlement management tables
- ✅ Invoice templates and branding
- ✅ Invoice line items
- ✅ GST/Tax calculation fields
- ✅ Document sharing with expiry
- ✅ E-signature tracking
- ✅ Analytics cache for reports
- ✅ Staff roles and permissions
- ✅ Notification preferences
- ✅ Business branding settings

---

## 💳 PAYMENTS MODULE

### Database Ready ✅
- Payment methods (cash, card, UPI, Razorpay, Stripe, bank transfer)
- Payment types (full, partial, advance, refund)
- Gateway transaction tracking
- Settlement status and dates
- Gateway fees and net amounts
- `payment_settlements` table for payout tracking

### UI Implementation Needed 🔨

#### 1. **Payment Gateway Integration**
```typescript
// Payment form with Razorpay/Stripe
const handlePayment = async (amount: number, method: string) => {
  if (method === 'razorpay') {
    const options = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: amount * 100, // paise
      currency: "INR",
      name: businessName,
      handler: (response) => {
        // Save to database
        supabase.from('payments').insert({
          payment_method: 'razorpay',
          gateway_transaction_id: response.razorpay_payment_id,
          amount: amount
        });
      }
    };
    const razorpay = new Razorpay(options);
    razorpay.open();
  }
};
```

#### 2. **Partial Payments UI**
- Allow multiple payments per booking
- Track remaining balance
- Payment history timeline

#### 3. **Refunds Management**
- Refund request form
- Refund approval workflow
- Automatic gateway refund processing

#### 4. **Settlement Dashboard**
```typescript
// Show upcoming payouts
SELECT 
  settlement_date,
  SUM(settlement_amount) as total,
  gateway
FROM payment_settlements
WHERE vendor_id = user.id 
  AND status = 'pending'
GROUP BY settlement_date, gateway
ORDER BY settlement_date ASC
```

### Integration Requirements:
- **Razorpay**: Install `@razorpay/razorpay`, get API keys
- **Stripe**: Install `@stripe/stripe-js`, set up webhook
- **Environment Variables**:
  ```env
  VITE_RAZORPAY_KEY_ID=rzp_live_xxx
  VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
  ```

---

## 🧾 INVOICES MODULE

### Database Ready ✅
- Invoice templates
- Brand logo and colors
- PDF URLs
- WhatsApp sharing tracking
- Auto-generation flag
- GST/Tax fields
- Line items table
- Terms and conditions

### UI Implementation Needed 🔨

#### 1. **Branded Invoice Templates**
```typescript
// Invoice template component
const InvoiceTemplate = ({ invoice, branding }) => (
  <div style={{ 
    fontFamily: 'Arial',
    borderTop: `4px solid ${branding.color}`
  }}>
    <img src={branding.logo} alt="Logo" />
    <h1 style={{ color: branding.color }}>INVOICE</h1>
    {/* Invoice details */}
  </div>
);
```

#### 2. **PDF Generation**
```typescript
// Using jsPDF or react-pdf
import jsPDF from 'jspdf';

const generatePDF = async (invoice) => {
  const doc = new jsPDF();
  doc.text(invoice.invoice_number, 10, 10);
  // Add invoice content
  const pdfBlob = doc.output('blob');
  
  // Upload to Supabase Storage
  const { data } = await supabase.storage
    .from('invoices')
    .upload(`${invoice.id}.pdf`, pdfBlob);
  
  // Save URL to database
  await supabase.from('invoices')
    .update({ pdf_url: data.path })
    .eq('id', invoice.id);
};
```

#### 3. **WhatsApp Sharing**
```typescript
const shareViaWhatsApp = (invoice, client) => {
  const message = `Hi ${client.name}, here's your invoice: ${invoice.pdf_url}`;
  const whatsappUrl = `https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
  
  // Mark as shared
  supabase.from('invoices')
    .update({ shared_via_whatsapp: true })
    .eq('id', invoice.id);
};
```

#### 4. **Auto-Invoice Generation** ✅
- Trigger already created in database
- Automatically creates invoice when booking status = 'confirmed'
- Invoice number format: INV-YYYYMMDD-XXXXX

#### 5. **GST Calculation**
```typescript
const calculateInvoiceTotal = (items, gstRate = 18) => {
  const subtotal = items.reduce((sum, item) => 
    sum + (item.quantity * item.unit_price), 0
  );
  const taxAmount = (subtotal * gstRate) / 100;
  const total = subtotal + taxAmount;
  
  return { subtotal, taxAmount, total };
};
```

### Integration Requirements:
- **PDF Generation**: Install `jspdf` or `@react-pdf/renderer`
- **WhatsApp Business API** (optional): For automated messaging
- **Template Engine**: React component or Handlebars for templates

---

## 📁 DOCUMENTS MODULE

### Database Ready ✅
- Preview and thumbnail URLs
- Contract tracking
- E-signature status
- Share link expiry
- Password protection
- View count tracking

### UI Implementation Needed 🔨

#### 1. **Folder Organization** ✅
- Already have `document_folders` table
- Add folder tree view UI
- Drag-and-drop file management

#### 2. **File Previews**
```typescript
const FilePreview = ({ document }) => {
  if (document.file_type.includes('image')) {
    return <img src={document.file_url} alt={document.name} />;
  }
  if (document.file_type === 'application/pdf') {
    return <iframe src={document.file_url} />;
  }
  // For other files, show download button
  return <DownloadButton url={document.file_url} />;
};
```

#### 3. **Link Sharing with Expiry**
```typescript
const createShareLink = async (documentId, expiryDays = 7) => {
  const shareToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  
  await supabase.from('document_shares').insert({
    document_id: documentId,
    share_token: shareToken,
    expires_at: expiresAt.toISOString()
  });
  
  return `${window.location.origin}/shared/${shareToken}`;
};

// Public route to view shared documents
const SharedDocumentView = () => {
  const { token } = useParams();
  
  // Check if link is valid and not expired
  const { data } = await supabase
    .from('document_shares')
    .select('*, documents(*)')
    .eq('share_token', token)
    .gte('expires_at', new Date().toISOString())
    .single();
  
  if (!data) return <div>Link expired or invalid</div>;
  
  // Increment view count
  await supabase.from('document_shares')
    .update({ view_count: data.view_count + 1 })
    .eq('id', data.id);
  
  return <DocumentViewer document={data.documents} />;
};
```

#### 4. **E-Sign Integration** (Future Phase)
```typescript
// Using DocuSign or SignEasy API
const initiateESign = async (documentId, signers) => {
  // This would integrate with e-sign provider
  await supabase.from('documents')
    .update({ 
      is_contract: true,
      signature_status: 'pending'
    })
    .eq('id', documentId);
};
```

### Integration Requirements:
- **File Preview**: Install `react-pdf` for PDF preview
- **E-Sign**: DocuSign, SignEasy, or DigiSigner API
- **Storage**: Supabase Storage already configured

---

## 📈 REPORTS MODULE

### Database Ready ✅
- `analytics_cache` table for pre-computed reports
- Optimized for date range queries

### UI Implementation Needed 🔨

#### 1. **Interactive Charts**
```typescript
// Install: recharts or chart.js
import { LineChart, BarChart } from 'recharts';

const BookingsByMonthChart = () => {
  const { data } = await supabase.rpc('get_bookings_by_month', {
    vendor_id: user.id,
    year: 2025
  });
  
  return (
    <BarChart data={data}>
      <XAxis dataKey="month" />
      <YAxis />
      <Bar dataKey="count" fill="#6366f1" />
    </BarChart>
  );
};

const RevenuePerPackageChart = () => {
  // Similar implementation
};
```

#### 2. **Create SQL Functions for Reports**
```sql
-- Add to migration
CREATE OR REPLACE FUNCTION public.get_bookings_by_month(
  vendor_id UUID,
  year INTEGER
)
RETURNS TABLE (
  month TEXT,
  count BIGINT,
  revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(event_date, 'Mon') as month,
    COUNT(*) as count,
    SUM(total_amount) as revenue
  FROM bookings
  WHERE vendor_id = $1 
    AND EXTRACT(YEAR FROM event_date) = $2
  GROUP BY to_char(event_date, 'Mon'), EXTRACT(MONTH FROM event_date)
  ORDER BY EXTRACT(MONTH FROM event_date);
END;
$$ LANGUAGE plpgsql;
```

#### 3. **Export to Excel/PDF**
```typescript
// Excel export using xlsx
import * as XLSX from 'xlsx';

const exportToExcel = (data, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// PDF export using jsPDF
const exportToPDF = (reportData) => {
  const doc = new jsPDF();
  doc.text("Business Report", 10, 10);
  // Add tables and charts
  doc.save("report.pdf");
};
```

#### 4. **Performance Comparison**
```typescript
const ComparisonReport = () => {
  const currentMonth = await getMonthlyStats(new Date());
  const previousMonth = await getMonthlyStats(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  
  const growth = ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100;
  
  return (
    <Card>
      <h3>Revenue Growth</h3>
      <p className={growth > 0 ? 'text-green-600' : 'text-red-600'}>
        {growth > 0 ? '+' : ''}{growth.toFixed(2)}%
      </p>
    </Card>
  );
};
```

#### 5. **AI Report Generator** (Future Phase)
```typescript
// Using OpenAI API
const generateAISummary = async (vendorId) => {
  const stats = await getBusinessStats(vendorId);
  
  const prompt = `Summarize this business performance:
    - Bookings: ${stats.bookings}
    - Revenue: ₹${stats.revenue}
    - Top Package: ${stats.topPackage}
    Provide insights and recommendations.`;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
  
  return response.choices[0].message.content;
};
```

### Integration Requirements:
- **Charts**: Install `recharts` or `chart.js`
- **Excel**: Install `xlsx`
- **PDF**: Install `jspdf` or `pdfmake`
- **AI**: OpenAI API (optional, future phase)

---

## ⚙️ SETTINGS MODULE

### Database Ready ✅
- Subscription fields in profiles
- Brand color and theme
- Notification preferences (JSONB)
- Business details (GST, PAN, address)
- Currency and timezone
- Staff roles table with permissions

### UI Implementation Needed 🔨

#### 1. **Subscription Management**
```typescript
const SubscriptionSettings = () => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expires_at, user_subscriptions(*)')
    .eq('id', user.id)
    .single();
  
  return (
    <Card>
      <h3>Current Plan: {profile.subscription_tier}</h3>
      <p>Expires: {format(profile.subscription_expires_at, 'PP')}</p>
      <Button onClick={handleUpgrade}>Upgrade Plan</Button>
      
      {/* Payment History */}
      <Table>
        {profile.user_subscriptions.map(sub => (
          <tr key={sub.id}>
            <td>{sub.plan_id}</td>
            <td>₹{sub.amount_paid}</td>
            <td>{sub.payment_status}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
};
```

#### 2. **Notification Preferences**
```typescript
const NotificationSettings = () => {
  const [prefs, setPrefs] = useState({
    email: true,
    sms: false,
    whatsapp: true,
    push: true
  });
  
  const savePreferences = async () => {
    await supabase.from('profiles')
      .update({ notification_preferences: prefs })
      .eq('id', user.id);
  };
  
  return (
    <div>
      <Switch checked={prefs.email} onChange={(v) => setPrefs({...prefs, email: v})}>
        Email Notifications
      </Switch>
      <Switch checked={prefs.whatsapp} onChange={(v) => setPrefs({...prefs, whatsapp: v})}>
        WhatsApp Notifications
      </Switch>
      {/* etc */}
    </div>
  );
};
```

#### 3. **Business Branding**
```typescript
const BrandingSettings = () => {
  const [logo, setLogo] = useState(null);
  const [color, setColor] = useState('#6366f1');
  const [theme, setTheme] = useState('light');
  
  const uploadLogo = async (file) => {
    const { data } = await supabase.storage
      .from('business-logos')
      .upload(`${user.id}/${file.name}`, file);
    
    await supabase.from('profiles')
      .update({ logo_url: data.path, brand_color: color, theme_mode: theme })
      .eq('id', user.id);
  };
  
  return (
    <div>
      <Label>Business Logo</Label>
      <Input type="file" onChange={(e) => uploadLogo(e.target.files[0])} />
      
      <Label>Brand Color</Label>
      <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      
      <Label>Theme</Label>
      <Select value={theme} onValueChange={setTheme}>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
        <SelectItem value="auto">Auto</SelectItem>
      </Select>
    </div>
  );
};
```

#### 4. **Staff Roles & Permissions**
```typescript
const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  
  const addStaffMember = async (email, role) => {
    // Create user account (or send invite)
    const { data: newUser } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true
    });
    
    // Assign role
    await supabase.from('staff_roles').insert({
      vendor_id: user.id,
      staff_user_id: newUser.user.id,
      role,
      permissions: getRolePermissions(role)
    });
  };
  
  const getRolePermissions = (role) => {
    const permissions = {
      admin: ['all'],
      manager: ['bookings', 'clients', 'payments', 'reports'],
      staff: ['bookings', 'clients'],
      accountant: ['payments', 'invoices', 'reports'],
      viewer: ['view_only']
    };
    return permissions[role] || [];
  };
  
  return (
    <Table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {staff.map(member => (
          <tr key={member.id}>
            <td>{member.email}</td>
            <td>{member.role}</td>
            <td>{member.is_active ? 'Active' : 'Inactive'}</td>
            <td>
              <Button size="sm" onClick={() => editStaff(member)}>Edit</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
```

### Integration Requirements:
- **Color Picker**: Install `react-colorful`
- **Theme**: Implement theme context with CSS variables
- **File Upload**: Supabase Storage already configured

---

## 🎯 Implementation Priority

### Phase 1: Core Features (Week 1-2)
1. ✅ Database migrations (DONE)
2. 🔨 Invoice auto-generation UI
3. 🔨 Payment partial payments UI
4. 🔨 Basic reports with charts
5. 🔨 Branding settings

### Phase 2: Advanced Features (Week 3-4)
1. 🔨 Razorpay/Stripe integration
2. 🔨 PDF generation for invoices
3. 🔨 Document link sharing
4. 🔨 Staff roles UI
5. 🔨 Notification preferences

### Phase 3: Premium Features (Week 5-6)
1. 🔨 WhatsApp sharing integration
2. 🔨 Advanced analytics
3. 🔨 Excel/PDF exports
4. 🔨 Settlement tracking dashboard
5. 🔨 E-signature integration (basic)

### Phase 4: AI & Automation (Future)
1. 🔨 AI report summaries
2. 🔨 Automated follow-ups
3. 🔨 Predictive analytics
4. 🔨 Smart recommendations

---

## 📦 Required NPM Packages

```bash
# Payment Gateways
npm install razorpay @stripe/stripe-js

# PDF & Documents
npm install jspdf @react-pdf/renderer html2canvas

# Charts & Visualization
npm install recharts chart.js react-chartjs-2

# Excel Export
npm install xlsx

# Color Picker
npm install react-colorful

# Date utilities (already have date-fns)
# npm install date-fns

# QR Code (already installed)
# npm install qrcode
```

---

## 🔐 Environment Variables Needed

```env
# Payment Gateways
VITE_RAZORPAY_KEY_ID=rzp_test_xxx
VITE_RAZORPAY_KEY_SECRET=xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_STRIPE_SECRET_KEY=sk_test_xxx

# WhatsApp Business API
VITE_WHATSAPP_BUSINESS_PHONE_ID=xxx
VITE_WHATSAPP_ACCESS_TOKEN=xxx

# AI (Optional - Future)
VITE_OPENAI_API_KEY=sk-xxx

# Existing
VITE_SUPABASE_URL=xxx
VITE_SUPABASE_PUBLISHABLE_KEY=xxx
```

---

## 📊 Success Metrics

After implementation, track:
- **Payments**: Gateway transaction success rate, settlement time
- **Invoices**: Auto-generation rate, PDF downloads, WhatsApp shares
- **Documents**: Share link usage, preview engagement
- **Reports**: Export frequency, most-viewed reports
- **Settings**: Staff adoption rate, notification engagement

---

## 🚨 Important Notes

1. **Database First**: All schema changes are ready. UI can be built incrementally.
2. **Testing**: Test gateway integrations in sandbox mode first
3. **Security**: Never expose secret keys in frontend code
4. **Performance**: Use `analytics_cache` table for expensive queries
5. **Compliance**: Ensure GST calculations follow local tax laws

---

**Status**: Database schema complete ✅  
**Next Step**: Choose Phase 1 features to implement first  
**Estimated Time**: 6-8 weeks for full implementation

