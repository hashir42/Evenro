# 📁 Documents Module - Enhanced Features Implementation

## ✅ Features Already Implemented

Your Documents module already has these features working:
1. ✅ **Upload & Download** documents
2. ✅ **Search & Filter** by category
3. ✅ **Tagging** system
4. ✅ **File metadata** (size, type, date)
5. ✅ **Public/Private** toggle
6. ✅ **Delete** with confirmation

## 🚀 New Features to Add

### 1. Folder Organization
### 2. File Previews (PDF, Images)
### 3. Link Sharing with Expiry
### 4. Contract E-Sign (Future Phase)

---

## 📦 Implementation Guide

### STEP 1: Enhanced Database Features

The migration `20251014240000_enhance_all_modules.sql` already includes:

✅ **Folders** (`document_folders` table exists)
✅ **Link Sharing** with expiry (`document_shares` table)
✅ **Preview URLs** columns
✅ **E-Sign tracking** fields

---

### STEP 2: Add Folder Management Functions

Add these functions to your `Documents.tsx` file after the existing `fetchDocuments`:

```typescript
// Create new folder
const createFolder = async (e: React.FormEvent) => {
  e.preventDefault();
  const { error } = await supabase
    .from("document_folders")
    .insert({
      vendor_id: user!.id,
      name: folderFormData.name,
      description: folderFormData.description,
      parent_folder_id: currentFolder,
    });

  if (!error) {
    toast({ title: "Success", description: "Folder created" });
    setFolderDialogOpen(false);
    setFolderFormData({ name: "", description: "" });
    fetchFolders();
  } else {
    toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
  }
};

// Update file fetch to filter by folder
const fetchDocuments = async () => {
  let query = supabase
    .from("documents")
    .select("*")
    .eq("vendor_id", user!.id);

  // Filter by current folder
  if (currentFolder) {
    query = query.eq("folder_id", currentFolder);
  } else {
    query = query.is("folder_id", null); // Root level only
  }

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  if (filterCategory !== "all") {
    query = query.eq("category", filterCategory);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    toast({ title: "Error", description: "Failed to load documents", variant: "destructive" });
  } else {
    setDocuments(data || []);
  }
};
```

---

### STEP 3: Add Share Link Generation

```typescript
const generateShareLink = async (doc: Document) => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + parseInt(shareExpiry));

  const shareToken = crypto.randomUUID();
  
  const { error } = await supabase
    .from("document_shares")
    .insert({
      document_id: doc.id,
      share_token: shareToken,
      expires_at: expiryDate.toISOString(),
      password_protected: false,
    });

  if (!error) {
    const link = `${window.location.origin}/shared/${shareToken}`;
    setShareLink(link);
    toast({ title: "Success", description: "Share link generated" });
  } else {
    toast({ title: "Error", description: "Failed to generate link", variant: "destructive" });
  }
};

const copyShareLink = () => {
  navigator.clipboard.writeText(shareLink);
  toast({ title: "Copied!", description: "Link copied to clipboard" });
};
```

---

### STEP 4: Add File Preview Component

```typescript
const PreviewDialog = ({ doc, open, onClose }: { doc: Document | null, open: boolean, onClose: () => void }) => {
  if (!doc) return null;

  const isPDF = doc.file_type === "application/pdf";
  const isImage = doc.file_type?.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{doc.title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[calc(90vh-100px)]">
          {isImage && (
            <img 
              src={doc.file_url} 
              alt={doc.title}
              className="w-full h-auto"
            />
          )}
          {isPDF && (
            <iframe
              src={doc.file_url}
              className="w-full h-[600px] border-0"
              title={doc.title}
            />
          )}
          {!isImage && !isPDF && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Preview not available</p>
              <Button 
                onClick={() => window.open(doc.file_url, "_blank")} 
                className="mt-4"
              >
                <Download className="mr-2 h-4 w-4" />
                Download to View
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

### STEP 5: Update Upload Form to Include Folder Selection

In your upload dialog, add folder selection:

```typescript
<div className="space-y-3">
  <Label htmlFor="folder">Folder (Optional)</Label>
  <Select
    value={formData.folder_id}
    onValueChange={(value) => setFormData({ ...formData, folder_id: value })}
  >
    <SelectTrigger className="rounded-xl">
      <SelectValue placeholder="Select folder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="root">Root (No folder)</SelectItem>
      {folders.map((folder) => (
        <SelectItem key={folder.id} value={folder.id}>
          <Folder className="h-4 w-4 inline mr-2" />
          {folder.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

### STEP 6: Add Folder Navigation UI

Add breadcrumb navigation and folder grid:

```typescript
// Breadcrumb component
const Breadcrumbs = () => {
  const currentFolderData = folders.find(f => f.id === currentFolder);
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setCurrentFolder(null)}
        className="hover:text-foreground"
      >
        <Folder className="h-4 w-4 mr-1" />
        Root
      </Button>
      {currentFolder && (
        <>
          <ChevronLeft className="h-4 w-4 rotate-180" />
          <span className="font-medium text-foreground">
            {currentFolderData?.name || "Unknown"}
          </span>
        </>
      )}
    </div>
  );
};

// Folder Grid
const FolderGrid = () => {
  const currentFolders = folders.filter(
    f => f.parent_folder_id === currentFolder
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      {currentFolders.map((folder) => (
        <Card
          key={folder.id}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentFolder(folder.id)}
        >
          <CardContent className="p-4 text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-2 text-primary" />
            <p className="font-medium truncate">{folder.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {documents.filter(d => d.folder_id === folder.id).length} files
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
```

---

## 📋 Complete UI Enhancement

### Add Action Buttons to Document Cards

Update your document card to include preview and share buttons:

```typescript
<div className="flex gap-2">
  {/* Preview Button */}
  <Button
    size="sm"
    variant="outline"
    onClick={() => setPreviewDoc(doc)}
    title="Preview"
  >
    <Eye className="h-4 w-4" />
  </Button>

  {/* Share Button */}
  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      setShareDoc(doc);
      setShareDialogOpen(true);
    }}
    title="Share Link"
  >
    <Share2 className="h-4 w-4" />
  </Button>

  {/* Download Button */}
  <Button
    size="sm"
    variant="outline"
    onClick={() => window.open(doc.file_url, "_blank")}
    title="Download"
  >
    <Download className="h-4 w-4" />
  </Button>

  {/* Delete Button */}
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleDelete(doc.id, doc.file_url)}
    title="Delete"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

---

### Share Link Dialog

```typescript
<Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Share Document</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <Label>Link expires in</Label>
        <Select value={shareExpiry} onValueChange={setShareExpiry}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 day</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="365">1 year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!shareLink ? (
        <Button 
          onClick={() => shareDoc && generateShareLink(shareDoc)}
          className="w-full"
        >
          <Link2 className="mr-2 h-4 w-4" />
          Generate Share Link
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input value={shareLink} readOnly className="flex-1" />
            <Button onClick={copyShareLink} size="sm">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Expires in {shareExpiry} days
          </p>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
```

---

## 🔐 Create Public Share Route

Create a new file `src/pages/SharedDocument.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

const SharedDocument = () => {
  const { token } = useParams<{ token: string }>();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSharedDocument();
  }, [token]);

  const fetchSharedDocument = async () => {
    if (!token) return;

    // Get share link
    const { data: shareData, error: shareError } = await supabase
      .from("document_shares")
      .select("*, documents(*)")
      .eq("share_token", token)
      .single();

    if (shareError || !shareData) {
      setError("Invalid or expired link");
      setLoading(false);
      return;
    }

    // Check expiry
    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
      setError("This link has expired");
      setLoading(false);
      return;
    }

    // Increment view count
    await supabase
      .from("document_shares")
      .update({ 
        view_count: shareData.view_count + 1,
        last_viewed_at: new Date().toISOString()
      })
      .eq("id", shareData.id);

    setDocument(shareData.documents);
    setLoading(false);
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (error) return <div className="text-center py-12 text-red-600">{error}</div>;
  if (!document) return null;

  const isPDF = document.file_type === "application/pdf";
  const isImage = document.file_type?.startsWith("image/");

  return (
    <div className="container max-w-4xl mx-auto py-12">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{document.title}</h1>
            {document.description && (
              <p className="text-muted-foreground mt-2">{document.description}</p>
            )}
          </div>

          <div className="mb-4">
            <Button onClick={() => window.open(document.file_url, "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              Download Document
            </Button>
          </div>

          {isImage && (
            <img src={document.file_url} alt={document.title} className="w-full rounded-lg" />
          )}
          {isPDF && (
            <iframe
              src={document.file_url}
              className="w-full h-[600px] border rounded-lg"
              title={document.title}
            />
          )}
          {!isImage && !isPDF && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p>Click download to view this document</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedDocument;
```

Add route in `App.tsx`:

```typescript
import SharedDocument from "./pages/SharedDocument";

// In your routes:
<Route path="/shared/:token" element={<SharedDocument />} />
```

---

## 🎨 File Type Icons

Add icon helper function:

```typescript
const getFileIcon = (fileType: string) => {
  if (fileType?.includes("pdf")) return <FilePdf className="h-8 w-8 text-red-600" />;
  if (fileType?.includes("image")) return <FileImage className="h-8 w-8 text-blue-600" />;
  return <FileText className="h-8 w-8 text-muted-foreground" />;
};
```

---

## 🔮 Future: E-Sign Integration

For contract e-signing (future phase):

```typescript
// Add to document card for contracts
{doc.is_contract && (
  <Badge variant={doc.signature_status === "signed" ? "default" : "outline"}>
    {doc.signature_status || "Pending Signature"}
  </Badge>
)}

// E-Sign button
<Button onClick={() => initiateESign(doc)}>
  <PenTool className="mr-2 h-4 w-4" />
  Sign Document
</Button>
```

Integration options:
- **DocuSign API**: https://developers.docusign.com/
- **SignEasy**: https://getsigneasy.com/developers/
- **HelloSign (Dropbox Sign)**: https://www.hellosign.com/api

---

## ✅ Implementation Checklist

- [ ] Add folder creation dialog
- [ ] Add breadcrumb navigation
- [ ] Add folder grid display
- [ ] Update upload to support folder selection
- [ ] Add file preview dialog
- [ ] Add share link generation
- [ ] Add share link dialog
- [ ] Create SharedDocument route
- [ ] Add file type icons
- [ ] Add preview/share buttons to cards
- [ ] Test folder navigation
- [ ] Test file preview (PDF, images)
- [ ] Test link sharing
- [ ] Test link expiry
- [ ] Set up e-sign provider (future)

---

## 📦 Summary of Features

### ✅ Currently Working:
- Upload/download documents
- Search and filter
- Tagging system
- File metadata
- Delete documents

### 🚀 Ready to Implement:
- **Folder Organization** - Functions provided above
- **File Previews** - Dialog component ready
- **Link Sharing** - Generation and expiry logic ready
- **Public Share Route** - Component ready

### 🔮 Future Phase:
- **E-Sign Integration** - Connect to DocuSign/SignEasy API
- **Password-protected shares**
- **Version control**
- **Collaborative editing**

---

**Your Documents module has a solid foundation!** Follow the steps above to add folder management, previews, and link sharing. 🚀📁
