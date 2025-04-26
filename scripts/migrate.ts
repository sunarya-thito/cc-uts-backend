import { runMigrations } from "../lib/migrations/migration"

async function main() {
    const args = process.argv.slice(2)
    const options: { up?: boolean; down?: boolean; to?: number } = {}

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        if (arg === "--up") {
            options.up = true
        } else if (arg === "--down") {
            options.down = true
        } else if (arg === "--to" && i + 1 < args.length) {
            options.to = Number.parseInt(args[i + 1], 10)
            i++
        }
    }

    // Run migrations
    await runMigrations(options)

    // Exit the process
    process.exit(0)
}

main().catch((error) => {
    console.error("Migration script failed:", error)
    process.exit(1)
})
