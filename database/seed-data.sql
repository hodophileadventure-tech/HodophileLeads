-- Seed Users
INSERT INTO users (email, name, password, role) VALUES
  ('admin@tripnexus.com', 'Admin User', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/PFm', 'admin'),
  ('agent@tripnexus.com', 'John Agent', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/PFm', 'agent'),
  ('sarah@tripnexus.com', 'Sarah Agent', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/PFm', 'agent')
ON CONFLICT DO NOTHING;

-- Get agent ID for leads
WITH agent_data AS (
  SELECT id FROM users WHERE email = 'agent@tripnexus.com' LIMIT 1
)

-- Seed Sample Leads
INSERT INTO leads (client_name, email, phone, destination, travel_dates, persons, budget, source, temperature, status, agent_id, special_requests)
SELECT
  'Ahmed Khan',
  'ahmed@email.com',
  '+92-300-1234567',
  'Dubai, UAE',
  '{"from": "2024-06-15", "to": "2024-06-22"}',
  4,
  2500.00,
  'referral',
  'hot',
  'negotiation',
  id,
  'Luxury resort, English-speaking guide'
FROM agent_data
UNION ALL
SELECT
  'Fatima Ali',
  'fatima@email.com',
  '+92-321-9876543',
  'Turkey - Istanbul',
  '{"from": "2024-07-01", "to": "2024-07-10"}',
  2,
  1800.00,
  'organic',
  'warm',
  'contacted',
  id,
  'Budget accommodation, historical tours'
FROM agent_data
UNION ALL
SELECT
  'Hassan Malik',
  'hassan@email.com',
  '+92-333-5555555',
  'Malaysia - KL & Langkawi',
  '{"from": "2024-08-10", "to": "2024-08-18"}',
  5,
  3200.00,
  'paid_ad',
  'warm',
  'interested',
  id,
  'Family-friendly activities'
FROM agent_data
UNION ALL
SELECT
  'Aisha Patel',
  'aisha@email.com',
  '+92-345-1234567',
  'Thailand - Bangkok & Phuket',
  '{"from": "2024-09-01", "to": "2024-09-10"}',
  3,
  2000.00,
  'direct',
  'cold',
  'new',
  id,
  'Spa packages, beach resorts'
FROM agent_data
UNION ALL
SELECT
  'Bilal Ahmed',
  'bilal@email.com',
  '+92-310-8765432',
  'Singapore',
  '{"from": "2024-10-15", "to": "2024-10-20"}',
  1,
  1200.00,
  'repeat_client',
  'hot',
  'booked',
  id,
  'Business trip, luxury hotel'
FROM agent_data;

-- Seed Availability (Triple-Lock)
WITH lead_data AS (
  SELECT id FROM leads WHERE client_name IN ('Ahmed Khan', 'Bilal Ahmed') LIMIT 2
)
INSERT INTO availability (lead_id, hotel_confirmed, transport_confirmed, guide_confirmed)
SELECT id, TRUE, TRUE, TRUE FROM lead_data;

-- Seed Payments
WITH lead_data AS (
  SELECT id FROM leads WHERE status = 'booked' LIMIT 1
)
INSERT INTO payments (lead_id, amount, status, method, due_date)
SELECT id, 1200.00, 'confirmed', 'card', NOW() - INTERVAL '5 days' FROM lead_data;

-- Seed Follow-ups
WITH agent_data AS (
  SELECT id FROM users WHERE email = 'agent@tripnexus.com' LIMIT 1
),
lead_data AS (
  SELECT id FROM leads LIMIT 5
)
INSERT INTO follow_ups (lead_id, type, title, description, due_date, status, priority, assigned_to)
SELECT
  lead_data.id,
  'manual',
  'Follow-up Call',
  'Check if client is ready to book',
  NOW() + INTERVAL '2 days',
  'upcoming',
  'high',
  agent_data.id
FROM lead_data, agent_data;

-- Seed Client Profiles
INSERT INTO client_profiles (user_email, loyalty_tier, total_trips, preferred_destinations)
VALUES
  ('ahmed@email.com', 'gold', 3, 'UAE, Egypt, Saudi Arabia'),
  ('fatima@email.com', 'silver', 1, 'Turkey, Greece, Cyprus'),
  ('bilal@email.com', 'platinum', 8, 'Singapore, Malaysia, Thailand');
