"use client";
import { useEffect, useState } from "react";
import { BACKEND_API_URL, apiFetch } from "@/app/core";
import { useAuth } from "@/app/contexts/AuthContext";

type ProjectRole = "admin" | "annotator" | "viewer" | null;

export type ProjectRoleInfo = {
  // This project's membership role for the current user, or "admin" for a global
  // admin who bypasses membership entirely. null while loading or if the user has
  // no membership and isn't a global admin.
  role: ProjectRole;
  // Global admin, or a project-level admin - can manage members and delete a trained
  // model artifact. Mirrors the backend's require_project_admin_role.
  isAdmin: boolean;
  // Global admin, or a project-level admin/annotator - can create, edit and delete
  // annotations and samples, and edit or delete the project itself. Mirrors the
  // backend's require_project_annotator.
  canAnnotate: boolean;
  loading: boolean;
};

export function useProjectRole(
  project_id: string | null | undefined,
): ProjectRoleInfo {
  const { user } = useAuth();
  const [role, setRole] = useState<ProjectRole>(null);
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !project_id) {
      setRole(null);
      setRestricted(false);
      setLoading(false);
      return;
    }
    if (user.global_role === "admin") {
      setRole("admin");
      setRestricted(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`${BACKEND_API_URL}/projects/${project_id}/members`)
      .then((r) => r.json())
      .then((members: Array<{ user_id: string; role: ProjectRole }>) => {
        const membership = members.find((m) => m.user_id === user._id);
        setRole(membership?.role ?? null);
        setRestricted(true);
      })
      .catch(() => {
        setRole(null);
        setRestricted(true); // fail closed on a real error
      })
      .finally(() => setLoading(false));
  }, [project_id, user]);

  return {
    role,
    isAdmin: restricted ? role === "admin" : true,
    canAnnotate: restricted ? role === "admin" || role === "annotator" : true,
    loading,
  };
}

export type MyProjectRoles = {
  roleFor: (project_id: string | null | undefined) => ProjectRole;
  isAdminIn: (project_id: string | null | undefined) => boolean;
  canAnnotateIn: (project_id: string | null | undefined) => boolean;
  loading: boolean;
};

export function useMyProjectRoles(): MyProjectRoles {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Record<string, ProjectRole>>({});
  const [loading, setLoading] = useState(true);

  const isGlobalAdmin = user?.global_role === "admin";

  useEffect(() => {
    if (!user) {
      setRoles({});
      setLoading(false);
      return;
    }
    if (isGlobalAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`${BACKEND_API_URL}/users/me/memberships`)
      .then((r) => r.json())
      .then((memberships: Array<{ project_id: string; role: ProjectRole }>) => {
        setRoles(
          Object.fromEntries(memberships.map((m) => [m.project_id, m.role])),
        );
      })
      .catch(() => setRoles({})) // fail closed on a real error
      .finally(() => setLoading(false));
  }, [user, isGlobalAdmin]);

  const roleFor = (project_id: string | null | undefined): ProjectRole => {
    if (isGlobalAdmin) return "admin";
    return project_id ? (roles[project_id] ?? null) : null;
  };

  return {
    roleFor,
    isAdminIn: (project_id) => roleFor(project_id) === "admin",
    canAnnotateIn: (project_id) => {
      const role = roleFor(project_id);
      return role === "admin" || role === "annotator";
    },
    loading,
  };
}
