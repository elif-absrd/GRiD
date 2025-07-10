# MongoDB to PostgreSQL Migration Summary

## Overview

This project has been migrated from MongoDB to PostgreSQL. The migration includes:

1. New Sequelize models for all entities:
   - User
   - Task
   - Submission
   - ShopItem
   - SharedToken

2. Updated route handlers for PostgreSQL:
   - tasks.pg.ts
   - shop.pg.ts
   - leaderboard.pg.ts
   - token.pg.ts
   - users.pg.ts

3. Migration scripts and utilities:
   - Data migration from MongoDB to PostgreSQL
   - Point recalculation
   - Shop item seeding
   - Admin user setup

## Key Files

- `src/db.ts` - PostgreSQL connection setup
- `src/models/*.pg.ts` - Sequelize models
- `src/models/index.ts` - Model associations and database sync
- `scripts/migrateToPostgres.ts` - Data migration script
- `scripts/recalculatePoints.pg.ts` - Points recalculation for PostgreSQL
- `src/seedShop.pg.ts` - Shop item seeding for PostgreSQL
- `src/setAdmin.pg.ts` - Admin user setup for PostgreSQL

## Environment Setup

Required environment variables for PostgreSQL:
```
POSTGRES_HOST=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=grid
POSTGRES_PORT=5432
```

## Running with PostgreSQL

To run the application with PostgreSQL:
```bash
cd backend
npm start
```

For development mode:
```bash
npm run dev
```

## Further Documentation

- For detailed migration instructions, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- For testing procedures, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## Important Notes

1. All existing functionality has been preserved in the PostgreSQL version
2. Data relationships are maintained with Sequelize associations
3. PostgreSQL offers better performance and scaling options than MongoDB
4. The original MongoDB code remains in the project for reference
