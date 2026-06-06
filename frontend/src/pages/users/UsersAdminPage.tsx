import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import FeedbackMessage from "../../components/FeedbackMessage";
import FormModal from "../../components/FormModal";
import LoadingState from "../../components/LoadingState";
import Pagination from "../../components/Pagination";
import SideDrawer from "../../components/SideDrawer";
import {
  LIST_FILTER_DEBOUNCE_MS,
  LIST_SEARCH_MIN_CHARS,
} from "../../constants/search";
import { DEFAULT_USER_PAGE_SIZE } from "../../constants/user";
import UserDetailPanel from "../../features/users/components/UserDetailPanel";
import UserFilters from "../../features/users/components/UserFilters";
import UserForm from "../../features/users/components/UserForm";
import UserTable from "../../features/users/components/UserTable";
import {
  getUserFieldErrors,
  usersService,
} from "../../features/users/services/users.service";
import { campusService } from "../../features/campuses/services/campus.service";
import type {
  PaginationMeta,
  User,
  UserFormErrors,
  UserFormValues,
  UserListParams,
  UserStatus,
} from "../../types/user";
import type { CampusOption } from "../../types/campus";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import {
  normalizeSearchInputForQuery,
  normalizeTextForSearch,
} from "../../utils/textSearch";

const DEFAULT_META: PaginationMeta = {
  totalItems: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: DEFAULT_USER_PAGE_SIZE,
};

const DEFAULT_FILTERS = {
  search: "",
  role: "",
  status: "",
  campusId: "",
};
type ConfirmState =
  | null
  | {
    type: "delete";
    user: User;
  }
  | {
    type: "resend-invitation";
    user: User;
  }
  | {
    type: "status";
    user: User;
    nextStatus: UserStatus;
  };

function buildUserQueryFromFilters(
  filters: typeof DEFAULT_FILTERS,
  limit: number,
): UserListParams {
  return {
    search: normalizeSearchInputForQuery(
      filters.search,
      LIST_SEARCH_MIN_CHARS,
    ),
    role: (filters.role as UserListParams["role"]) || undefined,
    status: (filters.status as UserListParams["status"]) || undefined,
    campusId: filters.campusId === "" ? undefined : Number(filters.campusId),
    page: 1,
    limit,
  };
}

function areUserQueriesEqual(left: UserListParams, right: UserListParams) {
  return (
    left.search === right.search
    && left.role === right.role
    && left.status === right.status
    && left.campusId === right.campusId
    && left.page === right.page
    && left.limit === right.limit
  );
}

export default function UsersAdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const isSuperAdmin = authUser?.role === "SuperAdmin";

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serverErrors, setServerErrors] = useState<UserFormErrors>({});
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [campusOptions, setCampusOptions] = useState<CampusOption[]>([]);

  const [filtersForm, setFiltersForm] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState<UserListParams>({
    page: 1,
    limit: DEFAULT_USER_PAGE_SIZE,
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const filterApplyTimeoutRef = useRef<number | null>(null);
  const listRequestIdRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);

  const searchSuggestions = useMemo(() => {
    const suggestions: Array<{ value: string; label: string; description: string }> = [];
    const seenValues = new Set<string>();

    for (const user of items) {
      const candidateOptions = [
        {
          value: user.name,
          label: user.name,
          description: `Correo: ${user.email}`,
        },
        {
          value: user.email,
          label: user.email,
          description: `Usuario: ${user.name}`,
        },
      ];

      for (const candidate of candidateOptions) {
        const normalizedCandidateValue = normalizeTextForSearch(candidate.value);
        if (!normalizedCandidateValue || seenValues.has(normalizedCandidateValue)) {
          continue;
        }

        seenValues.add(normalizedCandidateValue);
        suggestions.push(candidate);
      }
    }

    return suggestions;
  }, [items]);

  function isProtectedSuperAdminSelf(user: User) {
    return isSuperAdmin && authUser?.id === user.id;
  }

  async function loadUsers(currentQuery: UserListParams) {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    listAbortControllerRef.current?.abort();
    const requestAbortController = new AbortController();
    listAbortControllerRef.current = requestAbortController;

    setLoading(true);
    setError("");

    try {
      const response = await usersService.getUsers(currentQuery, {
        signal: requestAbortController.signal,
      });
      if (listRequestIdRef.current !== requestId) {
        return;
      }
      setItems(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (
        listRequestIdRef.current !== requestId
        || requestAbortController.signal.aborted
      ) {
        return;
      }
      setError(getErrorMessage(err, "No se pudo cargar la lista de usuarios"));
    } finally {
      if (listAbortControllerRef.current === requestAbortController) {
        listAbortControllerRef.current = null;
      }

      if (listRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadUsers(query);
  }, [query]);

  useEffect(() => {
    async function loadCampusOptions() {
      try {
        const campuses = await campusService.getCampusOptions();
        setCampusOptions(campuses);
      } catch {
        setCampusOptions([]);
      }
    }

    loadCampusOptions();
  }, []);

  useEffect(() => {
    return () => {
      if (filterApplyTimeoutRef.current !== null) {
        window.clearTimeout(filterApplyTimeoutRef.current);
        filterApplyTimeoutRef.current = null;
      }

      listAbortControllerRef.current?.abort();
      listAbortControllerRef.current = null;
      listRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!viewingUser) return;

    const nextUser = items.find((item) => item.id === viewingUser.id);
    if (!nextUser) return;

    setViewingUser(nextUser);
  }, [items, viewingUser]);

  useEffect(() => {
    const navigationState = location.state as {
      message?: string;
      openEditUser?: User;
      dashboardFilters?: Partial<typeof DEFAULT_FILTERS>;
    } | null;

    if (navigationState?.dashboardFilters) {
      const nextFilters = {
        ...DEFAULT_FILTERS,
        ...navigationState.dashboardFilters,
      };

      setFiltersForm(nextFilters);
      setQuery((previousQuery) => {
        const nextQuery = buildUserQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_USER_PAGE_SIZE,
        );

        return areUserQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery;
      });
    }

    if (navigationState?.message) {
      setSuccess(navigationState.message);
    }

    if (navigationState?.openEditUser) {
      const isSelfSuperAdminEditAttempt =
        isSuperAdmin &&
        authUser?.id === navigationState.openEditUser.id;

      if (isSelfSuperAdminEditAttempt) {
        setError("No puedes editar tu propio usuario siendo superadmin");
      } else {
        setError("");
        setServerErrors({});
        setEditingUser(navigationState.openEditUser);
        setModalMode("edit");
      }
    }

    if (
      navigationState?.dashboardFilters
      || navigationState?.message
      || navigationState?.openEditUser
    ) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [authUser, location.pathname, location.state, navigate]);

  function clearPendingFilterApply() {
    if (filterApplyTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(filterApplyTimeoutRef.current);
    filterApplyTimeoutRef.current = null;
  }

  function scheduleFilterApply(
    nextFilters: typeof DEFAULT_FILTERS,
    mode: "debounced" | "immediate",
  ) {
    const applyFilters = () => {
      setQuery((previousQuery) => {
        const nextQuery = buildUserQueryFromFilters(
          nextFilters,
          previousQuery.limit || DEFAULT_USER_PAGE_SIZE,
        );

        return areUserQueriesEqual(previousQuery, nextQuery)
          ? previousQuery
          : nextQuery;
      });
    };

    clearPendingFilterApply();

    if (mode === "debounced") {
      filterApplyTimeoutRef.current = window.setTimeout(() => {
        applyFilters();
        filterApplyTimeoutRef.current = null;
      }, LIST_FILTER_DEBOUNCE_MS);
      return;
    }

    applyFilters();
  }

  function handleFilterFieldChange(
    name: keyof typeof DEFAULT_FILTERS,
    value: string,
    mode: "debounced" | "immediate",
  ) {
    setFiltersForm((previousFilters) => {
      const nextFilters = {
        ...previousFilters,
        [name]: value,
      };

      scheduleFilterApply(nextFilters, mode);
      return nextFilters;
    });
  }

  function handleClearFilters() {
    clearPendingFilterApply();
    setFiltersForm(DEFAULT_FILTERS);
    setQuery((previousQuery) => {
      const nextQuery = {
        page: 1,
        limit: previousQuery.limit || DEFAULT_USER_PAGE_SIZE,
      };

      return areUserQueriesEqual(previousQuery, nextQuery)
        ? previousQuery
        : nextQuery;
    });
  }

  function handlePageChange(page: number) {
    setQuery((prev) => ({
      ...prev,
      page,
    }));
  }

  function handlePageSizeChange(limit: number) {
    setQuery((prev) => ({
      ...prev,
      limit,
      page: 1,
    }));
  }

  function handleDeleteClick(user: User) {
    if (isProtectedSuperAdminSelf(user)) {
      setError("No puedes eliminar tu propio usuario siendo superadmin");
      return;
    }

    setConfirmState({
      type: "delete",
      user,
    });
  }

  function handleToggleStatusClick(user: User) {
    if (isProtectedSuperAdminSelf(user)) {
      setError("No puedes desactivar tu propio usuario siendo superadmin");
      return;
    }

    const nextStatus: UserStatus =
      user.status === "active"
        ? "inactive"
        : user.status === "invited"
          ? "inactive"
          : "active";

    setConfirmState({
      type: "status",
      user,
      nextStatus,
    });
  }

  function handleResendInvitationClick(user: User) {
    if (isProtectedSuperAdminSelf(user)) {
      setError("No puedes reenviarte invitaciones siendo superadmin");
      return;
    }

    if (user.status !== "invited") {
      setError("Solo se puede reenviar invitación a usuarios invitados");
      return;
    }

    setConfirmState({
      type: "resend-invitation",
      user,
    });
  }

  async function handleConfirmAction() {
    if (!confirmState) return;

    if (isProtectedSuperAdminSelf(confirmState.user)) {
      setConfirmState(null);
      setError("No puedes modificar tu propio usuario siendo superadmin");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      if (confirmState.type === "delete") {
        await usersService.deleteUser(confirmState.user.id);
        setSuccess("Usuario eliminado correctamente");
      } else if (confirmState.type === "resend-invitation") {
        const response = await usersService.resendInvitation(confirmState.user.id);
        setSuccess(response.message || "Invitación reenviada correctamente");
      } else {
        const response = await usersService.changeUserStatus(
          confirmState.user.id,
          confirmState.nextStatus,
        );

        setSuccess(response.message ||
          (confirmState.nextStatus === "active"
            ? "Usuario activado correctamente"
            : "Usuario desactivado correctamente"));
      }

      setConfirmState(null);
      await loadUsers(query);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la acción"));
    } finally {
      setActionLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setError("");
    setSuccess("");
    setServerErrors({});
    setEditingUser(null);
    setModalMode("create");
  }

  function handleOpenEditModal(user: User) {
    if (isProtectedSuperAdminSelf(user)) {
      setError("No puedes editar tu propio usuario siendo superadmin");
      return;
    }

    setError("");
    setSuccess("");
    setServerErrors({});
    setEditingUser(user);
    setModalMode("edit");
  }

  function handleOpenViewDrawer(user: User) {
    setError("");
    setSuccess("");
    setViewingUser(user);
  }

  function handleCloseViewDrawer() {
    setViewingUser(null);
  }

  function handleEditFromDrawer() {
    if (!viewingUser) return;

    const targetUser = viewingUser;
    setViewingUser(null);
    handleOpenEditModal(targetUser);
  }

  function handleResendFromDrawer() {
    if (!viewingUser) return;

    const targetUser = viewingUser;
    setViewingUser(null);
    handleResendInvitationClick(targetUser);
  }

  function handleCloseModal() {
    if (submitLoading) return;

    setModalMode(null);
    setEditingUser(null);
    setServerErrors({});
  }

  async function handleModalSubmit(values: UserFormValues) {
    if (modalMode === "edit" && editingUser && isProtectedSuperAdminSelf(editingUser)) {
      setError("No puedes editar tu propio usuario siendo superadmin");
      return;
    }

    setSubmitLoading(true);
    setError("");
    setSuccess("");
    setServerErrors({});

    try {
      if (modalMode === "edit" && editingUser) {
        const response = await usersService.updateUser(editingUser.id, values);
        setSuccess(response.message || "Usuario actualizado correctamente");
      } else {
        const response = await usersService.createUser(values);
        setSuccess(response.message || "Usuario creado e invitado correctamente");
      }

      setModalMode(null);
      setEditingUser(null);
      await loadUsers(query);
    } catch (err) {
      const nextFieldErrors = getUserFieldErrors(err);
      setServerErrors(nextFieldErrors);

      if (Object.keys(nextFieldErrors).length === 0) {
        setError(getErrorMessage(err, "No se pudo guardar el usuario"));
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-(--color-bg) px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {success && (
          <FeedbackMessage
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {error && (
          <FeedbackMessage
            type="error"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <section className="space-y-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-(--color-text-main)">
                Gestión de Usuarios
              </h1>
              <p className="text-xs text-(--color-text-secondary) sm:text-xs">
                Administra cuentas de administración del sistema
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-(--color-red-button) px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-(--color-red-button)/30 transition hover:bg-(--color-red-dark) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-red-main) focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Crear e invitar usuario
            </button>
          </header>

          <div>
            <UserFilters
              values={filtersForm}
              campusOptions={campusOptions}
              isSuperAdmin={isSuperAdmin}
              searchOptions={searchSuggestions}
              onFieldChange={handleFilterFieldChange}
              onClear={handleClearFilters}
            />
          </div>

          <div>
            {loading ? (
              <LoadingState message="Cargando usuarios..." />
            ) : items.length === 0 ? (
              <EmptyState
                title="No hay usuarios"
                description="No se encontraron usuarios con los filtros actuales."
              />
            ) : (
              <div className="space-y-4">
                <UserTable
                  items={items}
                  onView={handleOpenViewDrawer}
                  onEdit={handleOpenEditModal}
                  onDelete={handleDeleteClick}
                  onToggleStatus={handleToggleStatusClick}
                  onResendInvitation={handleResendInvitationClick}
                  currentUserId={authUser?.id ?? null}
                  isCurrentUserSuperAdmin={isSuperAdmin}
                />

                <Pagination
                  currentPage={meta.currentPage}
                  totalPages={meta.totalPages}
                  totalItems={meta.totalItems}
                  pageSize={meta.pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            )}
          </div>
        </section>

        <ConfirmDialog
          isOpen={Boolean(confirmState)}
          title={
            confirmState?.type === "delete"
              ? "Confirmar eliminación"
              : confirmState?.type === "resend-invitation"
                ? "Confirmar reenvío"
                : "Confirmar cambio de estado"
          }
          message={
            confirmState?.type === "delete"
              ? `¿Deseas eliminar el usuario "${confirmState.user.name}"?`
              : confirmState?.type === "resend-invitation"
                ? `¿Deseas reenviar la invitación de "${confirmState.user.name}"?`
                : `¿Deseas ${confirmState?.nextStatus === "active" ? "activar" : "desactivar"} al usuario "${confirmState?.user.name}"?`
          }
          confirmLabel={
            confirmState?.type === "delete"
              ? "Sí, eliminar"
              : confirmState?.type === "resend-invitation"
                ? "Sí, reenviar"
                : confirmState?.nextStatus === "active"
                  ? "Sí, activar"
                  : "Sí, desactivar"
          }
          loading={actionLoading}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmAction}
        />

        <FormModal
          isOpen={modalMode === "create" || modalMode === "edit"}
          title={modalMode === "edit" ? "Editar Usuario" : "Crear e invitar usuario"}
          description={
            modalMode === "edit"
              ? "Actualiza los datos del usuario."
              : "Completa los datos para crear el usuario y enviar su acceso por correo."
          }
          onClose={handleCloseModal}
          maxWidthClassName="max-w-3xl"
          disableClose={submitLoading}
        >
          <UserForm
            key={editingUser ? `edit-user-${editingUser.id}` : "create-user"}
            campusOptions={campusOptions}
            initialValues={
              editingUser
                ? {
                  name: editingUser.name,
                  email: editingUser.email,
                  role: editingUser.role,
                  status: editingUser.status,
                  campusId: String(editingUser.campusId),
                }
                : undefined
            }
            submitLabel={
              modalMode === "edit"
                ? "Guardar Cambios"
                : "Crear usuario y enviar acceso"
            }
            submitting={submitLoading}
            isEditing={modalMode === "edit"}
            serverErrors={serverErrors}
            onSubmit={handleModalSubmit}
          />
        </FormModal>

        <SideDrawer
          isOpen={Boolean(viewingUser)}
          title="Detalle de Usuario"
          description="Consulta el perfil completo del usuario seleccionado."
          onClose={handleCloseViewDrawer}
          widthClassName="max-w-4xl"
        >
          {viewingUser && (
            <UserDetailPanel
              user={viewingUser}
              onEdit={handleEditFromDrawer}
              onResendInvitation={handleResendFromDrawer}
              canEdit={!isProtectedSuperAdminSelf(viewingUser)}
              editDisabledReason="No puedes editar tu propio usuario siendo superadmin"
              canResendInvitation={!isProtectedSuperAdminSelf(viewingUser)}
              resendDisabledReason="No puedes reenviarte invitaciones siendo superadmin"
            />
          )}
        </SideDrawer>
      </div>
    </main>
  );
}
