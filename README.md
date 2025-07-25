# GRiD Project Setup

This guide provides instructions to set up and run the GRiD project locally.

## Prerequisites
- Node.js installed
- npm installed
- Git installed

## Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/elif-absrd/GRiD
   ```

2. **Navigate to the Project Directory**
   ```bash
   cd GRiD
   ```

3. **Install Root Dependencies**
   ```bash
   npm install
   ```

4. **Navigate to the Backend Directory**
   ```bash
   cd backend
   ```

5. **Install Backend Dependencies**
   ```bash
   npm install
   ```

## Environment Setup

1. **Create Environment File in Root Directory**
   - Create a `.env` file in the root directory (`GRiD/`).
   - Add the necessary environment variables (refer to `.env.example` if provided or consult the project documentation for required variables).

2. **Create Environment File in Backend Directory**
   - Navigate to the `backend/` directory.
   - Create a `.env` file inside `backend/`.
   - Add the necessary backend-specific environment variables (refer to `backend/.env.example` if provided or consult the project documentation).

3. **Set Up Credentials**
   - Create a `credentials` directory inside `backend/` if it doesn't already exist:
     ```bash
     mkdir backend/credentials
     ```
   - Place the firebase admin sdk file.

## Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

2. **Start the Frontend (in a separate terminal)**
   ```bash
   # From the project root
   npm run dev
   ```

## Database Migration

This project has been migrated from MongoDB to PostgreSQL. For detailed migration instructions, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md).

## Additional Notes
- Ensure all environment variables are correctly configured before running the application.
- Refer to the project documentation for specific details on required credentials and environment variables.
- If you're setting up a new PostgreSQL database, use the provided scripts to initialize and seed data.
