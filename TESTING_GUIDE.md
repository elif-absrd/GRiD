# Migration Testing Steps

Follow these steps to test the migration from MongoDB to PostgreSQL:

## 1. Set Up PostgreSQL

1. Make sure PostgreSQL is installed and running
2. Create a database for your application:
   ```sql
   CREATE DATABASE grid;
   ```
3. Create a `.env` file in the `backend` directory with PostgreSQL connection details:
   ```
   POSTGRES_HOST=localhost
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=grid
   POSTGRES_PORT=5432
   
   # Keep your existing Firebase configs
   FIREBASE_CREDENTIALS_PATH=./credentials/grid-firebase-adminsdk.json
   ```

## 2. Sync Database Schema

1. Start the application to initialize the database schema:
   ```bash
   cd backend
   npm start
   ```
   This will create all necessary tables in PostgreSQL based on your Sequelize models.
   You can stop the application after tables are created (Ctrl+C).

## 3. Migrate Data

1. Run the migration script:
   ```bash
   npm run migrate
   ```

## 4. Verify Data Migration

1. Connect to PostgreSQL and check the migrated data:
   ```bash
   psql -U postgres -d grid
   ```
   
2. Run these queries to verify data was migrated correctly:
   ```sql
   -- Check user count
   SELECT COUNT(*) FROM "Users";
   
   -- Check task count
   SELECT COUNT(*) FROM "Tasks";
   
   -- Check submission count
   SELECT COUNT(*) FROM "Submissions";
   
   -- Check shop item count
   SELECT COUNT(*) FROM "ShopItems";
   ```

## 5. Recalculate Points

1. Run the points recalculation script:
   ```bash
   npm run recalculate-points
   ```

## 6. Test Application Features

Test the following features to ensure they work properly with PostgreSQL:

### User Authentication
1. Log in with an existing user
2. Check if user data is correctly loaded

### Tasks
1. View available tasks
2. Submit a task
3. Admin: Create a new task
4. Admin: Approve or reject submissions

### Shop
1. View shop items
2. Redeem tokens for an item
3. Admin: Add a new shop item

### Leaderboard
1. View leaderboard data
2. Verify points are displayed correctly

### Token Sharing
1. Admin: Generate a shared token
2. Use the token to log in as another user

## 7. Troubleshooting

If you encounter any issues:

1. Check database logs:
   ```bash
   tail -f /var/log/postgresql/postgresql-xx.x-main.log
   ```

2. Check application logs for any database-related errors

3. Verify all environment variables are set correctly

4. Make sure Sequelize models have the correct associations set up
