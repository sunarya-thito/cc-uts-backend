import { db } from "../db"

// Interface for migration
interface Migration {
    id: number
    name: string
    up: string
    down: string
}

// List of migrations
export const migrations: Migration[] = [
    {
        id: 1,
        name: "create_migrations_table",
        up: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
        down: `
      DROP TABLE IF EXISTS migrations
    `,
    },
    {
        id: 2,
        name: "create_products_table",
        up: `
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_key VARCHAR(512),
        date_added TIMESTAMP NOT NULL DEFAULT NOW(),
        date_updated TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_products_date_added ON products(date_added);
    `,
        down: `
      DROP TABLE IF EXISTS products
    `,
    },
]

// Function to get applied migrations
async function getAppliedMigrations(): Promise<number[]> {
    try {
        // Check if migrations table exists
        const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      )
    `)

        if (!tableCheck.rows[0].exists) {
            return []
        }

        // Get applied migrations
        const result = await db.query("SELECT migration_id FROM migrations ORDER BY migration_id")
        return result.rows.map((row) => row.migration_id)
    } catch (error) {
        console.error("Error checking applied migrations:", error)
        return []
    }
}

// Function to apply a migration
async function applyMigration(migration: Migration): Promise<boolean> {
    const client = await db.connect()

    try {
        await client.query("BEGIN")

        // Apply the migration
        await client.query(migration.up)

        // Record the migration
        await client.query("INSERT INTO migrations (migration_id, name) VALUES ($1, $2)", [migration.id, migration.name])

        await client.query("COMMIT")
        return true
    } catch (error) {
        await client.query("ROLLBACK")
        console.error(`Error applying migration ${migration.id} (${migration.name}):`, error)
        return false
    } finally {
        client.release()
    }
}

// Function to rollback a migration
async function rollbackMigration(migration: Migration): Promise<boolean> {
    const client = await db.connect()

    try {
        await client.query("BEGIN")

        // Rollback the migration
        await client.query(migration.down)

        // Remove the migration record
        await client.query("DELETE FROM migrations WHERE migration_id = $1", [migration.id])

        await client.query("COMMIT")
        return true
    } catch (error) {
        await client.query("ROLLBACK")
        console.error(`Error rolling back migration ${migration.id} (${migration.name}):`, error)
        return false
    } finally {
        client.release()
    }
}

// Main migration function
export async function runMigrations(
    options: { up?: boolean; down?: boolean; to?: number } = { up: true },
): Promise<void> {
    try {
        console.log("Starting database migrations...")

        // Get applied migrations
        const appliedMigrationIds = await getAppliedMigrations()

        if (options.up || (!options.up && !options.down)) {
            // Apply migrations
            const pendingMigrations = migrations
                .filter((m) => !appliedMigrationIds.includes(m.id))
                .sort((a, b) => a.id - b.id)

            if (options.to) {
                // Apply migrations up to a specific ID
                const targetIndex = pendingMigrations.findIndex((m) => m.id > options.to!)
                if (targetIndex !== -1) {
                    pendingMigrations.splice(targetIndex)
                }
            }

            if (pendingMigrations.length === 0) {
                console.log("No pending migrations to apply.")
            } else {
                console.log(`Applying ${pendingMigrations.length} pending migrations...`)

                for (const migration of pendingMigrations) {
                    console.log(`Applying migration ${migration.id}: ${migration.name}...`)
                    const success = await applyMigration(migration)

                    if (!success) {
                        console.error(`Failed to apply migration ${migration.id}. Stopping.`)
                        break
                    }

                    console.log(`Successfully applied migration ${migration.id}.`)
                }
            }
        } else if (options.down) {
            // Rollback migrations
            const appliedMigrations = migrations.filter((m) => appliedMigrationIds.includes(m.id)).sort((a, b) => b.id - a.id) // Reverse order for rollback

            if (options.to) {
                // Rollback migrations down to a specific ID
                const targetIndex = appliedMigrations.findIndex((m) => m.id < options.to!)
                if (targetIndex !== -1) {
                    appliedMigrations.splice(targetIndex)
                }
            } else {
                // Rollback only the last migration by default
                if (appliedMigrations.length > 1) {
                    appliedMigrations.splice(1)
                }
            }

            if (appliedMigrations.length === 0) {
                console.log("No migrations to roll back.")
            } else {
                console.log(`Rolling back ${appliedMigrations.length} migrations...`)

                for (const migration of appliedMigrations) {
                    console.log(`Rolling back migration ${migration.id}: ${migration.name}...`)
                    const success = await rollbackMigration(migration)

                    if (!success) {
                        console.error(`Failed to roll back migration ${migration.id}. Stopping.`)
                        break
                    }

                    console.log(`Successfully rolled back migration ${migration.id}.`)
                }
            }
        }

        console.log("Migration process completed.")
    } catch (error) {
        console.error("Error running migrations:", error)
    }
}
