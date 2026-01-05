-- Manual Database Migration for Transaction History Sync
-- Run this SQL directly on your Render PostgreSQL database
-- 
-- Options to connect:
-- 1. Render Dashboard → Your Database → "Connect" tab → Copy connection string
-- 2. Use psql, pgAdmin, DBeaver, or any PostgreSQL client
-- 3. Use Render's database query interface (if available)

-- ============ Shielded Transactions Table ============
CREATE TABLE IF NOT EXISTS shielded_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL,
    tx_id VARCHAR(128) NOT NULL, -- txHash-type combination for uniqueness
    tx_type VARCHAR(20) NOT NULL, -- shield, transfer, swap, unshield
    tx_hash VARCHAR(66) NOT NULL,
    timestamp BIGINT NOT NULL, -- Unix timestamp in seconds
    token VARCHAR(20) NOT NULL, -- Token symbol
    amount TEXT NOT NULL, -- Amount as string
    amount_wei TEXT NOT NULL, -- Amount in wei as string
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
    block_number INTEGER,
    transaction_data JSONB, -- Flexible fields (commitment, recipientAddress, fee, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(wallet_address, tx_id)
);

-- ============ Indexes for Performance ============
CREATE INDEX IF NOT EXISTS idx_shielded_tx_wallet ON shielded_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_shielded_tx_type ON shielded_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_shielded_tx_timestamp ON shielded_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shielded_tx_status ON shielded_transactions(status);
CREATE INDEX IF NOT EXISTS idx_shielded_tx_hash ON shielded_transactions(tx_hash);

-- ============ Trigger for updated_at ============
-- (Only needed if update_updated_at_column() function doesn't exist)
CREATE TRIGGER update_shielded_transactions_updated_at
    BEFORE UPDATE ON shielded_transactions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============ Table Comment ============
COMMENT ON TABLE shielded_transactions IS 'User transaction history for shielded operations (shield, transfer, swap, unshield)';

-- ============ Verify Creation ============
-- Run this to verify the table was created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shielded_transactions';

