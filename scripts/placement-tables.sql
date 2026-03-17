-- ============================================================
-- Placement Module Tables
-- Run this script against your MySQL database to create
-- the tables required for the placement workflow.
-- ============================================================

-- 1. Job postings / company requirements
CREATE TABLE IF NOT EXISTS placement_jobs (
  Job_Id          INT AUTO_INCREMENT PRIMARY KEY,
  Company_Name    VARCHAR(255) NOT NULL,
  Company_Email   VARCHAR(255),
  Job_Title       VARCHAR(255) NOT NULL,
  Job_Description TEXT,
  Requirements    TEXT,
  Location        VARCHAR(255),
  Package         VARCHAR(100),
  Min_Percentage  DECIMAL(5,2) DEFAULT 0,
  Eligible_Courses TEXT,              -- comma-separated Course_Ids
  Eligible_Batches TEXT,              -- comma-separated Batch_Ids
  Max_Backlogs    INT DEFAULT 0,
  Application_Deadline DATE,
  Status          VARCHAR(50) DEFAULT 'Open',  -- Open / Closed / Completed
  Token           VARCHAR(100) UNIQUE,         -- for public JD submission link
  Created_By      INT,
  Created_Date    DATETIME DEFAULT CURRENT_TIMESTAMP,
  IsActive        TINYINT DEFAULT 1,
  IsDelete        TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Student applications
CREATE TABLE IF NOT EXISTS placement_applications (
  Application_Id  INT AUTO_INCREMENT PRIMARY KEY,
  Job_Id          INT NOT NULL,
  Student_Id      INT NOT NULL,
  CV_Path         VARCHAR(500),
  Cover_Letter    TEXT,
  Status          VARCHAR(50) DEFAULT 'Applied',
      -- Applied / Screened / Shortlisted / Waitlisted / Rejected / Selected
  Applied_Date    DATETIME DEFAULT CURRENT_TIMESTAMP,
  Screened_By     INT,
  Screened_Date   DATETIME,
  Remarks         TEXT,
  IsDelete        TINYINT DEFAULT 0,
  UNIQUE KEY uq_job_student (Job_Id, Student_Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Student CV uploads
CREATE TABLE IF NOT EXISTS student_cvs (
  CV_Id        INT AUTO_INCREMENT PRIMARY KEY,
  Student_Id   INT NOT NULL,
  CV_Name      VARCHAR(255),
  CV_Path      VARCHAR(500) NOT NULL,
  Is_Default   TINYINT DEFAULT 0,
  Upload_Date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  IsDelete     TINYINT DEFAULT 0,
  INDEX idx_student (Student_Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Email drafts / logs to companies
CREATE TABLE IF NOT EXISTS placement_emails (
  Email_Id            INT AUTO_INCREMENT PRIMARY KEY,
  Company_Email       VARCHAR(255),
  Company_Name        VARCHAR(255),
  Subject             VARCHAR(500),
  Body                TEXT,
  Job_Submission_Link VARCHAR(500),
  Status              VARCHAR(50) DEFAULT 'Draft',  -- Draft / Sent
  Created_By          INT,
  Created_Date        DATETIME DEFAULT CURRENT_TIMESTAMP,
  Sent_Date           DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Student portal credentials (separate from admin users)
CREATE TABLE IF NOT EXISTS student_portal_auth (
  Id              INT AUTO_INCREMENT PRIMARY KEY,
  Student_Id      INT NOT NULL UNIQUE,
  Username        VARCHAR(255) NOT NULL UNIQUE,  -- typically email or mobile
  Password_Hash   VARCHAR(255) NOT NULL,         -- MD5 to match existing pattern
  Last_Login      DATETIME,
  IsActive        TINYINT DEFAULT 1,
  Created_Date    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
