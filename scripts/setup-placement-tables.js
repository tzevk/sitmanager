/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '115.124.106.101',
    port: 3306,
    user: 'sitadmin',
    password: 'sJ%3g14n9',
    database: 'sit',
  });

  // 1. placement_jobs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS placement_jobs (
      Job_Id INT AUTO_INCREMENT PRIMARY KEY,
      Company_Name VARCHAR(255),
      Company_Email VARCHAR(255),
      Job_Title VARCHAR(255),
      Job_Description TEXT,
      Requirements TEXT,
      Location VARCHAR(255),
      Package VARCHAR(100),
      Min_Percentage DECIMAL(5,2) DEFAULT 0,
      Eligible_Courses VARCHAR(500),
      Eligible_Batches VARCHAR(500),
      Max_Backlogs INT DEFAULT 0,
      Application_Deadline DATE,
      Status VARCHAR(50) DEFAULT 'Open',
      Token VARCHAR(255),
      Created_By INT,
      Created_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
      IsDelete TINYINT DEFAULT 0
    )
  `);
  console.log('placement_jobs created');

  // 2. placement_applications
  await pool.query(`
    CREATE TABLE IF NOT EXISTS placement_applications (
      Application_Id INT AUTO_INCREMENT PRIMARY KEY,
      Job_Id INT NOT NULL,
      Student_Id INT NOT NULL,
      CV_Path VARCHAR(500),
      Cover_Letter TEXT,
      Status VARCHAR(50) DEFAULT 'Applied',
      Applied_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
      Updated_Date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      Remarks TEXT,
      IsDelete TINYINT DEFAULT 0,
      INDEX idx_job (Job_Id),
      INDEX idx_student (Student_Id)
    )
  `);
  console.log('placement_applications created');

  // 3. student_cvs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_cvs (
      CV_Id INT AUTO_INCREMENT PRIMARY KEY,
      Student_Id INT NOT NULL,
      CV_Name VARCHAR(255),
      CV_Path VARCHAR(500),
      Created_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
      Updated_Date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      IsDelete TINYINT DEFAULT 0,
      INDEX idx_student (Student_Id)
    )
  `);
  console.log('student_cvs created');

  await pool.end();
  console.log('Done — all placement tables ready.');
})();
