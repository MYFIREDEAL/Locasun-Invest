# Supabase Schema Documentation

## Overview
Multi-tenant database schema with Row Level Security (RLS) and workflow-based access control for HANGAR3D project management.

## Key Features
- **Multi-tenant isolation**: Complete data separation by organization
- **Role-based access**: admin, pro, partner, client
- **Workflow states**: draft → submitted → accepted/rejected/returned
- **PostGIS enabled**: Geographic data for building implantations
- **Comprehensive RLS**: All tables protected with granular policies

## Tables

### Core Tables

#### `organizations`
Multi-tenant organizations.
- `id` (UUID, PK)
- `name` (TEXT)
- `created_at` (TIMESTAMPTZ)

#### `profiles`
User profiles with organization membership.
- `user_id` (UUID, PK, FK → auth.users)
- `org_id` (UUID, FK → organizations)
- `role` (TEXT): 'admin' | 'pro' | 'partner' | 'client'
- `created_at` (TIMESTAMPTZ)

#### `projects`
Projects with workflow status and access control.
- `id` (UUID, PK)
- `org_id` (UUID, FK → organizations)
- `name` (TEXT)
- `mode` (TEXT): 'PRO_SERVICE' | 'CLIENT_SELF_SERVICE'
- `status` (TEXT): 'draft' | 'submitted' | 'accepted' | 'rejected' | 'returned'
- `created_by_role` (TEXT): 'pro' | 'client'
- `owner_user_id` (UUID, FK → auth.users)
- `assigned_to_org_id` (UUID, FK → organizations, nullable)
- `decision_reason_code` (TEXT, nullable)
- `decision_comment` (TEXT, nullable)
- `decided_by_user_id` (UUID, FK → auth.users, nullable)
- `decided_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ, auto-updated)

### Configuration Tables

#### `building_rulesets`
Building configuration rulesets (org-specific or global).
- `id` (UUID, PK)
- `org_id` (UUID, FK → organizations, nullable for global)
- `version` (INT)
- `name` (TEXT)
- `json` (JSONB)
- `active` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

#### `building_configs`
Building configurations per project.
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects)
- `family_type` (TEXT)
- `params` (JSONB)
- `derived` (JSONB)
- `version` (INT)
- `created_at` (TIMESTAMPTZ)

### Geographic Tables

#### `implantations`
Geographic implantation data (PostGIS).
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects)
- `polygon` (GEOGRAPHY POLYGON)
- `centroid` (GEOGRAPHY POINT)
- `azimuth_building_deg` (NUMERIC, 0-360)
- `azimuth_pan_a_deg` (NUMERIC, 0-360)
- `azimuth_pan_b_deg` (NUMERIC, 0-360)
- `created_at` (TIMESTAMPTZ)

### External API Tables

#### `pvgis_results`
PVGIS API results cache.
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects)
- `inputs` (JSONB)
- `annual` (JSONB)
- `monthly` (JSONB)
- `raw` (JSONB)
- `created_at` (TIMESTAMPTZ)

#### `enedis_context`
Enedis network context data.
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects)
- `nearest` (JSONB)
- `created_at` (TIMESTAMPTZ)

### Integration Tables

#### `integrations`
Third-party integration configurations.
- `id` (UUID, PK)
- `org_id` (UUID, FK → organizations)
- `type` (TEXT)
- `config` (JSONB)
- `enabled` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

#### `integration_runs`
Integration execution logs.
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects)
- `integration_id` (UUID, FK → integrations)
- `status` (TEXT): 'pending' | 'running' | 'success' | 'failed'
- `last_error` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

#### `project_snapshots`
Project state snapshots for versioning.
- `id` (UUID, PK)
- `project_id` (UUID, FK → projects)
- `snapshot` (JSONB)
- `snapshot_hash` (TEXT)
- `created_at` (TIMESTAMPTZ)

## RLS Policies

### Helper Functions
- `auth.user_org_id()`: Returns current user's organization ID
- `auth.user_role()`: Returns current user's role
- `auth.user_is_elevated()`: Checks if user is admin/pro/partner

### Access Rules

#### Organizations
- Users can view their own organization only
- Only admins can manage organizations

#### Profiles
- Users can view profiles in their organization
- Only admins can manage profiles

#### Projects (Complex Workflow)

**SELECT**: Users can view all projects in their organization

**INSERT**: Users can create projects in their organization (become owner)

**UPDATE**: Depends on mode, status, and role:
- **PRO_SERVICE + draft**: Elevated users (admin/pro/partner) can edit
- **CLIENT_SELF_SERVICE + draft/returned**: Owner can edit
- **submitted/accepted/rejected**: Elevated users can update decision fields only

**DELETE**: Only admins can delete projects

#### Related Tables
All tables linked to projects (building_configs, implantations, pvgis_results, etc.) inherit access based on project ownership and user role.

## Workflow States

```
draft → submitted → accepted
                 ↘ rejected
                 ↘ returned → (back to draft-like editing)
```

### State Transitions
- **draft**: Editable by owner (CLIENT_SELF_SERVICE) or elevated users (PRO_SERVICE)
- **submitted**: Read-only for owner, elevated users can accept/reject/return
- **accepted/rejected**: Final states, read-only except decision fields
- **returned**: Back to editable state for owner

## Migrations

### Files
1. `20260125000000_initial_schema.sql`: Core tables, indexes, triggers
2. `20260125000001_rls_policies.sql`: RLS policies and helper functions
3. `20260125000002_rls_tests.sql`: Manual test scenarios

### Applying Migrations
```sql
-- Run in Supabase SQL Editor or via Supabase CLI
-- Migrations are numbered and should be applied in order
```

## Testing RLS

See `20260125000002_rls_tests.sql` for comprehensive test scenarios covering:
- Multi-tenant isolation
- Workflow state transitions
- Role-based permissions
- Cross-organization access prevention
- Related table access control

## Notes

- All timestamps use TIMESTAMPTZ (timezone-aware)
- UUIDs generated via `uuid_generate_v4()`
- PostGIS required for geographic data
- RLS enabled on ALL tables
- Service role bypasses RLS (use carefully)
