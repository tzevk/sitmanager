'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { hasPermission, hasAnyPermission, canAccessResource, PermissionAction } from '@/lib/rbac';

interface UserSession {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: number;
  permissions: string[];
}

interface PermissionContextType {
  session: UserSession | null;
  loading: boolean;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  canAccess: (resource: string, action: PermissionAction) => boolean;
  isSuperAdmin: boolean;
  refreshSession: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      // Fetch session
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      
      if (sessionData.success && sessionData.session) {
        setSession(sessionData.session);
        
        // Fetch permissions for user's role
        if (sessionData.session.role === 1) {
          // Super admin gets all permissions
          const permRes = await fetch('/api/roles/permissions?flat=true');
          const permData = await permRes.json();
          if (permData.success) {
            setPermissions(permData.data.map((p: { id: string }) => p.id));
          }
        } else {
          // Regular user - fetch role permissions
          const roleRes = await fetch(`/api/roles/${sessionData.session.role}`);
          const roleData = await roleRes.json();
          if (roleData.success) {
            setPermissions(roleData.data.permissions || []);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const value = useMemo<PermissionContextType>(() => ({
    session,
    loading,
    permissions,
    hasPermission: (permission: string) => hasPermission(permissions, permission),
    hasAnyPermission: (required: string[]) => hasAnyPermission(permissions, required),
    canAccess: (resource: string, action: PermissionAction) => 
      canAccessResource(permissions, resource, action),
    isSuperAdmin: session?.role === 1,
    refreshSession: fetchSession,
  }), [session, loading, permissions, fetchSession]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

// Hook to use permissions
export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Wrapper component for permission-based rendering
interface RequirePermissionProps {
  permission?: string;
  permissions?: string[];
  any?: boolean; // If true, requires any of the permissions, otherwise requires all
  fallback?: ReactNode;
  children: ReactNode;
}

export function RequirePermission({ 
  permission, 
  permissions: requiredPermissions, 
  any = true,
  fallback = null, 
  children 
}: RequirePermissionProps) {
  const { permissions, loading, isSuperAdmin } = usePermissions();

  if (loading) {
    return null;
  }

  // Super admin can access everything
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Single permission check
  if (permission) {
    if (hasPermission(permissions, permission)) {
      return <>{children}</>;
    }
    return <>{fallback}</>;
  }

  // Multiple permissions check
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAccess = any 
      ? hasAnyPermission(permissions, requiredPermissions)
      : requiredPermissions.every(p => hasPermission(permissions, p));
    
    if (hasAccess) {
      return <>{children}</>;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for button/action visibility
export function useCanPerform(resource: string, action: PermissionAction): boolean {
  const { canAccess, loading, isSuperAdmin } = usePermissions();
  
  if (loading) return false;
  if (isSuperAdmin) return true;
  
  return canAccess(resource, action);
}

// Hook for checking multiple resources
export function useResourcePermissions(resource: string) {
  const { permissions, loading, isSuperAdmin } = usePermissions();

  return useMemo(() => {
    if (loading) {
      return {
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canExport: false,
        loading: true as const,
      };
    }

    if (isSuperAdmin) {
      return {
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canExport: true,
        loading: false as const,
      };
    }

    return {
      canView: hasPermission(permissions, `${resource}.view`),
      canCreate: hasPermission(permissions, `${resource}.create`),
      canUpdate: hasPermission(permissions, `${resource}.update`),
      canDelete: hasPermission(permissions, `${resource}.delete`),
      canExport: hasPermission(permissions, `${resource}.export`),
      loading: false as const,
    };
  }, [permissions, loading, isSuperAdmin, resource]);
}
