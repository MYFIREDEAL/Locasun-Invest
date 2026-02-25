-- ============================================================================
-- RLS Test Script
-- Description: Manual tests to verify multi-tenant isolation and workflow
-- ============================================================================

-- ============================================================================
-- SETUP: Create test organizations and users
-- ============================================================================

-- This script is meant to be run in Supabase SQL Editor with service role
-- It creates test data to verify RLS policies

-- Create two test organizations
INSERT INTO organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Organization A'),
  ('22222222-2222-2222-2222-222222222222', 'Organization B');

-- IMPORTANT: Create users via Supabase Auth UI or API first, then get their UUIDs
-- For this test, we'll assume users exist with these IDs:
-- User A1 (pro): 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- User A2 (client): 'aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbbbbbb'
-- User B1 (pro): 'bbbbbbbb-bbbb-bbbb-bbbb-aaaaaaaaaaaa'
-- User B2 (client): 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- ============================================================================
-- TEST PROFILES
-- ============================================================================

-- Create profiles for Org A
INSERT INTO profiles (user_id, org_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'pro'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'client');

-- Create profiles for Org B
INSERT INTO profiles (user_id, org_id, role) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'pro'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'client');

-- ============================================================================
-- TEST PROJECTS
-- ============================================================================

-- Org A: PRO_SERVICE project (draft)
INSERT INTO projects (id, org_id, name, mode, status, created_by_role, owner_user_id) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 
   'Project A1 - PRO Service Draft', 'PRO_SERVICE', 'draft', 'pro', 
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Org A: CLIENT_SELF_SERVICE project (draft, owned by client)
INSERT INTO projects (id, org_id, name, mode, status, created_by_role, owner_user_id) VALUES
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Project A2 - Client Self Service Draft', 'CLIENT_SELF_SERVICE', 'draft', 'client',
   'aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbbbbbb');

-- Org A: CLIENT_SELF_SERVICE project (submitted)
INSERT INTO projects (id, org_id, name, mode, status, created_by_role, owner_user_id) VALUES
  ('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Project A3 - Client Self Service Submitted', 'CLIENT_SELF_SERVICE', 'submitted', 'client',
   'aaaaaaaa-aaaa-aaaa-aaaa-bbbbbbbbbbbb');

-- Org B: PRO_SERVICE project (draft)
INSERT INTO projects (id, org_id, name, mode, status, created_by_role, owner_user_id) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Project B1 - PRO Service Draft', 'PRO_SERVICE', 'draft', 'pro',
   'bbbbbbbb-bbbb-bbbb-bbbb-aaaaaaaaaaaa');

-- Org B: CLIENT_SELF_SERVICE project (returned to client)
INSERT INTO projects (id, org_id, name, mode, status, created_by_role, owner_user_id) VALUES
  ('bbbb0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Project B2 - Client Self Service Returned', 'CLIENT_SELF_SERVICE', 'returned', 'client',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ============================================================================
-- MANUAL TEST SCENARIOS
-- ============================================================================

/*
TEST 1: Multi-tenant Isolation
-------------------------------
Execute these queries as User A1 (pro from Org A):

-- Should see 3 projects from Org A only
SELECT id, name, org_id FROM projects;

-- Should NOT see projects from Org B
-- Expected: 3 rows

Execute as User B1 (pro from Org B):
-- Should see 2 projects from Org B only
SELECT id, name, org_id FROM projects;
-- Expected: 2 rows

PASS CRITERIA: Users only see projects from their organization


TEST 2: Client Cannot Edit After Submission
--------------------------------------------
Execute as User A2 (client from Org A):

-- Should be able to update draft project
UPDATE projects 
SET name = 'Updated by Client A2'
WHERE id = 'aaaa0002-0000-0000-0000-000000000002';
-- Expected: SUCCESS (status = draft, owner = A2)

-- Should NOT be able to update submitted project
UPDATE projects
SET name = 'Trying to update submitted'
WHERE id = 'aaaa0003-0000-0000-0000-000000000003';
-- Expected: FAIL (status = submitted, no elevated role)

PASS CRITERIA: Client can update draft, cannot update submitted


TEST 3: Pro Can Edit PRO_SERVICE in Draft
------------------------------------------
Execute as User A1 (pro from Org A):

-- Should be able to update PRO_SERVICE draft
UPDATE projects
SET name = 'Updated by Pro A1'
WHERE id = 'aaaa0001-0000-0000-0000-000000000001';
-- Expected: SUCCESS (mode = PRO_SERVICE, status = draft, is_elevated = true)

PASS CRITERIA: Pro can edit PRO_SERVICE projects in draft


TEST 4: Pro Can Update Decision Fields When Submitted
------------------------------------------------------
Execute as User A1 (pro from Org A):

-- Should be able to update decision fields on submitted project
UPDATE projects
SET status = 'accepted',
    decision_reason_code = 'APPROVED',
    decision_comment = 'Project looks good',
    decided_by_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    decided_at = NOW()
WHERE id = 'aaaa0003-0000-0000-0000-000000000003';
-- Expected: SUCCESS (status was submitted, is_elevated = true)

PASS CRITERIA: Pro can update decision fields on submitted projects


TEST 5: Client Can Edit Returned Project
-----------------------------------------
Execute as User B2 (client from Org B):

-- Should be able to update returned project
UPDATE projects
SET name = 'Client B2 fixes returned project'
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';
-- Expected: SUCCESS (status = returned, owner = B2)

-- After updating, client submits again
UPDATE projects
SET status = 'submitted'
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';
-- Expected: SUCCESS

-- Now client should NOT be able to edit
UPDATE projects
SET name = 'Trying after resubmit'
WHERE id = 'bbbb0002-0000-0000-0000-000000000002';
-- Expected: FAIL (status = submitted)

PASS CRITERIA: Client can edit when returned, cannot edit after resubmit


TEST 6: Cross-Organization Access Denied
-----------------------------------------
Execute as User A1 (pro from Org A):

-- Should NOT be able to view Org B projects
SELECT id, name FROM projects WHERE org_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0 rows (RLS filters by user's org)

-- Should NOT be able to update Org B projects
UPDATE projects
SET name = 'Hacking Org B'
WHERE id = 'bbbb0001-0000-0000-0000-000000000001';
-- Expected: FAIL (different org_id)

PASS CRITERIA: No cross-organization access


TEST 7: Building Configs Follow Project Access
-----------------------------------------------
Execute as User A2 (client from Org A):

-- Insert config for own project
INSERT INTO building_configs (project_id, family_type, params) VALUES
  ('aaaa0002-0000-0000-0000-000000000002', 'hangar_agricole', '{"width": 20}');
-- Expected: SUCCESS (owner of project)

-- Try to insert config for Org B project
INSERT INTO building_configs (project_id, family_type, params) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', 'hangar_agricole', '{"width": 15}');
-- Expected: FAIL (different org)

PASS CRITERIA: Can only manage configs for accessible projects


TEST 8: Snapshots Access Control
---------------------------------
Execute as User A1 (pro from Org A):

-- Can create snapshot for own org project
INSERT INTO project_snapshots (project_id, snapshot, snapshot_hash) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '{"test": "data"}', 'hash123');
-- Expected: SUCCESS

-- Can view snapshots for own org
SELECT * FROM project_snapshots 
WHERE project_id = 'aaaa0001-0000-0000-0000-000000000001';
-- Expected: Shows snapshot

-- Cannot view snapshots for other org
SELECT * FROM project_snapshots
WHERE project_id = 'bbbb0001-0000-0000-0000-000000000001';
-- Expected: 0 rows

PASS CRITERIA: Snapshots isolated by organization
*/

-- ============================================================================
-- CLEANUP (run after tests)
-- ============================================================================

/*
DELETE FROM project_snapshots WHERE project_id LIKE 'aaaa%' OR project_id LIKE 'bbbb%';
DELETE FROM building_configs WHERE project_id LIKE 'aaaa%' OR project_id LIKE 'bbbb%';
DELETE FROM projects WHERE id LIKE 'aaaa%' OR id LIKE 'bbbb%';
DELETE FROM profiles WHERE org_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM organizations WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
*/
