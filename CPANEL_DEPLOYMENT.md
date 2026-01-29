# 🚀 cPanel Deployment Guide

## ✅ What You Have
- ✅ Build ready in `dist` folder (1.07 MB - perfect!)
- ✅ Supabase backend already hosted
- ✅ `.htaccess` file created for routing

## 📋 Quick Deployment Steps

### Step 1: Rebuild with .htaccess

```bash
# Run this to include .htaccess in build
npm run build
```

The `.htaccess` file in `public` folder will be copied to `dist` automatically.

---

### Step 2: Upload to cPanel

#### Option A: File Manager (Recommended for beginners)

1. **Login to cPanel**
   - URL: Usually `yourdomain.com/cpanel` or `yourdomain.com:2083`
   - Enter your username and password

2. **Open File Manager**
   - Find "Files" section in cPanel
   - Click "File Manager"

3. **Navigate to public_html**
   - Click on `public_html` folder
   - If deploying to subdomain, go to `public_html/subdomain-name`

4. **Clean the folder (if needed)**
   - Select all existing files
   - Click "Delete" (backup first if needed!)

5. **Upload files**
   - Click "Upload" button at the top
   - Click "Select File" and choose ALL files from your `dist` folder:
     - `index.html`
     - `.htaccess`
     - `assets` folder (entire folder)
   - Wait for upload to complete (should take 1-2 minutes)

6. **Verify files**
   - You should see:
     ```
     public_html/
     ├── index.html
     ├── .htaccess
     └── assets/
         ├── index-CYGT_esn.js
         ├── index-yk-rUHuB.css
         └── ... (other files)
     ```

#### Option B: Compress & Upload (Faster)

1. **Compress dist folder**
   - Right-click on `dist` folder
   - Select "Compress" or "Send to" → "Compressed folder"
   - Name it `build.zip`

2. **Upload to cPanel**
   - Go to File Manager → public_html
   - Click "Upload"
   - Upload `build.zip`

3. **Extract**
   - Right-click on `build.zip`
   - Click "Extract"
   - Select `public_html` as destination
   - Click "Extract Files"
   - Delete `build.zip` after extraction

#### Option C: FTP Upload (Best for large files)

1. **Get FTP credentials from cPanel**
   - In cPanel, search for "FTP Accounts"
   - Note down:
     - FTP Server: `ftp.yourdomain.com`
     - Username: Your cPanel username
     - Password: Your cPanel password
     - Port: 21

2. **Download FileZilla**
   - Go to https://filezilla-project.org/download.php
   - Download and install FileZilla Client

3. **Connect via FTP**
   - Open FileZilla
   - Enter:
     - Host: `ftp.yourdomain.com`
     - Username: Your username
     - Password: Your password
     - Port: 21
   - Click "Quickconnect"

4. **Upload files**
   - Left panel: Navigate to your `dist` folder
   - Right panel: Navigate to `public_html`
   - Select all files in left panel
   - Drag to right panel
   - Wait for upload to complete

---

### Step 3: Configure Environment Variables

Your Supabase credentials are currently in your code. For security, you should:

1. **Check your current setup**
   - Open `src/integrations/supabase/client.ts`
   - See if credentials are hardcoded or using environment variables

2. **If using environment variables** (VITE_SUPABASE_URL, etc.):
   - These are baked into the build during `npm run build`
   - Make sure they were set before building
   - If not, set them and rebuild:
     ```bash
     # Windows
     set VITE_SUPABASE_URL=your_url
     set VITE_SUPABASE_ANON_KEY=your_key
     npm run build
     ```

3. **If hardcoded**:
   - You're good to go! (Already in the build)

---

### Step 4: Test Your Deployment

1. **Visit your website**
   - Go to `https://yourdomain.com` (or your subdomain)
   - You should see the login page

2. **Test functionality**
   - ✅ Login works
   - ✅ Navigation works (no 404 errors)
   - ✅ Data loads from Supabase
   - ✅ All pages accessible

3. **Check browser console**
   - Press F12
   - Check for any errors
   - Verify Supabase connection

---

## 🔧 Common Issues & Fixes

### Issue 1: "404 Not Found" on page refresh

**Cause**: .htaccess not working

**Fix**:
1. Make sure `.htaccess` file is in `public_html`
2. Check if mod_rewrite is enabled (ask your hosting provider)
3. Verify file permissions: `.htaccess` should be 644

### Issue 2: Blank white page

**Cause**: Wrong base path or missing files

**Fix**:
1. Check browser console (F12) for errors
2. Verify all files uploaded correctly
3. Check if `index.html` is in root of `public_html`

### Issue 3: CSS/JS not loading

**Cause**: Incorrect file paths

**Fix**:
1. Open browser DevTools → Network tab
2. Check which files are failing to load
3. Verify `assets` folder is uploaded
4. Check file permissions: 644 for files, 755 for folders

### Issue 4: Supabase connection error

**Cause**: CORS or wrong credentials

**Fix**:
1. Go to Supabase Dashboard
2. Settings → API → URL Configuration
3. Add your domain to allowed origins
4. Verify your Supabase URL and key in the build

### Issue 5: Slow loading

**Cause**: No compression or caching

**Fix**:
1. Verify `.htaccess` has Gzip and caching rules
2. Enable "Optimize Website" in cPanel
3. Consider using Cloudflare (free CDN)

---

## 🎯 Post-Deployment Checklist

- [ ] Website loads at your domain
- [ ] Login/authentication works
- [ ] All pages accessible (no 404s)
- [ ] Data loads from Supabase
- [ ] Mobile responsive (test on phone)
- [ ] SSL certificate installed (https://)
- [ ] Favicon appears
- [ ] No console errors

---

## 🔒 Enable SSL (HTTPS)

### If using cPanel with AutoSSL:

1. Go to cPanel → Security → SSL/TLS Status
2. Click "Run AutoSSL"
3. Wait 5-10 minutes
4. Your site will be available at `https://yourdomain.com`

### If SSL not available:

1. Use Cloudflare (free):
   - Sign up at https://cloudflare.com
   - Add your domain
   - Change nameservers at your domain registrar
   - Enable SSL in Cloudflare (Flexible mode)

---

## 📊 Performance Optimization for cPanel

### 1. Enable Gzip Compression
Already in `.htaccess` ✅

### 2. Enable Browser Caching
Already in `.htaccess` ✅

### 3. Optimize in cPanel
- Go to "Optimize Website"
- Select "Compress all content"

### 4. Use Cloudflare (Optional)
- Free CDN
- DDoS protection
- Faster loading worldwide
- Free SSL

---

## 🔄 How to Update Your Site

When you make changes:

```bash
# 1. Make your changes in code
# 2. Rebuild
npm run build

# 3. Upload new files to cPanel
# - Delete old files in public_html
# - Upload new files from dist folder
# - Done!
```

---

## 📱 Testing Checklist

Test these on your live site:

### Desktop:
- [ ] Login page loads
- [ ] Can login with credentials
- [ ] Dashboard shows data
- [ ] Can create/edit bookings
- [ ] Can add clients
- [ ] All sidebar links work
- [ ] Logout works

### Mobile:
- [ ] Responsive layout
- [ ] Bottom navigation works
- [ ] Sidebar opens/closes
- [ ] FAB buttons work
- [ ] Forms are usable
- [ ] Touch interactions smooth

---

## 🆘 Need Help?

### Check these first:
1. Browser console (F12) for errors
2. cPanel Error Logs (Metrics → Errors)
3. Supabase Dashboard → Logs

### Common cPanel locations:
- **Files**: File Manager
- **Databases**: MySQL Databases (not needed - using Supabase)
- **Domains**: Addon Domains / Subdomains
- **SSL**: SSL/TLS Status
- **Errors**: Errors in Metrics section

---

## ✅ You're Done!

Your app is now live at: `https://yourdomain.com`

**What's hosted where:**
- ✅ Frontend (React): Your cPanel server
- ✅ Backend (Supabase): Supabase cloud
- ✅ Database: Supabase PostgreSQL
- ✅ Authentication: Supabase Auth
- ✅ File Storage: Supabase Storage

Everything works together seamlessly! 🎉
