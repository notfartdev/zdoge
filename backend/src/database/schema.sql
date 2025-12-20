-- Dogenado Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ Pools Table ============
CREATE TABLE IF NOT EXISTS pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) UNIQUE NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    denomination NUMERIC(78, 0) NOT NULL,
    last_sync_block BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pools_address ON pools(address);
CREATE INDEX idx_pools_token ON pools(token_address);

-- ============ Deposits Table ============
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) NOT NULL,
    commitment VARCHAR(66) NOT NULL,
    leaf_index INTEGER NOT NULL,
    depositor_address VARCHAR(42),
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_withdrawn BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pool_address, commitment),
    UNIQUE(pool_address, leaf_index)
);

CREATE INDEX idx_deposits_pool ON deposits(pool_address);
CREATE INDEX idx_deposits_depositor ON deposits(depositor_address);
CREATE INDEX idx_deposits_commitment ON deposits(commitment);
CREATE INDEX idx_deposits_timestamp ON deposits(timestamp DESC);
CREATE INDEX idx_deposits_withdrawn ON deposits(is_withdrawn);

-- ============ Nullifiers Table ============
CREATE TABLE IF NOT EXISTS nullifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) NOT NULL,
    nullifier_hash VARCHAR(66) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pool_address, nullifier_hash)
);

CREATE INDEX idx_nullifiers_pool ON nullifiers(pool_address);
CREATE INDEX idx_nullifiers_hash ON nullifiers(nullifier_hash);

-- ============ Scheduled Withdrawals Table ============
CREATE TABLE IF NOT EXISTS scheduled_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) NOT NULL,
    nullifier_hash VARCHAR(66) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    relayer VARCHAR(42) NOT NULL,
    fee NUMERIC(78, 0) NOT NULL,
    unlock_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, ready, executed, expired
    scheduled_tx_hash VARCHAR(66),
    executed_tx_hash VARCHAR(66),
    depositor_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pool_address, nullifier_hash)
);

CREATE INDEX idx_scheduled_pool ON scheduled_withdrawals(pool_address);
CREATE INDEX idx_scheduled_recipient ON scheduled_withdrawals(recipient);
CREATE INDEX idx_scheduled_status ON scheduled_withdrawals(status);
CREATE INDEX idx_scheduled_unlock ON scheduled_withdrawals(unlock_time);

-- ============ Withdrawals Table ============
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) NOT NULL,
    nullifier_hash VARCHAR(66) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    relayer VARCHAR(42) NOT NULL,
    fee NUMERIC(78, 0) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pool_address, nullifier_hash)
);

CREATE INDEX idx_withdrawals_pool ON withdrawals(pool_address);
CREATE INDEX idx_withdrawals_recipient ON withdrawals(recipient);
CREATE INDEX idx_withdrawals_nullifier ON withdrawals(nullifier_hash);
CREATE INDEX idx_withdrawals_timestamp ON withdrawals(timestamp DESC);

-- ============ Merkle Tree Nodes Table ============
-- Stores Merkle tree state for faster reconstruction
CREATE TABLE IF NOT EXISTS merkle_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) NOT NULL,
    level INTEGER NOT NULL,
    index INTEGER NOT NULL,
    hash VARCHAR(66) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pool_address, level, index)
);

CREATE INDEX idx_merkle_pool_level ON merkle_nodes(pool_address, level);

-- ============ Merkle Roots History Table ============
CREATE TABLE IF NOT EXISTS merkle_roots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) NOT NULL,
    root VARCHAR(66) NOT NULL,
    leaf_count INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pool_address, root)
);

CREATE INDEX idx_roots_pool ON merkle_roots(pool_address);
CREATE INDEX idx_roots_root ON merkle_roots(root);

-- ============ Transaction Log Table ============
-- For monitoring and debugging
CREATE TABLE IF NOT EXISTS transaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_type VARCHAR(20) NOT NULL, -- relay, schedule, execute
    pool_address VARCHAR(42),
    tx_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL, -- pending, success, failed
    error_code VARCHAR(10),
    error_message TEXT,
    gas_used BIGINT,
    gas_price NUMERIC(78, 0),
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tx_logs_type ON transaction_logs(tx_type);
CREATE INDEX idx_tx_logs_status ON transaction_logs(status);
CREATE INDEX idx_tx_logs_created ON transaction_logs(created_at DESC);

-- ============ Sync State Table ============
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(42) UNIQUE NOT NULL,
    last_deposit_block BIGINT DEFAULT 0,
    last_withdrawal_block BIGINT DEFAULT 0,
    deposits_count INTEGER DEFAULT 0,
    nullifiers_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ Helper Functions ============

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_pools_updated_at
    BEFORE UPDATE ON pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_withdrawals_updated_at
    BEFORE UPDATE ON scheduled_withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_state_updated_at
    BEFORE UPDATE ON sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ Views ============

-- Pool statistics view
CREATE OR REPLACE VIEW pool_stats AS
SELECT 
    p.address,
    p.token_symbol,
    p.denomination,
    COUNT(DISTINCT d.id) as total_deposits,
    COUNT(DISTINCT n.id) as total_withdrawals,
    COUNT(DISTINCT d.id) - COUNT(DISTINCT n.id) as active_deposits,
    p.last_sync_block
FROM pools p
LEFT JOIN deposits d ON p.address = d.pool_address
LEFT JOIN nullifiers n ON p.address = n.pool_address
GROUP BY p.address, p.token_symbol, p.denomination, p.last_sync_block;

-- Recent activity view
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    'deposit' as type,
    pool_address,
    commitment as identifier,
    depositor_address as address,
    tx_hash,
    timestamp
FROM deposits
UNION ALL
SELECT 
    'withdrawal' as type,
    pool_address,
    nullifier_hash as identifier,
    recipient as address,
    tx_hash,
    timestamp
FROM withdrawals
ORDER BY timestamp DESC
LIMIT 100;

-- ============ Comments ============
COMMENT ON TABLE pools IS 'Registered mixer pools with their configurations';
COMMENT ON TABLE deposits IS 'All deposit events indexed from the blockchain';
COMMENT ON TABLE nullifiers IS 'All spent nullifiers (withdrawn deposits)';
COMMENT ON TABLE scheduled_withdrawals IS 'Pending scheduled withdrawals for V2 pools';
COMMENT ON TABLE withdrawals IS 'Completed withdrawal transactions';
COMMENT ON TABLE merkle_nodes IS 'Cached Merkle tree state for fast reconstruction';
COMMENT ON TABLE merkle_roots IS 'Historical Merkle roots for proof verification';
COMMENT ON TABLE transaction_logs IS 'Relayer transaction logs for monitoring';
COMMENT ON TABLE sync_state IS 'Blockchain sync progress per pool';

