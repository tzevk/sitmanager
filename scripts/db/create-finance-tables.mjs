#!/usr/bin/env node
/**
 * Migration: Create all Finance Dashboard tables
 * Run: node scripts/db/create-finance-tables.mjs
 */
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

const TABLES = [
  {
    name: 'finance_loans',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_loans (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bank_name     VARCHAR(200)   NOT NULL,
        outstanding   DECIMAL(15,2)  NOT NULL DEFAULT 0,
        paid          DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_salary_cashflow',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_salary_cashflow (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        month_year      VARCHAR(20)    NOT NULL COMMENT 'e.g. 2026-05',
        total_payable   DECIMAL(15,2)  NOT NULL DEFAULT 0,
        salary_paid     DECIMAL(15,2)  NOT NULL DEFAULT 0,
        salary_pending  DECIMAL(15,2)  NOT NULL DEFAULT 0,
        next_payout     DATE           NULL,
        created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_month_year (month_year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_cbd_performance',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_cbd_performance (
        id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        programme          VARCHAR(300)   NOT NULL,
        frequency          INT            NOT NULL DEFAULT 0,
        target_students    INT            NOT NULL DEFAULT 0,
        achieved_students  INT            NOT NULL DEFAULT 0,
        fees_target        DECIMAL(15,2)  NOT NULL DEFAULT 0,
        fees_received      DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_pending_fees',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_pending_fees (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        student_name  VARCHAR(300)   NOT NULL,
        batch         VARCHAR(200)   NOT NULL,
        total_fees    DECIMAL(15,2)  NOT NULL DEFAULT 0,
        paid          DECIMAL(15,2)  NOT NULL DEFAULT 0,
        due_date      DATE           NULL,
        created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_ct_performance',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_ct_performance (
        id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        month          VARCHAR(50)    NOT NULL,
        training_name  VARCHAR(300)   NOT NULL,
        count          INT            NOT NULL DEFAULT 0,
        cost           DECIMAL(15,2)  NOT NULL DEFAULT 0,
        target         DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_deputation',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_deputation (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        month        VARCHAR(50)    NOT NULL,
        actual_cost  DECIMAL(15,2)  NOT NULL DEFAULT 0,
        target_cost  DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_projects (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        month        VARCHAR(50)    NOT NULL,
        actual_cost  DECIMAL(15,2)  NOT NULL DEFAULT 0,
        target_cost  DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_debt_plan',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_debt_plan (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bank_name     VARCHAR(200)   NOT NULL,
        emi_amount    DECIMAL(15,2)  NOT NULL DEFAULT 0,
        planned_date  DATE           NULL,
        actual_paid   DECIMAL(15,2)  NOT NULL DEFAULT 0,
        actual_date   DATE           NULL,
        status        ENUM('Pending','Paid','Overdue') NOT NULL DEFAULT 'Pending',
        created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_cashflow_projection',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_cashflow_projection (
        id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        month            VARCHAR(50)    NOT NULL,
        revenue          DECIMAL(15,2)  NOT NULL DEFAULT 0,
        expenses         DECIMAL(15,2)  NOT NULL DEFAULT 0,
        loan_repayment   DECIMAL(15,2)  NOT NULL DEFAULT 0,
        created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
  {
    name: 'finance_cashflow',
    sql: `
      CREATE TABLE IF NOT EXISTS finance_cashflow (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        date         DATE           NOT NULL,
        type         ENUM('Payment','Receipt') NOT NULL,
        category     VARCHAR(100)   NOT NULL,
        description  VARCHAR(500)   NOT NULL DEFAULT '',
        payment      DECIMAL(15,2)  NOT NULL DEFAULT 0,
        receipt      DECIMAL(15,2)  NOT NULL DEFAULT 0,
        ref_no       VARCHAR(200)   NOT NULL DEFAULT '',
        created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
];

async function main() {
  const pool = await mysql.createPool({
    host:             process.env.DB_HOST,
    port:             Number(process.env.DB_PORT || 3306),
    user:             process.env.DB_USER,
    password:         process.env.DB_PASSWORD,
    database:         process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:  2,
    multipleStatements: false,
  });

  const conn = await pool.getConnection();
  try {
    for (const { name, sql } of TABLES) {
      await conn.query(sql);
      console.log(`✓  ${name}`);
    }
    console.log('\nAll finance tables created (or already exist).');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
