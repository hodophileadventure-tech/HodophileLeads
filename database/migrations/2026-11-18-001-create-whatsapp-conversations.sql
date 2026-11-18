CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY,
  lead_id UUID UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  phone_number VARCHAR(32) NOT NULL,
  wa_phone_number_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(255) UNIQUE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(30) NOT NULL DEFAULT 'text',
  message_text TEXT,
  media_id VARCHAR(255),
  media_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'received',
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone
  ON whatsapp_conversations (phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation
  ON whatsapp_messages (conversation_id, timestamp);
