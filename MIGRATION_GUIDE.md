# MongoDB to PostgreSQL Migration Guide

This guide will help you migrate your GRiD application from MongoDB to PostgreSQL.

## Prerequisites

1. PostgreSQL installed on your machine or a PostgreSQL server
2. Node.js and npm installed
3. Access to both your current MongoDB database and the new PostgreSQL database

## Setup Steps

### 1. Install PostgreSQL

If you haven't already installed PostgreSQL, download and install it from [postgresql.org](https://www.postgresql.org/download/).

### 2. Create a PostgreSQL Database

```bash
psql -U postgres
CREATE DATABASE grid;
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory based on the `.env.example` provided:

```
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=grid
POSTGRES_PORT=5432

# Keep your Firebase and MongoDB settings
FIREBASE_CREDENTIALS_PATH=./credentials/grid-firebase-adminsdk.json
MONGODB_URI=your_mongodb_connection_string
```

### 4. Migrate Data

Run the migration script to transfer data from MongoDB to PostgreSQL:

```bash
cd backend
npm run migrate
```

This script will:
- Connect to both databases
- Transfer users, tasks, submissions, shop items, and shared tokens
- Maintain relationships between entities
- Log progress and any issues

### 5. Verify the Migration

After migration, run the recalculate points script to ensure user points are correctly calculated:

```bash
npm run recalculate-points
```

### 6. Start the Application with PostgreSQL

```bash
npm start
```

## Troubleshooting

### Database Connection Issues

If you encounter connection issues:

1. Verify PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Check your PostgreSQL credentials in the `.env` file

3. Make sure your PostgreSQL server accepts connections from your application

### Data Migration Issues

If specific data fails to migrate:

1. Check the migration logs for error messages
2. You can manually fix specific data issues using:
   - The PostgreSQL command line: `psql -U postgres -d grid`
   - Or tools like pgAdmin

### Authentication Issues

If Firebase authentication doesn't work with the new PostgreSQL backend:

1. Verify user data was migrated correctly
2. Check if admin status is preserved for admin users

## Commands Reference

- `npm start` - Start the application
- `npm run dev` - Start the application in development mode with auto-reload
- `npm run migrate` - Run the MongoDB to PostgreSQL migration
- `npm run seed-shop` - Seed shop items in PostgreSQL
- `npm run set-admin <email>` - Set a user as admin
- `npm run recalculate-points` - Recalculate user points based on approved submissions
