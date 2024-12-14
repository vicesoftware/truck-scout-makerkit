-- Create timestamp trigger function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_carriers_timestamp ON carriers;

-- Create trigger for carriers table
CREATE TRIGGER update_carriers_timestamp
    BEFORE UPDATE ON carriers
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
