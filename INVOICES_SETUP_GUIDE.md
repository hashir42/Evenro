# 🧾 Enhanced Invoices Module - Setup Guide

## ✅ What's Been Implemented

### Features:
1. ✅ **Branded Invoice Templates** with business logo and colors
2. ✅ **PDF Generation** with professional layout
3. ✅ **WhatsApp Sharing** - Direct share to customer
4. ✅ **Auto-Invoice Generation** - Triggers on booking confirmation
5. ✅ **GST/Tax Calculation** - Configurable tax rates
6. ✅ **Invoice History** - Track all generated invoices
7. ✅ **QR Code** on invoices for quick access
8. ✅ **Invoice Preview** before download

### UI Components:
- 📝 Invoice Generator with booking selection
- 🔢 GST toggle and rate selector
- 📊 Live invoice preview
- 📱 WhatsApp share integration
- 📂 Invoice history with status badges
- 🏷️ Auto-generated invoice tracking

---

## 🚀 Setup Instructions

### Step 1: Database Migration

The migration `20251014240000_enhance_all_modules.sql` adds:
- Invoice template fields
- Brand logo and color columns
- PDF URL storage
- GST/Tax fields
- Auto-generation tracking
- WhatsApp sharing status

**Already included in your migration file!** ✅

### Step 2: Configure Supabase Storage

Create a storage bucket for invoices:

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `invoices`
3. Set bucket as **Public** (or use signed URLs)
4. Add policy for authenticated users:

```sql
-- Allow authenticated users to upload invoices
CREATE POLICY "Vendors can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow public read access
CREATE POLICY "Anyone can view invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');
```

### Step 3: Add Business Information

Update your profile with business details for invoices:

1. Go to **Settings**
2. Add:
   - Business Name
   - Email & Phone
   - GST Number (optional)
   - Logo (optional)

Or update via SQL:

```sql
UPDATE profiles
SET 
  business_name = 'Your Business Name',
  business_gst = 'GST123456789',
  business_address = 'Your Business Address'
WHERE id = 'your-user-id';
```

### Step 4: Verify Auto-Invoice Trigger

The trigger is already in your migration! It works like this:

```sql
-- When a booking status changes to 'confirmed'
-- An invoice is automatically created
CREATE TRIGGER trigger_auto_generate_invoice
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_invoice();
```

---

## 🎯 How to Use

### Generate Manual Invoice

1. Go to **Invoices** page
2. Click **"Generate Invoice"** tab
3. Select a booking from dropdown
4. Toggle **"Include GST/Tax"** if needed
5. Set GST rate (default: 18%)
6. Preview appears below
7. Click **"Download PDF"**

### Share Invoice to Customer

1. Select booking
2. Click **"Share to Customer"**
3. If customer has phone number:
   - WhatsApp opens automatically
   - Message pre-filled with invoice link
4. If no phone:
   - Link copied to clipboard
   - Share manually

### View Auto-Generated Invoices

1. Go to **"Invoice History"** tab
2. See all invoices (auto & manual)
3. Check status (Paid/Pending)
4. Download PDFs
5. Track WhatsApp shares

---

## 📊 GST/Tax Calculation Example

### Without GST:
```
Subtotal: ₹50,000
Total: ₹50,000
```

### With GST (18%):
```
Subtotal: ₹50,000
GST (18%): ₹9,000
Total with Tax: ₹59,000
GSTIN: YOUR_GST_NUMBER
```

### Custom GST Rate (12%):
```
Subtotal: ₹50,000
GST (12%): ₹6,000
Total with Tax: ₹56,000
```

---

## 🎨 Invoice Template Features

### Header Section
- **Company Logo** (from profile)
- **Business Name** (from profile)
- **Invoice Number**: `INV-YYYYMMDD-XXXXX`
- **Date**: Generation date
- **Event Date**: Booking date

### Bill To Section
- Client Name
- Client Email
- Client Phone

### Items Section
- Event Name
- Package Details
- Subtotal
- GST/Tax (if enabled)
- Total Amount

### Payment Section
- Total with Tax
- Amount Paid
- **Balance Due** (red if pending, green if paid)

### Footer
- Thank you message
- QR Code (links to booking details)
- Business contact info

---

## 📱 WhatsApp Integration

### How It Works:

1. **Upload to Storage**:
   - PDF generated
   - Uploaded to Supabase Storage
   - Public/Signed URL created

2. **Build WhatsApp Message**:
   ```
   Hello [Client Name], 
   here is your invoice for [Event Name] 
   dated [Event Date]: 
   [Invoice URL]
   ```

3. **Open WhatsApp**:
   - Uses `wa.me/` format
   - Opens on mobile/desktop
   - Message pre-filled
   - User clicks send

4. **Track Sharing**:
   - `shared_via_whatsapp` flag set to `true`
   - Shows badge in invoice history

### Phone Number Format:
- 10 digits → Adds country code (91 for India)
- Already has country code → Uses as-is
- No phone → Copies link to clipboard

---

## 🤖 Auto-Invoice Generation

### Trigger Conditions:

✅ **Auto-generates when**:
- New booking created with `status = 'confirmed'`
- Existing booking updated to `status = 'confirmed'`

❌ **Does NOT generate when**:
- Booking is pending/cancelled
- Invoice already exists for that booking
- Booking updated but status doesn't change

### Invoice Details:
- `invoice_number`: `INV-YYYYMMDD-{first-8-chars-of-booking-id}`
- `amount`: From `booking.total_amount`
- `due_date`: Same as `event_date`
- `status`: `pending`
- `auto_generated`: `true`

### Example Flow:
```
1. Client books event → status: 'pending'
   → No invoice yet

2. You confirm booking → status: 'confirmed'
   → ✅ Invoice auto-created
   → Invoice #: INV-20251014-ABC12345

3. Check Invoice History tab
   → See invoice with "Auto-Generated" badge

4. Download/Share with customer
```

---

## 🔧 Customization Options

### Change Invoice Colors

Update in `Invoices.tsx`:
```typescript
headStyles: { fillColor: [99, 102, 241] } // RGB color
```

### Change Invoice Number Format

Update in migration:
```sql
'INV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(NEW.id::text, 1, 8)
```

### Add More Fields

Add to PDF generation:
```typescript
doc.text(`PO Number: ${booking.po_number}`, 14, 95);
doc.text(`Reference: ${booking.reference}`, 14, 102);
```

### Brand Logo

1. Upload logo in Settings
2. Update profile:
```typescript
logo_url: 'https://your-cdn.com/logo.png'
```
3. Logo appears on invoices automatically

---

## 📈 Invoice Status Management

### Status Options:
- **Pending**: Invoice created, payment due
- **Paid**: Full payment received
- **Overdue**: Past due date (future feature)
- **Cancelled**: Booking cancelled

### Update Status:
```sql
UPDATE invoices
SET status = 'paid'
WHERE id = 'invoice-id';
```

Or automatically when payment received:
```sql
-- Add trigger to update invoice status when payment added
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET status = 'paid'
  WHERE booking_id = NEW.booking_id
    AND amount <= (
      SELECT SUM(amount) 
      FROM payments 
      WHERE booking_id = NEW.booking_id
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 🐛 Troubleshooting

### Invoice PDF not downloading?
- Check jsPDF and jspdf-autotable are installed:
  ```bash
  npm install jspdf jspdf-autotable
  ```

### WhatsApp share not working?
- Check phone number format in client profile
- Ensure Supabase Storage bucket is public
- Test with signed URLs if bucket is private

### QR Code not appearing?
- Install qrcode package:
  ```bash
  npm install qrcode
  ```
- Check QR code URL in code

### Auto-invoice not generating?
- Verify migration trigger is applied
- Check booking status is 'confirmed'
- Look for errors in Supabase logs
- Test manual booking confirmation

### GST not showing on invoice?
- Ensure toggle is ON
- Check GST rate is > 0
- Verify business_gst is set in profile

---

## 📋 Invoice Checklist

Before sending invoices to customers:

- [ ] Business name and details added to profile
- [ ] GST number added (if applicable)
- [ ] Logo uploaded (optional)
- [ ] Supabase Storage bucket created
- [ ] Storage policies configured
- [ ] Test invoice generation
- [ ] Test PDF download
- [ ] Test WhatsApp sharing
- [ ] Verify auto-generation on booking confirm
- [ ] Check GST calculations are correct

---

## 🎉 Best Practices

### 1. Professional Appearance
- Add your business logo
- Use consistent brand colors
- Include GST number for compliance
- Add terms and conditions

### 2. Timely Delivery
- Auto-generate on confirmation
- Share immediately via WhatsApp
- Follow up on unpaid invoices

### 3. Clear Communication
- Show subtotal and tax separately
- Highlight balance due
- Include payment instructions

### 4. Record Keeping
- Track all invoices in history
- Monitor payment status
- Download for accounting

### 5. Customer Experience
- Easy WhatsApp sharing
- Mobile-friendly PDFs
- QR codes for quick access

---

## 🚀 Future Enhancements

Planned features:
- [ ] Multiple invoice templates
- [ ] Email invoice sending
- [ ] Recurring invoices
- [ ] Payment reminders
- [ ] Invoice analytics
- [ ] Export to accounting software
- [ ] Multi-currency support
- [ ] Invoice approval workflow

---

## 📞 Support

**Common Issues:**
- Storage bucket not created → Follow Step 2
- Auto-generation not working → Check trigger in database
- GST calculation wrong → Verify rate and toggle

**Resources:**
- jsPDF Docs: https://github.com/parallax/jsPDF
- Supabase Storage: https://supabase.com/docs/guides/storage
- WhatsApp API: https://faq.whatsapp.com/5913398998672934

---

**Your enhanced Invoices module is ready!** 🧾✨

Generate professional branded invoices with GST, auto-generation, and WhatsApp sharing! 🚀
