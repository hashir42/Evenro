import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Download, Trash2, Eye, Plus, Share2, Search, Filter, Calendar, ChevronLeft, Folder, FolderOpen, Link2, Copy, Clock, FileImage } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ErrorBoundary from "@/components/ErrorBoundary";
import { businessNameSchema, textAreaSchema } from "@/lib/validation";

interface Document {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  vendor_id: string;
  folder_id?: string;
  preview_url?: string;
  is_contract?: boolean;
  signature_status?: string;
}

interface Folder {
  id: string;
  name: string;
  description?: string | null;
  vendor_id: string;
  parent_folder_id: string | null;
  created_at: string;
}

interface ShareLink {
  id: string;
  document_id: string;
  share_token: string;
  expires_at: string | null;
  password_protected: boolean;
  view_count: number;
  created_at: string;
}

const Documents = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{id: string, fileUrl: string} | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [shareExpiry, setShareExpiry] = useState("7");
  const [shareLink, setShareLink] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    is_public: false,
    folder_id: "",
  });
  const [folderFormData, setFolderFormData] = useState({
    name: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    if (!user) return;
    fetchFolders();
    fetchDocuments();
  }, [user, searchQuery, filterCategory, currentFolder]);

  const fetchFolders = async () => {
    const { data } = await supabase
      .from("document_folders")
      .select("*")
      .eq("vendor_id", user!.id)
      .order("created_at", { ascending: false });
    setFolders(data || []);
  };

  // Helpers for Storage signed URLs
  const extractStoragePath = (urlOrPath: string) => {
    if (!urlOrPath) return "";
    const idx = urlOrPath.indexOf("/documents/");
    return idx !== -1 ? urlOrPath.substring(idx + "/documents/".length) : urlOrPath;
  };

  const createSignedUrl = async (doc: Document, expiresInSeconds = 3600) => {
    try {
      const path = extractStoragePath(doc.file_url);
      if (!path) return "";
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, expiresInSeconds);
      if (error) {
        console.error("Failed to create signed URL:", error);
        return "";
      }
      return data?.signedUrl || "";
    } catch (e) {
      console.error("Signed URL exception:", e);
      return "";
    }
  };

  // When opening preview, prepare a signed URL so previews work even if bucket isn't public
  useEffect(() => {
    (async () => {
      if (previewDoc) {
        const url = await createSignedUrl(previewDoc, 3600);
        setPreviewUrl(url);
      } else {
        setPreviewUrl("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDoc?.id]);

  const fetchDocuments = async () => {
    let query = supabase
      .from("documents")
      .select("*")
      .eq("vendor_id", user!.id);

    // Filter by current folder
    if (currentFolder) {
      query = query.eq("folder_id", currentFolder);
    } else {
      query = query.is("folder_id", null);
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
      toast.error("Failed to load documents");
    } else {
      setDocuments(data || []);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setUploading(true);

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      const { data: insertData, error: insertError } = await supabase.from("documents").insert({
        vendor_id: user.id,
        title: formData.title,
        description: formData.description,
        file_url: publicUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        category: formData.category,
        tags: formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        is_public: formData.is_public,
        folder_id: formData.folder_id || null,
      }).select().single();

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully");

      setDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        category: "",
        tags: "",
        is_public: false,
        folder_id: "",
      });
      setSelectedFile(null);
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    setDocumentToDelete({id, fileUrl});
    setDeleteDialogOpen(true);
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      const filePath = documentToDelete.fileUrl.split("/documents/")[1];
      await supabase.storage.from("documents").remove([filePath]);
      const { error } = await supabase.from("documents").delete().eq("id", documentToDelete.id);

      if (error) throw error;

      toast.success("Document deleted successfully");
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }

    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!folderFormData.name.trim()) {
      toast.error("Folder name is required");
      return;
    }
    
    const { error } = await supabase
      .from("document_folders")
      .insert({
        vendor_id: user!.id,
        name: folderFormData.name,
        parent_folder_id: currentFolder,
      });

    if (!error) {
      toast.success("Folder created successfully");
      setFolderDialogOpen(false);
      setFolderFormData({ name: "" });
      fetchFolders();
    } else {
      console.error("Create folder error:", error);
      toast.error(`Failed to create folder: ${error.message || 'Unknown error'}`);
    }
  };

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
      toast.success("Share link generated successfully");
    } else {
      // Fallback: create a signed URL directly from Storage so the user can still share
      const url = await createSignedUrl(doc, parseInt(shareExpiry, 10) * 24 * 60 * 60);
      if (url) {
        setShareLink(url);
        toast.info("Temporary link created using signed URL");
      } else {
        toast.error(`Failed to generate link: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copied to clipboard");
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes("pdf")) return <FileText className="h-8 w-8 text-red-600" />;
    if (fileType?.includes("image")) return <FileImage className="h-8 w-8 text-blue-600" />;
    return <FileText className="h-8 w-8 text-muted-foreground" />;
  };

  const currentFolderData = folders.find(f => f.id === currentFolder);
  const currentFolders = folders.filter(f => f.parent_folder_id === currentFolder);

  return (
    <ErrorBoundary>
      <div className="space-y-4 md:space-y-8 animate-fade-in">
      <div className="text-center space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Documents
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">Advanced document management with folders and sharing</p>
      </div>

      {/* Breadcrumb Navigation */}
      {currentFolder && (
        <div className="flex items-center gap-2 text-sm">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentFolder(null)}
            className="hover:text-primary"
          >
            <Folder className="h-4 w-4 mr-1" />
            Root
          </Button>
          <ChevronLeft className="h-4 w-4 rotate-180" />
          <span className="font-medium">{currentFolderData?.name || "Folder"}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-9 md:h-10 rounded-lg md:rounded-xl touch-feedback text-xs md:text-sm px-3 md:px-4">
                <FolderOpen className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">New Folder</span>
                <span className="sm:hidden">Folder</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <form onSubmit={createFolder} className="space-y-4">
                <div>
                  <Label htmlFor="folder-name">Folder Name *</Label>
                  <Input
                    id="folder-name"
                    value={folderFormData.name}
                    onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
                    required
                    placeholder="Enter folder name"
                    className="rounded-xl"
                  />
                </div>
                <Button type="submit" className="w-full">Create Folder</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary touch-feedback w-full sm:w-auto h-9 md:h-10 text-xs md:text-sm px-3 md:px-4">
                <Plus className="mr-1 md:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Upload Document</span>
                <span className="sm:hidden">Upload</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="md:max-w-2xl w-full md:w-auto rounded-t-2xl md:rounded-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl font-semibold">Upload New Document</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="file" className="text-sm font-medium">File</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileSelect}
                      required
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="id_proof">ID Proof</SelectItem>
                        <SelectItem value="license">License</SelectItem>
                        <SelectItem value="report">Report</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="tags" className="text-sm font-medium">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) =>
                        setFormData({ ...formData, tags: e.target.value })
                      }
                      placeholder="e.g., important, 2024, client-xyz"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="folder" className="text-sm font-medium">Folder (Optional)</Label>
                    <Select
                      value={formData.folder_id}
                      onValueChange={(value) => setFormData({ ...formData, folder_id: value === "root" ? "" : value })}
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
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="is_public"
                        checked={formData.is_public}
                        onChange={(e) =>
                          setFormData({ ...formData, is_public: e.target.checked })
                        }
                        className="w-4 h-4 text-primary bg-muted border-border rounded focus:ring-primary/20"
                      />
                      <Label htmlFor="is_public" className="text-sm font-medium">Make this document public</Label>
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={uploading} className="w-full h-12 rounded-xl">
                  {uploading ? "Uploading..." : "Upload Document"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
        <CardContent className="pt-4 md:pt-6 px-4 md:px-8 pb-4 md:pb-6">
          <div className="flex gap-2 md:gap-4 flex-wrap">
            <div className="flex-1 min-w-[150px] md:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-lg md:rounded-xl text-xs md:text-sm">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="id_proof">ID Proof</SelectItem>
                <SelectItem value="license">License</SelectItem>
                <SelectItem value="report">Report</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Folder Grid */}
      {currentFolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
          {currentFolders.map((folder) => (
            <Card
              key={folder.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group touch-feedback active:scale-[0.98]"
              onClick={() => setCurrentFolder(folder.id)}
            >
              <CardContent className="p-3 md:p-4 text-center">
                <FolderOpen className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-1 md:mb-2 text-primary group-hover:scale-110 transition-transform" />
                <p className="font-medium truncate text-xs md:text-sm">{folder.name}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  {documents.filter(d => d.folder_id === folder.id).length} files
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documents Section */}
      {documents.length === 0 && currentFolders.length === 0 ? (
        <Card className="glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <FileText className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50 mb-3 md:mb-4" />
            <p className="text-muted-foreground text-base md:text-lg mb-2">
              No documents yet
            </p>
            <p className="text-xs md:text-sm text-muted-foreground/70">Upload your first document to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 lg:gap-6">
          {documents.map((doc) => (
            <Card key={doc.id} className="group glass card-hover rounded-xl md:rounded-2xl border-0 shadow-card touch-feedback active:scale-[0.98]">
              <CardHeader className="pb-2 md:pb-3 pt-4 md:pt-6 px-4 md:px-6">
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="text-base md:text-lg font-semibold text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                    {doc.title}
                  </span>
                  {doc.is_public && (
                    <Badge variant="secondary" className="shrink-0">
                      Public
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 md:space-y-3 px-4 md:px-6 pb-4 md:pb-6">
                {doc.description && (
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                    {doc.description}
                  </p>
                )}
                <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                  {doc.category && (
                    <p>
                      <span className="font-medium">Category:</span>{" "}
                      <Badge variant="outline" className="ml-1">{doc.category}</Badge>
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Size:</span> {formatFileSize(doc.file_size)}
                  </p>
                  <p>
                    <span className="font-medium">Uploaded:</span>{" "}
                    {format(new Date(doc.created_at), "PP")}
                  </p>
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 md:gap-1.5 flex-wrap pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewDoc(doc)}
                    title="Preview"
                    className="flex-1 h-8 md:h-9 touch-feedback"
                  >
                    <Eye className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShareDoc(doc);
                      setShareDialogOpen(true);
                      setShareLink("");
                    }}
                    title="Share Link"
                    className="flex-1 h-8 md:h-9 touch-feedback"
                  >
                    <Share2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const url = await createSignedUrl(doc, 3600);
                      window.open(url || doc.file_url, "_blank");
                    }}
                    title="Download"
                    className="flex-1 h-8 md:h-9 touch-feedback"
                  >
                    <Download className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(doc.id, doc.file_url)}
                    title="Delete"
                    className="flex-1 h-8 md:h-9 touch-feedback"
                  >
                    <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mobile FAB for quick upload */}
      <div className="md:hidden fixed bottom-24 right-4 z-40">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-180 hover:scale-110"
          onClick={() => setDialogOpen(true)}
        >
          <Upload className="h-7 w-7" />
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[calc(90vh-100px)]">
            {previewDoc && (() => {
              const isImage = previewDoc.file_type?.startsWith("image/") || 
                            previewDoc.file_url?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
              const isPDF = previewDoc.file_type === "application/pdf" || 
                          previewDoc.file_url?.endsWith(".pdf");
              
              if (isImage) {
                return (
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <img 
                      src={previewUrl || previewDoc.file_url}
                      alt={previewDoc.title}
                      className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                      onError={(e) => {
                        console.error("Image failed to load:", previewDoc.file_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                );
              }
              
              if (isPDF) {
                return (
                  <iframe
                    src={previewUrl || previewDoc.file_url}
                    className="w-full h-[600px] border-0 rounded-lg"
                    title={previewDoc.title}
                  />
                );
              }
              
              return (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">Preview not available for this file type</p>
                  <p className="text-xs text-muted-foreground mb-4">Type: {previewDoc.file_type || "Unknown"}</p>
                  <Button onClick={() => window.open(previewDoc.file_url, "_blank")}>
                    <Download className="mr-2 h-4 w-4" />
                    Download to View
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Link Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Link expires in</Label>
              <Select value={shareExpiry} onValueChange={setShareExpiry}>
                <SelectTrigger className="mt-1">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="md:max-w-sm w-full md:w-auto rounded-t-2xl md:rounded-lg">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this document? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteDocument}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </ErrorBoundary>
  );
};

export default Documents;
