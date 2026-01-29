import { useState, useEffect } from "react";
import { supabase, supabaseAdmin, getAdminClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

type Module = {
  key: string;
  label: string;
  url: string;
};

type StaffMember = {
  id?: string;
  email: string;
  password?: string;
  role: 'admin' | 'staff';
  modules: string[];
  is_active: boolean;
  created_at?: string;
  auth_user_id?: string;
};

const StaffManagement = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<StaffMember, 'id' | 'created_at'>>({ 
    email: '', 
    password: '',
    role: 'staff', 
    modules: [],
    is_active: true
  });
  const [availableModules, setAvailableModules] = useState<Module[]>([]);

  // Fetch staff members using admin client to bypass RLS
  const fetchStaff = async () => {
    setLoading(true);
    console.log('Starting to fetch staff members with admin client...');
    
    try {
      // Use admin client to bypass RLS
      const adminClient = getAdminClient();
      if (!adminClient) {
        const error = new Error('Admin client is not available. Check your service role key configuration.');
        console.error('Admin client check failed:', error);
        throw error;
      }

      console.log('Using admin client to bypass RLS...');
      
      // Fetch staff data using admin client
      const { data, error, status } = await adminClient
        .from('staff')
        .select('*')
        .order('created_at', { ascending: true });

      console.log('Admin client response:', { 
        hasData: !!data, 
        dataLength: data?.length, 
        status,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null
      });

      if (error) {
        console.error('Admin client query error:', {
          message: error.message,
          details: error.details,
          code: error.code,
          status
        });
        throw error;
      }

      console.log(`Successfully fetched ${data?.length || 0} staff members`);
      setStaff(data || []);
      return data || [];
    } catch (error) {
      console.error('Error in fetchStaff with admin client:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.status,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
      });
      
      let errorMessage = 'Failed to load staff members';
      if (error?.code === '42501') {
        errorMessage = 'Permission denied. Please check your service role key.';
      } else if (error?.code === '42P01') {
        errorMessage = 'Staff table does not exist. Please check your database setup.';
      } else if (error?.message) {
        errorMessage += `: ${error.message}`;
      }
      
      toast.error(errorMessage);
      setStaff([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Get available modules from navigation items
  const getAvailableModules = (): Module[] => {
    return [
      { key: 'bookings', label: 'Bookings', url: '/bookings' },
      { key: 'calendar', label: 'Calendar', url: '/calendar' },
      { key: 'clients', label: 'Clients & CRM', url: '/clients' },
      { key: 'packages', label: 'Packages', url: '/packages' },
      { key: 'entities', label: 'Venues/Branches', url: '/entities' },
      { key: 'payments', label: 'Payments', url: '/payments' },
      { key: 'invoices', label: 'Invoices', url: '/invoices' },
      { key: 'accounts', label: 'Accounts', url: '/accounts' },
      { key: 'documents', label: 'Documents', url: '/documents' },
      { key: 'reports', label: 'Reports', url: '/reports' },
      { key: 'settings', label: 'Settings', url: '/settings' }
    ];
  };

  // Fetch available modules
  const fetchAvailableModules = async () => {
    setAvailableModules(getAvailableModules());
  };

  useEffect(() => {
    fetchStaff();
    fetchAvailableModules();
    // Set initial password when component mounts
    setFormData(prev => ({
      ...prev,
      password: generateRandomPassword()
    }));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value 
    }));
  };

  const handleModuleToggle = (moduleKey: string) => {
    setFormData(prev => ({
      ...prev,
      modules: prev.modules.includes(moduleKey)
        ? prev.modules.filter(m => m !== moduleKey)
        : [...prev.modules, moduleKey]
    }));
  };

  const createStaffMember = async () => {
    if (!formData.email || !formData.password) {
      throw new Error('Email and password are required');
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      throw new Error('Admin client not available. Check your service role key configuration.');
    }

    try {
      // 1. Create auth user using admin client
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          is_staff: true,
          role: formData.role,
          modules: formData.modules
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(`Authentication failed: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('No user data returned from authentication service');
      }

      console.log('Auth user created with ID:', authData.user.id);

      // 2. Create staff record using the same admin client to bypass RLS
      const { data: staffData, error: staffError } = await adminClient
        .from('staff')
        .insert([{
          email: formData.email,
          role: formData.role,
          modules: formData.modules,
          is_active: true,
          auth_user_id: authData.user.id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (staffError) {
        console.error('Staff creation error:', staffError);
        // Attempt to clean up auth user if staff creation fails
        try {
          await adminClient.auth.admin.deleteUser(authData.user.id);
          console.log('Cleaned up auth user after staff creation failed');
        } catch (cleanupError) {
          console.error('Error during auth user cleanup:', cleanupError);
        }
        throw new Error(`Failed to create staff record: ${staffError.message}`);
      }

      console.log('Staff record created successfully:', staffData);
      return staffData;
    } catch (error) {
      console.error('Error in createStaffMember:', error);
      throw error;
    }
  };

  const generateRandomPassword = (length = 12) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]\\:;?><,./-=';

    let password = '';
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);

    for (let i = 0; i < length; i++) {
      password += charset[values[i] % charset.length];
    }

    // Ensure password meets requirements
    if (!/[A-Z]/.test(password)) password += 'A';
    if (!/[0-9]/.test(password)) password += '1';
    if (!/[!@#$%^&*]/.test(password)) password += '!';

    return password.substring(0, length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.role || (!isEditing && !formData.password)) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      console.log('Initializing admin client...');
      const adminClient = getAdminClient();
      if (!adminClient) {
        throw new Error('Admin client is not available. Please check your service role key configuration in the .env file.');
      }

      if (isEditing) {
        console.log('Updating existing staff member...');
        // Update existing staff
        const { data: staffData, error: fetchError } = await adminClient
          .from('staff')
          .select('user_id')
          .eq('id', isEditing)
          .single();

        if (fetchError) {
          console.error('Error fetching staff data:', fetchError);
          throw new Error(`Failed to fetch staff data: ${fetchError.message}`);
        }

        // Update auth user email if changed
        if (staffData?.user_id) {
          console.log('Updating auth user email...');
          const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
            staffData.user_id,
            { 
              email: formData.email,
              user_metadata: {
                is_staff: true,
                role: formData.role
              }
            }
          );
          if (updateAuthError) {
            console.error('Error updating auth user:', updateAuthError);
            throw new Error(`Failed to update authentication: ${updateAuthError.message}`);
          }
        }

        // Update staff record
        console.log('Updating staff record...');
        const { error: updateError } = await adminClient
          .from('staff')
          .update({
            email: formData.email,
            role: formData.role,
            modules: formData.modules,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', isEditing);

        if (updateError) {
          console.error('Error updating staff record:', updateError);
          throw new Error(`Failed to update staff record: ${updateError.message}`);
        }
        
        toast.success('Staff member updated successfully');
        console.log('Staff member updated successfully');
      } else {
        // Create new staff with auth user
        console.log('Creating new staff member with data:', {
          email: formData.email,
          role: formData.role,
          modules: formData.modules
        });

        try {
          // First create auth user as admin (no email confirmation needed)
          console.log('Creating auth user as admin...');
          const { data: authData, error: createUserError } = await adminClient.auth.admin.createUser({
            email: formData.email,
            password: formData.password || 'TempPassword123!', // Will be updated below
            email_confirm: true, // No need for email confirmation
            user_metadata: {
              is_staff: true,
              role: formData.role,
              name: formData.email.split('@')[0]
            }
          });

          if (createUserError) throw createUserError;
          if (!authData.user) throw new Error('No user data returned from authentication');

          console.log('Auth user created:', authData.user.id);
          
          // Update the password to the one provided by the admin
          if (formData.password) {
            const { error: updateError } = await adminClient.auth.admin.updateUserById(
              authData.user.id,
              { password: formData.password }
            );
            if (updateError) {
              console.error('Error updating password:', updateError);
              throw new Error(`Failed to set password: ${updateError.message}`);
            }
          }

          try {
            // Add a small delay to ensure the auth user is fully created
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Create staff record directly since we already have the auth user ID
            console.log('Creating staff record...');
            const { data: staffData, error: staffError } = await adminClient
              .from('staff')
              .insert({
                user_id: authData.user.id,
                email: formData.email,
                name: formData.email.split('@')[0],
                role: formData.role,
                modules: formData.modules,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();

            if (staffError) throw staffError;

            console.log('Staff record created:', staffData);
            toast.success('Staff member added successfully. Please ask them to check their email to confirm their account.');
          } catch (staffError) {
            console.error('Error creating staff record:', staffError);
            // Clean up auth user if staff creation fails
            try {
              await adminClient.auth.admin.deleteUser(authData.user.id);
              console.log('Cleaned up auth user after staff creation failure');
            } catch (cleanupError) {
              console.error('Error cleaning up auth user:', cleanupError);
            }
            throw new Error(`Failed to create staff record: ${staffError.message}`);
          }
        } catch (authError) {
          console.error('Error in user creation:', authError);
          // Provide more specific error messages
          if (authError.message.includes('already registered')) {
            throw new Error('A user with this email already exists');
          } else if (authError.message.includes('password')) {
            throw new Error('Invalid password. Please ensure it meets the requirements.');
          } else {
            throw new Error(`Authentication error: ${authError.message}`);
          }
        }
      }
      
      // Reset form and refresh staff list
      setFormData({
        email: '',
        password: '',
        role: 'staff',
        modules: [],
        is_active: true
      });
      setIsEditing(null);
      await fetchStaff();
    } catch (error) {
      console.error('Error in staff management:', error);
      
      let errorMessage = 'Failed to save staff member';
      
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = 'A user with this email already exists';
        } else if (error.message.includes('password')) {
          errorMessage = 'Invalid password. Please ensure it meets the requirements.';
        } else if (error.message.includes('email')) {
          errorMessage = 'Invalid email address. Please check the format.';
        } else {
          errorMessage = error.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      console.error('Displaying error to user:', errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: StaffMember) => {
    setFormData({
      email: member.email,
      password: '', // Clear password when editing
      role: member.role,
      modules: [...member.modules],
      is_active: member.is_active
    });
    setIsEditing(member.id || null);
  };

  const toggleStaffStatus = async (id: string, currentStatus: boolean) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this staff member?`)) {
      return;
    }

    try {
      const adminClient = getAdminClient();
      if (!adminClient) {
        throw new Error('Admin client is not available');
      }

      // First get the staff member to get user_id
      const { data: staffData, error: fetchError } = await adminClient
        .from('staff')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Update staff status
      const { error: updateError } = await adminClient.rpc('update_staff_status', {
        p_staff_id: id,
        p_is_active: !currentStatus
      });

      if (updateError) throw updateError;
      
      // If deactivating, also sign out the user if they're logged in
      if (currentStatus && staffData?.user_id) {
        await adminClient.auth.admin.signOut([staffData.user_id]);
      }
      
      // Update local state
      setStaff(staff.map(s => 
        s.id === id ? { ...s, is_active: !currentStatus } : s
      ));
      
      toast.success(`Staff member ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error toggling staff status:', {
        message: error?.message,
        code: error?.code,
        details: error
      });
      toast.error(`Failed to update staff status: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      console.error('No staff member ID provided for deletion');
      toast.error('Error: No staff member selected');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) return;
    
    console.log('Attempting to delete staff member with ID:', id);
    
    setLoading(true);
    try {
      const adminClient = getAdminClient();
      if (!adminClient) {
        throw new Error('Admin client not available. Please check your service role key configuration.');
      }

      // First, get the staff member to get the auth_user_id
      const { data: staffMember, error: fetchError } = await adminClient
        .from('staff')
        .select('auth_user_id, email, role, modules, is_active, created_at')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching staff member:', fetchError);
        throw new Error(`Failed to fetch staff member: ${fetchError.message}`);
      }

      // Store the staff data for potential recovery
      const staffData = { ...staffMember };
      
      // Delete the staff record first
      console.log('Deleting staff record...');
      const { error: deleteError } = await adminClient
        .from('staff')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting staff record:', deleteError);
        throw new Error(`Failed to delete staff record: ${deleteError.message}`);
      }

      // Delete the auth user if auth_user_id exists
      if (staffMember?.auth_user_id) {
        try {
          console.log('Deleting auth user:', staffMember.auth_user_id);
          const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(staffMember.auth_user_id);
          
          if (deleteUserError) {
            console.error('Error deleting auth user:', deleteUserError);
            throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
          }
          
          console.log('Successfully deleted auth user:', staffMember.auth_user_id);
        } catch (authError) {
          console.error('Error in auth user deletion:', authError);
          // If we fail to delete the auth user, we should recreate the staff record
          // to maintain data consistency
          try {
            await adminClient
              .from('staff')
              .insert([{
                ...staffData,
                updated_at: new Date().toISOString()
              }]);
            
            throw new Error('Failed to delete auth user. Staff record has been restored. Please try again or contact support.');
          } catch (recoveryError) {
            console.error('Failed to recover staff record after auth user deletion failure:', recoveryError);
            throw new Error('Critical error: Failed to delete auth user and could not recover staff record. Please contact support.');
          }
        }
      } else {
        console.warn('No auth_user_id found for staff member. Only the staff record was deleted.');
      }
      
      toast.success('Staff member deleted successfully');
      await fetchStaff(); // Refresh the staff list
    } catch (error) {
      console.error('Error in handleDelete:', {
        error: error?.message || 'Unknown error',
        code: error?.code,
        details: error
      });
      
      const errorMessage = error?.message || 'Failed to delete staff member';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Staff Management</h2>
        {isEditing && (
          <Button variant="outline" onClick={resetForm} size="sm">
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="staff@example.com"
                  required
                />
              </div>
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password || ''}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required={!isEditing}
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    {!isEditing ? 'At least 8 characters required' : 'Leave empty to keep current password'}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'admin' | 'staff') => 
                    setFormData(prev => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="block">Module Access</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          modules: availableModules.map(m => m.key)
                        }));
                      }}
                      className="text-xs h-7"
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          modules: []
                        }));
                      }}
                      className="text-xs h-7"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only selected modules will be accessible to this staff member.
                </p>
              </div>
              
              <div className="border rounded-md p-3 bg-muted/20">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availableModules.map(module => {
                    const isSelected = formData.modules.includes(module.key);
                    return (
                      <div 
                        key={module.key} 
                        className={`flex items-center space-x-2 p-2 rounded ${isSelected ? 'bg-primary/10 border border-primary/20' : 'opacity-70'}`}
                      >
                        <input
                          type="checkbox"
                          id={`module-${module.key}`}
                          checked={isSelected}
                          onChange={() => handleModuleToggle(module.key)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label 
                          htmlFor={`module-${module.key}`}
                          className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'} cursor-pointer`}
                          title={module.url}
                        >
                          {module.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex items-center text-xs text-muted-foreground">
                <div className="flex items-center mr-4">
                  <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30 mr-1"></div>
                  <span>Selected (accessible)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-transparent border border-muted-foreground/30 mr-1"></div>
                  <span>Not selected (disabled)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading}>
                {isEditing ? (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Staff
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Staff
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {loading ? 'Loading...' : 'No staff members found'}
                  </TableCell>
                </TableRow>
              ) : (
                staff.map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        member.role === 'admin' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {member.modules.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">No modules assigned</span>
                        ) : (
                          member.modules.map(module => (
                            <span 
                              key={module} 
                              className="text-xs bg-muted px-2 py-0.5 rounded capitalize"
                              title={module}
                            >
                              {module}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => member.id && toggleStaffStatus(member.id, member.is_active)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            member.is_active ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                          role="switch"
                          aria-checked={member.is_active}
                        >
                          <span className="sr-only">Toggle staff status</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              member.is_active ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="ml-2 text-sm text-gray-600">
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => member.id && handleDelete(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffManagement;
