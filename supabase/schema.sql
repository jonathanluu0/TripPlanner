-- Postgres schema for Group Trip Planner (Supabase)
-- All money stored as bigint cents; enable RLS for all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Helper Function: Check if user is a member of a trip
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = is_trip_member.trip_id
      AND (trip_members.user_id = auth.uid() OR auth.uid() IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trips
-- ============================================================================
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  destination text,
  start_date date,
  end_date date,
  invite_code text NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read trips they are members of"
  ON public.trips FOR SELECT
  USING (is_trip_member(id));

CREATE POLICY "Users can update trips they are members of"
  ON public.trips FOR UPDATE
  USING (is_trip_member(id));

CREATE POLICY "Creators can delete trips"
  ON public.trips FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================================
-- Trip Members (linked to users via user_id, initially nullable for placeholders)
-- ============================================================================
CREATE TABLE public.trip_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  color text NOT NULL, -- hex color, e.g. #FF6B6B
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id) -- prevent duplicate user links per trip
);

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read trip members"
  ON public.trip_members FOR SELECT
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can create/update members"
  ON public.trip_members FOR INSERT
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY "Members can update members"
  ON public.trip_members FOR UPDATE
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can delete members"
  ON public.trip_members FOR DELETE
  USING (is_trip_member(trip_id));

-- ============================================================================
-- Cars
-- ============================================================================
CREATE TABLE public.cars (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Car',
  seats integer NOT NULL DEFAULT 4,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read cars"
  ON public.cars FOR SELECT
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can insert/update cars"
  ON public.cars FOR INSERT
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY "Members can update cars"
  ON public.cars FOR UPDATE
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can delete cars"
  ON public.cars FOR DELETE
  USING (is_trip_member(trip_id));

-- ============================================================================
-- Car Assignments (driver or passenger role)
-- ============================================================================
CREATE TYPE car_role AS ENUM ('driver', 'passenger');

CREATE TABLE public.car_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  role car_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(member_id, car_id) -- a member can only be assigned once per car
);

ALTER TABLE public.car_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read assignments"
  ON public.car_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE cars.id = car_assignments.car_id AND is_trip_member(cars.trip_id)
    )
  );

CREATE POLICY "Members can manage assignments"
  ON public.car_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE cars.id = car_assignments.car_id AND is_trip_member(cars.trip_id)
    )
  );

CREATE POLICY "Members can update assignments"
  ON public.car_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE cars.id = car_assignments.car_id AND is_trip_member(cars.trip_id)
    )
  );

CREATE POLICY "Members can delete assignments"
  ON public.car_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cars
      WHERE cars.id = car_assignments.car_id AND is_trip_member(cars.trip_id)
    )
  );

-- ============================================================================
-- Sleeping Spots
-- ============================================================================
CREATE TYPE sleeping_kind AS ENUM ('Bedroom', 'Couch', 'Airbed', 'Other');

CREATE TABLE public.sleeping_spots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind sleeping_kind NOT NULL,
  label text NOT NULL DEFAULT 'Room',
  capacity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sleeping_spots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read sleeping spots"
  ON public.sleeping_spots FOR SELECT
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can insert spots"
  ON public.sleeping_spots FOR INSERT
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY "Members can update spots"
  ON public.sleeping_spots FOR UPDATE
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can delete spots"
  ON public.sleeping_spots FOR DELETE
  USING (is_trip_member(trip_id));

-- ============================================================================
-- Spot Assignments
-- ============================================================================
CREATE TABLE public.spot_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  spot_id uuid NOT NULL REFERENCES public.sleeping_spots(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(member_id, spot_id)
);

ALTER TABLE public.spot_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read assignments"
  ON public.spot_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sleeping_spots
      WHERE sleeping_spots.id = spot_assignments.spot_id AND is_trip_member(sleeping_spots.trip_id)
    )
  );

CREATE POLICY "Members can manage assignments"
  ON public.spot_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sleeping_spots
      WHERE sleeping_spots.id = spot_assignments.spot_id AND is_trip_member(sleeping_spots.trip_id)
    )
  );

CREATE POLICY "Members can update assignments"
  ON public.spot_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sleeping_spots
      WHERE sleeping_spots.id = spot_assignments.spot_id AND is_trip_member(sleeping_spots.trip_id)
    )
  );

CREATE POLICY "Members can delete assignments"
  ON public.spot_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sleeping_spots
      WHERE sleeping_spots.id = spot_assignments.spot_id AND is_trip_member(sleeping_spots.trip_id)
    )
  );

-- ============================================================================
-- Receipts (status: parsing, needs_review, confirmed; amounts in cents)
-- ============================================================================
CREATE TYPE receipt_status AS ENUM ('parsing', 'needs_review', 'confirmed');
CREATE TYPE receipt_parser AS ENUM ('tesseract', 'claude', 'manual');

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  merchant text NOT NULL,
  date date,
  image_url text, -- Supabase Storage signed URL
  tax bigint NOT NULL DEFAULT 0, -- cents
  tip bigint NOT NULL DEFAULT 0, -- cents
  total bigint NOT NULL, -- cents (printed total)
  paid_by uuid REFERENCES public.trip_members(id) ON DELETE SET NULL,
  split_mode text NOT NULL DEFAULT 'even',
  split_count integer NOT NULL DEFAULT 1,
  status receipt_status NOT NULL DEFAULT 'parsing',
  parser receipt_parser,
  confidence real, -- 0..1
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read receipts"
  ON public.receipts FOR SELECT
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can create receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY "Members can update receipts"
  ON public.receipts FOR UPDATE
  USING (is_trip_member(trip_id));

CREATE POLICY "Members can delete receipts"
  ON public.receipts FOR DELETE
  USING (is_trip_member(trip_id));

-- ============================================================================
-- Receipt Items (one per line item; extras is a separate table)
-- ============================================================================
CREATE TABLE public.receipt_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_price bigint NOT NULL, -- cents
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read items"
  ON public.receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can manage items"
  ON public.receipt_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can update items"
  ON public.receipt_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can delete items"
  ON public.receipt_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

-- ============================================================================
-- Item Extras (e.g., "add guac $2.50", per-item modifiers)
-- ============================================================================
CREATE TABLE public.item_extras (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id uuid NOT NULL REFERENCES public.receipt_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount bigint NOT NULL, -- cents
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.item_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read extras"
  ON public.item_extras FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipt_items
      JOIN public.receipts ON receipts.id = receipt_items.receipt_id
      WHERE receipt_items.id = item_extras.item_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can manage extras"
  ON public.item_extras FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipt_items
      JOIN public.receipts ON receipts.id = receipt_items.receipt_id
      WHERE receipt_items.id = item_extras.item_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can update extras"
  ON public.item_extras FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipt_items
      JOIN public.receipts ON receipts.id = receipt_items.receipt_id
      WHERE receipt_items.id = item_extras.item_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can delete extras"
  ON public.item_extras FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipt_items
      JOIN public.receipts ON receipts.id = receipt_items.receipt_id
      WHERE receipt_items.id = item_extras.item_id AND is_trip_member(receipts.trip_id)
    )
  );

-- ============================================================================
-- Receipt Fees (service fee, delivery, resort fee, etc.)
-- ============================================================================
CREATE TABLE public.receipt_fees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount bigint NOT NULL, -- cents
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read fees"
  ON public.receipt_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_fees.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can manage fees"
  ON public.receipt_fees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_fees.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can update fees"
  ON public.receipt_fees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_fees.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can delete fees"
  ON public.receipt_fees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_fees.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

-- ============================================================================
-- Receipt Split Participants (who is included in the split)
-- ============================================================================
CREATE TABLE public.receipt_split_participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(receipt_id, member_id)
);

ALTER TABLE public.receipt_split_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read participants"
  ON public.receipt_split_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_split_participants.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can manage participants"
  ON public.receipt_split_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_split_participants.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

CREATE POLICY "Members can delete participants"
  ON public.receipt_split_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_split_participants.receipt_id AND is_trip_member(receipts.trip_id)
    )
  );

-- ============================================================================
-- Security Definers: Public RPC functions
-- ============================================================================

-- join_trip: Public endpoint for joining a trip via invite code
-- Params:
--   code: invite code (public lookup)
--   display_name: name to display in trip
--   claim_member_id: (optional) existing placeholder member to claim
-- Returns: trip id
CREATE OR REPLACE FUNCTION public.join_trip(
  code text,
  display_name text,
  claim_member_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
  v_member_id uuid;
BEGIN
  -- Find trip by invite code
  SELECT id INTO v_trip_id FROM public.trips WHERE invite_code = code;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- If claiming an existing placeholder member
  IF claim_member_id IS NOT NULL THEN
    UPDATE public.trip_members
    SET user_id = auth.uid(), name = display_name
    WHERE id = claim_member_id AND trip_id = v_trip_id;
  ELSE
    -- Create a new member
    INSERT INTO public.trip_members (trip_id, user_id, name, color)
    VALUES (
      v_trip_id,
      auth.uid(),
      display_name,
      -- Generate a stable color from user_id hash (simple: use first 6 chars of hash)
      '#' || substr(md5(auth.uid()::text), 1, 6)
    )
    RETURNING id INTO v_member_id;
  END IF;

  RETURN v_trip_id;
END;
$$;

-- ============================================================================
-- Storage Bucket Note
-- ============================================================================
-- Create a storage bucket for receipt images:
--   supabase storage create-bucket receipts --public=false
--
-- Path convention: receipts/{trip_id}/{receipt_id}.jpg
--
-- RLS policy (via Supabase dashboard or SQL):
--   CREATE POLICY "Members can read own trip receipts"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'receipts'
--     AND auth.uid() IN (
--       SELECT user_id FROM trip_members
--       WHERE trip_id = (storage.foldername(name))[1]::uuid
--     )
--   );
-- ============================================================================
