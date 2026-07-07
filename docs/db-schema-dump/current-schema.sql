-- Current database schema dump
-- Database: sit
-- Generated: 2026-07-06T17:30:17.178Z
-- Contains DDL only; no table data.

SET FOREIGN_KEY_CHECKS=0;

--
-- Table structure for table `Holiday_master`
--
DROP TABLE IF EXISTS `Holiday_master`;
CREATE TABLE `Holiday_master` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Holiday` varchar(255) DEFAULT NULL,
  `Date_of_Holiday` date DEFAULT NULL,
  `IsActive` tinyint(4) DEFAULT 1,
  `IsDelete` tinyint(4) DEFAULT 0,
  `Date_Added` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `admission_master`
--
DROP TABLE IF EXISTS `admission_master`;
CREATE TABLE `admission_master` (
  `Admission_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` varchar(50) DEFAULT NULL,
  `Student_Code` varchar(50) DEFAULT NULL,
  `Course_Id` varchar(50) DEFAULT NULL,
  `Batch_Id` varchar(50) DEFAULT NULL,
  `Admission_Date` varchar(100) DEFAULT NULL,
  `Payment_Type` varchar(100) DEFAULT NULL,
  `Amount` varchar(50) DEFAULT NULL,
  `Stud_Attend` varchar(100) DEFAULT NULL,
  `Cancel` varchar(100) DEFAULT NULL,
  `Transfered` varchar(100) DEFAULT NULL,
  `Pass` varchar(100) DEFAULT NULL,
  `Present` varchar(100) DEFAULT NULL,
  `Total` varchar(100) DEFAULT NULL,
  `Fees` varchar(100) DEFAULT NULL,
  `Late` varchar(100) DEFAULT NULL,
  `Lefted` varchar(100) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `IsDone` int(11) NOT NULL DEFAULT 0,
  `Phase` varchar(100) DEFAULT NULL,
  `InvoiceCode` varchar(100) DEFAULT NULL,
  `InvoiceDate` varchar(100) DEFAULT NULL,
  `IsInvoiceSend` varchar(100) DEFAULT NULL,
  `Roll_No` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Admission_Id`),
  KEY `idx_am_student_active` (`Student_Id`,`IsDelete`,`Cancel`,`Admission_Id`),
  KEY `idx_am_batch` (`Batch_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=18762 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `annual_batch_plan`
--
DROP TABLE IF EXISTS `annual_batch_plan`;
CREATE TABLE `annual_batch_plan` (
  `Plan_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Plan_Year` int(11) NOT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Training_Program_Name` varchar(255) NOT NULL,
  `Duration` varchar(50) DEFAULT NULL,
  `Frequency_Conducted` int(11) DEFAULT 0,
  `Target_Frequency` int(11) DEFAULT 0,
  `Min_Students_Per_Batch` int(11) DEFAULT 0,
  `Students_Admitted` int(11) DEFAULT 0,
  `Yearly_Students_Target` int(11) DEFAULT 0,
  `Percentage` decimal(5,2) DEFAULT 0.00,
  `IsDelete` tinyint(4) DEFAULT 0,
  `Date_Added` datetime DEFAULT current_timestamp(),
  `Date_Updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`Plan_Id`),
  KEY `idx_year` (`Plan_Year`),
  KEY `idx_course` (`Course_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `assignment_given_child`
--
DROP TABLE IF EXISTS `assignment_given_child`;
CREATE TABLE `assignment_given_child` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Given_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Name` varchar(150) DEFAULT NULL,
  `Actual_Dt` varchar(25) DEFAULT NULL,
  `Marks_Given` int(11) DEFAULT NULL,
  `Status` varchar(50) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM AUTO_INCREMENT=92740 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `assignment_taken`
--
DROP TABLE IF EXISTS `assignment_taken`;
CREATE TABLE `assignment_taken` (
  `Given_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Marks` int(11) DEFAULT NULL,
  `Assignment_Id` int(11) DEFAULT NULL,
  `Assign_No` int(11) DEFAULT NULL,
  `Faculty_Id` int(11) DEFAULT NULL,
  `Assign_Dt` varchar(15) DEFAULT NULL,
  `Return_Dt` varchar(15) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Given_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3887 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `assignmentstaken`
--
DROP TABLE IF EXISTS `assignmentstaken`;
CREATE TABLE `assignmentstaken` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(255) DEFAULT NULL,
  `assignmentname` varchar(255) DEFAULT NULL,
  `subjects` varchar(500) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `assignmentdate` varchar(50) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4245 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `attendance_feedback`
--
DROP TABLE IF EXISTS `attendance_feedback`;
CREATE TABLE `attendance_feedback` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(64) NOT NULL,
  `Batch_Id` int(11) NOT NULL,
  `date` date NOT NULL,
  `roll_no` varchar(50) DEFAULT NULL,
  `student_name` varchar(150) DEFAULT NULL,
  `device_id` varchar(64) DEFAULT NULL,
  `rating` tinyint(4) NOT NULL,
  `comments` text DEFAULT NULL,
  `first_half_rating` tinyint(4) DEFAULT NULL,
  `first_half_comments` text DEFAULT NULL,
  `second_half_rating` tinyint(4) DEFAULT NULL,
  `second_half_comments` text DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_batch_date` (`Batch_Id`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `attendance_feedback_token`
--
DROP TABLE IF EXISTS `attendance_feedback_token`;
CREATE TABLE `attendance_feedback_token` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(64) NOT NULL,
  `Batch_Id` int(11) NOT NULL,
  `date` date NOT NULL,
  `batch_name` varchar(100) DEFAULT NULL,
  `trainer_id` int(11) DEFAULT NULL,
  `trainer_name` varchar(150) DEFAULT NULL,
  `trainer_time_from` time DEFAULT NULL,
  `trainer_time_to` time DEFAULT NULL,
  `feedback_session` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_token` (`token`)
) ENGINE=InnoDB AUTO_INCREMENT=369 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `awt_academicqualification`
--
DROP TABLE IF EXISTS `awt_academicqualification`;
CREATE TABLE `awt_academicqualification` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_id` varchar(50) DEFAULT NULL,
  `Qualification` varchar(50) DEFAULT NULL,
  `Discipline` varchar(50) DEFAULT NULL,
  `College` varchar(150) DEFAULT NULL,
  `University` varchar(300) DEFAULT NULL,
  `PassingYear` varchar(50) DEFAULT NULL,
  `Percentage` varchar(50) DEFAULT NULL,
  `Status` varchar(50) DEFAULT NULL,
  `KT` varchar(50) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=139935 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_adminuser`
--
DROP TABLE IF EXISTS `awt_adminuser`;
CREATE TABLE `awt_adminuser` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firstname` varchar(15) DEFAULT NULL,
  `lastname` varchar(15) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `role` int(11) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `username` varchar(200) DEFAULT NULL,
  `password` varchar(32) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `updated_by` int(11) DEFAULT 0,
  `deleted` int(11) NOT NULL DEFAULT 0,
  `otp` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_annual`
--
DROP TABLE IF EXISTS `awt_annual`;
CREATE TABLE `awt_annual` (
  `id` int(11) NOT NULL,
  `selectcourse` varchar(250) DEFAULT NULL,
  `batchcode` varchar(250) DEFAULT NULL,
  `category` varchar(250) DEFAULT NULL,
  `description` varchar(250) DEFAULT NULL,
  `training` varchar(250) DEFAULT NULL,
  `actualdate` varchar(250) DEFAULT NULL,
  `timings` varchar(250) DEFAULT NULL,
  `coursename` varchar(250) DEFAULT NULL,
  `planned` varchar(250) DEFAULT NULL,
  `admission` varchar(250) DEFAULT NULL,
  `duration` varchar(250) DEFAULT NULL,
  `coordinator` varchar(250) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_asset_category`
--
DROP TABLE IF EXISTS `awt_asset_category`;
CREATE TABLE `awt_asset_category` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_assets`
--
DROP TABLE IF EXISTS `awt_assets`;
CREATE TABLE `awt_assets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `startdate` varchar(25) DEFAULT NULL,
  `venderid` varchar(150) DEFAULT NULL,
  `assetsid` varchar(255) DEFAULT NULL,
  `quantity` varchar(250) DEFAULT NULL,
  `price` varchar(250) DEFAULT NULL,
  `locationid` varchar(250) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` varchar(30) DEFAULT NULL,
  `updated_date` varchar(30) DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_banner`
--
DROP TABLE IF EXISTS `awt_banner`;
CREATE TABLE `awt_banner` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `target` varchar(50) NOT NULL DEFAULT '_self',
  `link` varchar(150) DEFAULT NULL,
  `upload_image` varchar(150) DEFAULT NULL,
  `view` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_batch_category`
--
DROP TABLE IF EXISTS `awt_batch_category`;
CREATE TABLE `awt_batch_category` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch` varchar(150) DEFAULT NULL,
  `batchtype` varchar(150) DEFAULT NULL,
  `prefix` varchar(150) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_batch_exam`
--
DROP TABLE IF EXISTS `awt_batch_exam`;
CREATE TABLE `awt_batch_exam` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `exam_date` varchar(15) DEFAULT NULL,
  `max_marks` int(11) DEFAULT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `created_date` varchar(255) DEFAULT NULL,
  `updated_date` varchar(200) DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=733 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_batch_side_visit`
--
DROP TABLE IF EXISTS `awt_batch_side_visit`;
CREATE TABLE `awt_batch_side_visit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `designation` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `visit_date` varchar(15) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_date` varchar(255) DEFAULT NULL,
  `updated_date` varchar(200) DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_batchcancellation`
--
DROP TABLE IF EXISTS `awt_batchcancellation`;
CREATE TABLE `awt_batchcancellation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(250) DEFAULT NULL,
  `batchno` varchar(150) DEFAULT NULL,
  `student` varchar(255) DEFAULT NULL,
  `cancellationammount` varchar(250) DEFAULT NULL,
  `date` varchar(20) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=978 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_batchleft`
--
DROP TABLE IF EXISTS `awt_batchleft`;
CREATE TABLE `awt_batchleft` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(250) DEFAULT NULL,
  `batchno` varchar(150) DEFAULT NULL,
  `student` varchar(255) DEFAULT NULL,
  `date` varchar(15) DEFAULT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_batchmoving`
--
DROP TABLE IF EXISTS `awt_batchmoving`;
CREATE TABLE `awt_batchmoving` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `batch_code` varchar(250) DEFAULT NULL,
  `student_id` varchar(250) DEFAULT NULL,
  `newbatch_code` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_batchtransfer`
--
DROP TABLE IF EXISTS `awt_batchtransfer`;
CREATE TABLE `awt_batchtransfer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `coursename` varchar(255) DEFAULT NULL,
  `oldbatch_code` varchar(255) DEFAULT NULL,
  `student` varchar(250) DEFAULT NULL,
  `trans_batchcode` varchar(250) DEFAULT NULL,
  `transferammount` varchar(255) DEFAULT NULL,
  `paymenttype` varchar(250) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=778 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_bookcode`
--
DROP TABLE IF EXISTS `awt_bookcode`;
CREATE TABLE `awt_bookcode` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_bookissue`
--
DROP TABLE IF EXISTS `awt_bookissue`;
CREATE TABLE `awt_bookissue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student` varchar(250) DEFAULT NULL,
  `book` varchar(250) DEFAULT NULL,
  `bookcode` varchar(150) DEFAULT NULL,
  `issuedate` datetime NOT NULL,
  `returndate` datetime NOT NULL,
  `created_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_brand`
--
DROP TABLE IF EXISTS `awt_brand`;
CREATE TABLE `awt_brand` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) DEFAULT NULL,
  `logo` varchar(150) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_cart`
--
DROP TABLE IF EXISTS `awt_cart`;
CREATE TABLE `awt_cart` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `orderid` int(11) NOT NULL DEFAULT 0,
  `proid` int(11) NOT NULL DEFAULT 0,
  `pname` varchar(200) DEFAULT NULL,
  `catid` int(11) NOT NULL DEFAULT 0,
  `catname` varchar(200) DEFAULT NULL,
  `price` varchar(5) DEFAULT '0',
  `totalprice` varchar(5) NOT NULL DEFAULT '0',
  `pqty` int(11) NOT NULL DEFAULT 1,
  `size` varchar(10) DEFAULT NULL,
  `weight` varchar(10) DEFAULT NULL,
  `unit` varchar(100) DEFAULT NULL,
  `gst_per` int(11) NOT NULL,
  `weightInGram` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=247 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_cashvoucher`
--
DROP TABLE IF EXISTS `awt_cashvoucher`;
CREATE TABLE `awt_cashvoucher` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company` varchar(150) DEFAULT NULL,
  `voucherno` varchar(150) DEFAULT NULL,
  `date` varchar(25) DEFAULT NULL,
  `paidto` varchar(100) DEFAULT NULL,
  `paidby` varchar(100) DEFAULT NULL,
  `prepaired_by` varchar(150) DEFAULT NULL,
  `approved_by` varchar(150) DEFAULT NULL,
  `checked_by` varchar(150) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6523 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_cashvoucherchild`
--
DROP TABLE IF EXISTS `awt_cashvoucherchild`;
CREATE TABLE `awt_cashvoucherchild` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `voucherid` int(11) DEFAULT NULL,
  `bill_no` varchar(150) DEFAULT NULL,
  `date` varchar(100) DEFAULT NULL,
  `account_head` varchar(500) DEFAULT NULL,
  `amount` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `project` varchar(150) DEFAULT NULL,
  `training_programee` varchar(500) DEFAULT NULL,
  `batch_code` varchar(150) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=67214 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_category`
--
DROP TABLE IF EXISTS `awt_category`;
CREATE TABLE `awt_category` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) DEFAULT NULL,
  `title` varchar(50) DEFAULT NULL,
  `slug` varchar(150) DEFAULT NULL,
  `image` varchar(150) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_college`
--
DROP TABLE IF EXISTS `awt_college`;
CREATE TABLE `awt_college` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `college_name` varchar(450) DEFAULT NULL,
  `university` varchar(450) DEFAULT NULL,
  `contact_person` varchar(150) DEFAULT NULL,
  `designation` varchar(255) DEFAULT NULL,
  `address` varchar(450) DEFAULT NULL,
  `city` varchar(150) DEFAULT NULL,
  `pin` varchar(50) DEFAULT NULL,
  `state` varchar(150) DEFAULT NULL,
  `country` varchar(150) DEFAULT NULL,
  `telephone` varchar(150) DEFAULT NULL,
  `mobile` varchar(500) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `website` varchar(150) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `purpose` varchar(150) DEFAULT NULL,
  `course` text DEFAULT NULL,
  `batch` varchar(15) DEFAULT NULL,
  `refstudentname` varchar(100) DEFAULT NULL,
  `refmobile` varchar(15) DEFAULT NULL,
  `refemail` varchar(100) DEFAULT NULL,
  `descipline` text DEFAULT NULL,
  `followup_status` varchar(100) DEFAULT NULL,
  `followup_date` date DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 1,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4427 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_color`
--
DROP TABLE IF EXISTS `awt_color`;
CREATE TABLE `awt_color` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) DEFAULT NULL,
  `colorcode` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_comments`
--
DROP TABLE IF EXISTS `awt_comments`;
CREATE TABLE `awt_comments` (
  `id` int(11) NOT NULL,
  `service_provider_id` varchar(150) DEFAULT NULL,
  `user_id` varchar(150) DEFAULT NULL,
  `comment` varchar(150) DEFAULT NULL,
  `rating` varchar(150) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_dashboard`
--
DROP TABLE IF EXISTS `awt_dashboard`;
CREATE TABLE `awt_dashboard` (
  `id` int(11) NOT NULL,
  `title` varchar(150) DEFAULT NULL,
  `link` varchar(150) DEFAULT NULL,
  `icon` varchar(150) DEFAULT NULL,
  `type` int(11) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `updated_by` int(11) DEFAULT 0,
  `deleted` int(11) NOT NULL DEFAULT 0,
  `otp` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_emailmaster`
--
DROP TABLE IF EXISTS `awt_emailmaster`;
CREATE TABLE `awt_emailmaster` (
  `id` int(11) NOT NULL,
  `emailpurpose` varchar(255) DEFAULT NULL,
  `department` varchar(250) DEFAULT NULL,
  `emailsubject` varchar(150) DEFAULT NULL,
  `cc` varchar(1050) DEFAULT NULL,
  `bcc` varchar(250) DEFAULT NULL,
  `specification` varchar(250) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_employeerecord`
--
DROP TABLE IF EXISTS `awt_employeerecord`;
CREATE TABLE `awt_employeerecord` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `training` int(11) DEFAULT NULL,
  `attendee` varchar(250) DEFAULT NULL,
  `instructor` varchar(250) DEFAULT NULL,
  `description` varchar(250) DEFAULT NULL,
  `feedback` varchar(250) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=210 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_employerecord`
--
DROP TABLE IF EXISTS `awt_employerecord`;
CREATE TABLE `awt_employerecord` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `training` varchar(255) DEFAULT NULL,
  `attendee` varchar(150) DEFAULT NULL,
  `instructor` varchar(250) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `feedback` varchar(250) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_event_images`
--
DROP TABLE IF EXISTS `awt_event_images`;
CREATE TABLE `awt_event_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_photo_id` int(11) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `event_photo_id` (`event_photo_id`),
  CONSTRAINT `awt_event_images_ibfk_1` FOREIGN KEY (`event_photo_id`) REFERENCES `awt_uploadeventphoto` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_extention`
--
DROP TABLE IF EXISTS `awt_extention`;
CREATE TABLE `awt_extention` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_faculty`
--
DROP TABLE IF EXISTS `awt_faculty`;
CREATE TABLE `awt_faculty` (
  `id` int(11) NOT NULL,
  `facultyname` varchar(150) DEFAULT NULL,
  `facultycode` varchar(150) DEFAULT NULL,
  `dob` int(11) DEFAULT NULL,
  `nationality` varchar(150) DEFAULT NULL,
  `discipline` varchar(250) DEFAULT NULL,
  `status` varchar(150) DEFAULT NULL,
  `invoicename` varchar(150) DEFAULT NULL,
  `maritalstatus` varchar(150) DEFAULT NULL,
  `joiningdate` int(11) DEFAULT NULL,
  `employment` varchar(150) DEFAULT NULL,
  `software` varchar(150) DEFAULT NULL,
  `training` varchar(150) DEFAULT NULL,
  `address` varchar(550) DEFAULT NULL,
  `city` varchar(150) DEFAULT NULL,
  `pin` int(11) DEFAULT NULL,
  `state` varchar(150) DEFAULT NULL,
  `country` varchar(150) DEFAULT NULL,
  `mobile` int(11) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `full_address` varchar(550) DEFAULT NULL,
  `city_name` varchar(150) DEFAULT NULL,
  `pin_code` int(11) DEFAULT NULL,
  `state_name` varchar(150) DEFAULT NULL,
  `country_name` varchar(150) DEFAULT NULL,
  `mobi` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_facultyworking`
--
DROP TABLE IF EXISTS `awt_facultyworking`;
CREATE TABLE `awt_facultyworking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` varchar(15) DEFAULT NULL,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(150) DEFAULT NULL,
  `faculty` varchar(250) DEFAULT NULL,
  `facultytime` varchar(250) DEFAULT NULL,
  `to` varchar(250) DEFAULT NULL,
  `work` varchar(250) DEFAULT NULL,
  `created_by` varchar(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `active` varchar(10) DEFAULT '1',
  `deleted` varchar(11) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7381 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_faq`
--
DROP TABLE IF EXISTS `awt_faq`;
CREATE TABLE `awt_faq` (
  `id` int(11) NOT NULL,
  `question` varchar(150) NOT NULL,
  `answer` text NOT NULL,
  `created_date` datetime NOT NULL,
  `updated_date` datetime NOT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `updated_by` int(11) NOT NULL DEFAULT 0,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_feedback`
--
DROP TABLE IF EXISTS `awt_feedback`;
CREATE TABLE `awt_feedback` (
  `id` int(11) NOT NULL,
  `questionfor` varchar(250) DEFAULT NULL,
  `category` varchar(250) DEFAULT NULL,
  `question` varchar(250) DEFAULT NULL,
  `selection` varchar(250) DEFAULT NULL,
  `order` int(11) NOT NULL,
  `suggestion` varchar(250) DEFAULT NULL,
  `brief` varchar(250) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_festival_photo`
--
DROP TABLE IF EXISTS `awt_festival_photo`;
CREATE TABLE `awt_festival_photo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `startdate` varchar(255) DEFAULT NULL,
  `enddate` varchar(255) DEFAULT NULL,
  `file` varchar(500) DEFAULT NULL,
  `description` varchar(1050) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_finalexamtaken`
--
DROP TABLE IF EXISTS `awt_finalexamtaken`;
CREATE TABLE `awt_finalexamtaken` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `coursename` varchar(255) DEFAULT NULL,
  `batchcode` varchar(255) DEFAULT NULL,
  `examtestname` varchar(255) DEFAULT NULL,
  `date` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_gallery`
--
DROP TABLE IF EXISTS `awt_gallery`;
CREATE TABLE `awt_gallery` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `upload_image` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_generateresult`
--
DROP TABLE IF EXISTS `awt_generateresult`;
CREATE TABLE `awt_generateresult` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(255) DEFAULT NULL,
  `returndate` varchar(255) DEFAULT NULL,
  `printdate` int(11) DEFAULT NULL,
  `prepared` varchar(255) DEFAULT NULL,
  `checked` varchar(250) DEFAULT NULL,
  `approved` varchar(250) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_group`
--
DROP TABLE IF EXISTS `awt_group`;
CREATE TABLE `awt_group` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `slug` varchar(150) DEFAULT NULL,
  `image` varchar(150) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_holiday`
--
DROP TABLE IF EXISTS `awt_holiday`;
CREATE TABLE `awt_holiday` (
  `id` int(11) NOT NULL,
  `Holiday` varchar(50) DEFAULT NULL,
  `Holiday_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_inquirydiscussion`
--
DROP TABLE IF EXISTS `awt_inquirydiscussion`;
CREATE TABLE `awt_inquirydiscussion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` varchar(50) DEFAULT NULL,
  `date` varchar(25) DEFAULT NULL,
  `discussion` text DEFAULT NULL,
  `Department` varchar(110) DEFAULT NULL,
  `Inquiry_id` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  `nextdate` varchar(25) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_disc_lookup` (`Inquiry_id`,`deleted`,`id`),
  KEY `idx_disc_due` (`deleted`,`nextdate`,`Inquiry_id`,`id`),
  KEY `idx_disc_student_lookup` (`student_id`,`deleted`,`id`)
) ENGINE=InnoDB AUTO_INCREMENT=174200 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `awt_lecture`
--
DROP TABLE IF EXISTS `awt_lecture`;
CREATE TABLE `awt_lecture` (
  `id` int(11) NOT NULL,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(255) DEFAULT NULL,
  `lecture` varchar(255) DEFAULT NULL,
  `classname` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_lecturetaken`
--
DROP TABLE IF EXISTS `awt_lecturetaken`;
CREATE TABLE `awt_lecturetaken` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(255) DEFAULT NULL,
  `lecture` varchar(255) DEFAULT NULL,
  `classroom` int(11) DEFAULT NULL,
  `lecturedate` int(11) DEFAULT NULL,
  `assignmentdate` int(11) DEFAULT NULL,
  `enddate` int(11) DEFAULT NULL,
  `materialissued` varchar(300) DEFAULT NULL,
  `material` varchar(255) DEFAULT NULL,
  `assignmentgive` varchar(355) DEFAULT NULL,
  `assignment` int(11) DEFAULT NULL,
  `testgiven` int(11) DEFAULT NULL,
  `test` int(11) DEFAULT NULL,
  `topicdescuss` int(11) DEFAULT NULL,
  `nextplanning` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_librarybook`
--
DROP TABLE IF EXISTS `awt_librarybook`;
CREATE TABLE `awt_librarybook` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bookname` varchar(250) DEFAULT NULL,
  `booknumber` int(11) DEFAULT NULL,
  `publication` varchar(250) DEFAULT NULL,
  `page` int(11) DEFAULT NULL,
  `status` varchar(250) DEFAULT NULL,
  `comment` varchar(500) DEFAULT NULL,
  `coursename` varchar(250) DEFAULT NULL,
  `author` varchar(250) DEFAULT NULL,
  `purchasedate` varchar(200) DEFAULT NULL,
  `price` int(11) DEFAULT NULL,
  `rackno` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_location`
--
DROP TABLE IF EXISTS `awt_location`;
CREATE TABLE `awt_location` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_material_cat`
--
DROP TABLE IF EXISTS `awt_material_cat`;
CREATE TABLE `awt_material_cat` (
  `id` int(11) NOT NULL,
  `Category` varchar(150) DEFAULT NULL,
  `Comments` varchar(500) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_material_price`
--
DROP TABLE IF EXISTS `awt_material_price`;
CREATE TABLE `awt_material_price` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Item` int(11) DEFAULT NULL,
  `Vendor` int(11) DEFAULT NULL,
  `Price` varchar(150) NOT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_materialconsumption`
--
DROP TABLE IF EXISTS `awt_materialconsumption`;
CREATE TABLE `awt_materialconsumption` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `isusseby` varchar(255) DEFAULT NULL,
  `startdate` varchar(250) DEFAULT NULL,
  `course` varchar(255) DEFAULT NULL,
  `qtyinstock` varchar(250) DEFAULT NULL,
  `batchno` varchar(250) DEFAULT NULL,
  `student` varchar(250) DEFAULT NULL,
  `selectitem` varchar(250) DEFAULT NULL,
  `qtyissue` varchar(150) DEFAULT NULL,
  `price` varchar(200) DEFAULT NULL,
  `ammounts` varchar(200) DEFAULT NULL,
  `purpose` varchar(550) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=300 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_noticeboard`
--
DROP TABLE IF EXISTS `awt_noticeboard`;
CREATE TABLE `awt_noticeboard` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `startdate` varchar(255) DEFAULT NULL,
  `enddate` varchar(255) DEFAULT NULL,
  `specification` varchar(1050) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_oadmissiondiscussion`
--
DROP TABLE IF EXISTS `awt_oadmissiondiscussion`;
CREATE TABLE `awt_oadmissiondiscussion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admissionid` varchar(150) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `department` varchar(50) DEFAULT NULL,
  `discussion` varchar(200) NOT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_onlinestudent`
--
DROP TABLE IF EXISTS `awt_onlinestudent`;
CREATE TABLE `awt_onlinestudent` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `admission` varchar(255) DEFAULT NULL,
  `fromdate` date DEFAULT NULL,
  `todate` date DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_pages`
--
DROP TABLE IF EXISTS `awt_pages`;
CREATE TABLE `awt_pages` (
  `id` int(11) NOT NULL,
  `pagename` text DEFAULT NULL,
  `seo_title` text DEFAULT NULL,
  `seo_keyword` text DEFAULT NULL,
  `seo_desc` text DEFAULT NULL,
  `title` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `breadimage` text DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `updated_by` int(11) NOT NULL DEFAULT 0,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_productimg`
--
DROP TABLE IF EXISTS `awt_productimg`;
CREATE TABLE `awt_productimg` (
  `id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `color_id` int(11) DEFAULT NULL,
  `image1` varchar(150) DEFAULT NULL,
  `image2` varchar(150) DEFAULT NULL,
  `image3` varchar(150) DEFAULT NULL,
  `image4` varchar(150) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_projectmaster`
--
DROP TABLE IF EXISTS `awt_projectmaster`;
CREATE TABLE `awt_projectmaster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `projectno` varchar(150) DEFAULT NULL,
  `projectname` varchar(150) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `workorderdetails` text DEFAULT NULL,
  `wo_date` varchar(25) DEFAULT NULL,
  `wo_amount` varchar(250) DEFAULT NULL,
  `quotationno` varchar(150) DEFAULT NULL,
  `qtn_date` varchar(25) DEFAULT NULL,
  `qtn_amount` varchar(150) DEFAULT NULL,
  `invoice_no` int(11) DEFAULT NULL,
  `invoice_date` varchar(25) DEFAULT NULL,
  `invoice_amt` varchar(150) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` varchar(30) DEFAULT NULL,
  `updated_date` varchar(30) DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_purchase_material`
--
DROP TABLE IF EXISTS `awt_purchase_material`;
CREATE TABLE `awt_purchase_material` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item` int(11) DEFAULT NULL,
  `vendor` int(11) DEFAULT NULL,
  `price` varchar(150) DEFAULT NULL,
  `company` varchar(100) DEFAULT NULL,
  `purchase_date` varchar(25) DEFAULT NULL,
  `purchase` text DEFAULT NULL,
  `voucherno` varchar(150) DEFAULT NULL,
  `purpose` varchar(50) DEFAULT NULL,
  `purposetxt` varchar(150) DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `course_id` int(11) DEFAULT NULL,
  `requireddate` varchar(25) DEFAULT NULL,
  `totalamt` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `Comment` varchar(255) DEFAULT NULL,
  `IsApproved` int(11) DEFAULT NULL,
  `Approvedby` varchar(150) DEFAULT NULL,
  `ApprovedDate` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_qmsdoes`
--
DROP TABLE IF EXISTS `awt_qmsdoes`;
CREATE TABLE `awt_qmsdoes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `qmsname` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `file` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_rack`
--
DROP TABLE IF EXISTS `awt_rack`;
CREATE TABLE `awt_rack` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_registeruser`
--
DROP TABLE IF EXISTS `awt_registeruser`;
CREATE TABLE `awt_registeruser` (
  `id` int(11) NOT NULL,
  `role` int(11) NOT NULL DEFAULT 1,
  `firstname` varchar(15) DEFAULT NULL,
  `lastname` varchar(15) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `password` varchar(32) DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `active` int(11) DEFAULT NULL,
  `otp` int(11) NOT NULL DEFAULT 0,
  `value` int(11) NOT NULL DEFAULT 1,
  `created_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `updated_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_returnbook`
--
DROP TABLE IF EXISTS `awt_returnbook`;
CREATE TABLE `awt_returnbook` (
  `id` int(11) NOT NULL,
  `student` varchar(250) DEFAULT NULL,
  `book` varchar(250) DEFAULT NULL,
  `bookcode` varchar(250) DEFAULT NULL,
  `returndate` int(11) DEFAULT NULL,
  `fine` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_salarymaster`
--
DROP TABLE IF EXISTS `awt_salarymaster`;
CREATE TABLE `awt_salarymaster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `formdate` varchar(255) DEFAULT NULL,
  `todate` varchar(250) DEFAULT NULL,
  `service` varchar(255) DEFAULT NULL,
  `empcontri` varchar(250) DEFAULT NULL,
  `salaryda` varchar(250) DEFAULT NULL,
  `minbasic` varchar(250) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_sitevisit`
--
DROP TABLE IF EXISTS `awt_sitevisit`;
CREATE TABLE `awt_sitevisit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(255) DEFAULT NULL,
  `site` varchar(250) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_social_links`
--
DROP TABLE IF EXISTS `awt_social_links`;
CREATE TABLE `awt_social_links` (
  `id` int(11) NOT NULL,
  `title` varchar(30) DEFAULT NULL,
  `link` varchar(300) DEFAULT NULL,
  `colorcode` varchar(50) DEFAULT NULL,
  `created_date` datetime DEFAULT current_timestamp(),
  `created_by` int(11) NOT NULL DEFAULT 1,
  `updated_date` datetime DEFAULT current_timestamp(),
  `updated_by` int(11) NOT NULL DEFAULT 1,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_states`
--
DROP TABLE IF EXISTS `awt_states`;
CREATE TABLE `awt_states` (
  `id` int(11) NOT NULL DEFAULT 0,
  `name` varchar(50) DEFAULT NULL,
  `country_id` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_status`
--
DROP TABLE IF EXISTS `awt_status`;
CREATE TABLE `awt_status` (
  `id` int(11) NOT NULL,
  `Status` varchar(150) DEFAULT NULL,
  `Description` varchar(500) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_studentbatch`
--
DROP TABLE IF EXISTS `awt_studentbatch`;
CREATE TABLE `awt_studentbatch` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(250) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_subcategory`
--
DROP TABLE IF EXISTS `awt_subcategory`;
CREATE TABLE `awt_subcategory` (
  `id` int(11) NOT NULL,
  `cat_id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `slug` varchar(150) DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_tax`
--
DROP TABLE IF EXISTS `awt_tax`;
CREATE TABLE `awt_tax` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Tax` varchar(50) DEFAULT NULL,
  `Tax_date` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_tds`
--
DROP TABLE IF EXISTS `awt_tds`;
CREATE TABLE `awt_tds` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_unittesttaken`
--
DROP TABLE IF EXISTS `awt_unittesttaken`;
CREATE TABLE `awt_unittesttaken` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `batchcode` varchar(255) DEFAULT NULL,
  `utdate` varchar(255) DEFAULT NULL,
  `subject` varchar(50) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3873 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_uploadbanner`
--
DROP TABLE IF EXISTS `awt_uploadbanner`;
CREATE TABLE `awt_uploadbanner` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `titlename` varchar(255) DEFAULT NULL,
  `file` varchar(500) DEFAULT NULL,
  `seqno` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_uploadeventphoto`
--
DROP TABLE IF EXISTS `awt_uploadeventphoto`;
CREATE TABLE `awt_uploadeventphoto` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event` varchar(255) DEFAULT NULL,
  `eventheader` varchar(255) DEFAULT NULL,
  `specification` varchar(1050) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_vendor_master`
--
DROP TABLE IF EXISTS `awt_vendor_master`;
CREATE TABLE `awt_vendor_master` (
  `id` int(11) NOT NULL,
  `vendorname` varchar(500) DEFAULT NULL,
  `address` varchar(5000) DEFAULT NULL,
  `pin` varchar(100) DEFAULT NULL,
  `country` varchar(150) DEFAULT NULL,
  `telephone` varchar(150) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `comments` varchar(500) DEFAULT NULL,
  `type` varchar(500) DEFAULT NULL,
  `city` varchar(150) DEFAULT NULL,
  `state` varchar(250) DEFAULT NULL,
  `contactperson` varchar(250) DEFAULT NULL,
  `mobile` varchar(150) DEFAULT NULL,
  `fax` varchar(150) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_vendor_type`
--
DROP TABLE IF EXISTS `awt_vendor_type`;
CREATE TABLE `awt_vendor_type` (
  `id` int(11) NOT NULL,
  `Category` varchar(150) DEFAULT NULL,
  `Comments` varchar(500) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `awt_visitsite`
--
DROP TABLE IF EXISTS `awt_visitsite`;
CREATE TABLE `awt_visitsite` (
  `id` int(11) NOT NULL,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(255) DEFAULT NULL,
  `region` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `student` varchar(255) DEFAULT NULL,
  `date` int(11) DEFAULT NULL,
  `time` int(11) DEFAULT NULL,
  `confirmdate` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `awt_vivamoctaken`
--
DROP TABLE IF EXISTS `awt_vivamoctaken`;
CREATE TABLE `awt_vivamoctaken` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `coursename` varchar(255) DEFAULT NULL,
  `batchcode` varchar(255) DEFAULT NULL,
  `vivamocname` varchar(255) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `date` varchar(25) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=156 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `bank`
--
DROP TABLE IF EXISTS `bank`;
CREATE TABLE `bank` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Bank_Name` varchar(61) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `batch_cancel`
--
DROP TABLE IF EXISTS `batch_cancel`;
CREATE TABLE `batch_cancel` (
  `Cancel_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Cancel_Amt` int(11) DEFAULT NULL,
  `Date_Added` varchar(10) DEFAULT NULL,
  `Pay_Type` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `batch_convocation`
--
DROP TABLE IF EXISTS `batch_convocation`;
CREATE TABLE `batch_convocation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `faculty_name` varchar(50) DEFAULT NULL,
  `guest_name` varchar(50) DEFAULT NULL,
  `guest_mobile` varchar(15) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `guest_designation` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `batch_feedback_master`
--
DROP TABLE IF EXISTS `batch_feedback_master`;
CREATE TABLE `batch_feedback_master` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `subject` varchar(50) DEFAULT NULL,
  `date` varchar(20) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `batch_fees_structure_new`
--
DROP TABLE IF EXISTS `batch_fees_structure_new`;
CREATE TABLE `batch_fees_structure_new` (
  `Installment_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Due_Date` varchar(7) DEFAULT NULL,
  `Payment_Mode` varchar(16) DEFAULT NULL,
  `Before_Dt_Amt` int(11) DEFAULT NULL,
  `After_Dt_Amt` varchar(6) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `batch_final_exam`
--
DROP TABLE IF EXISTS `batch_final_exam`;
CREATE TABLE `batch_final_exam` (
  `Exam_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Subject` varchar(31) DEFAULT NULL,
  `Exam_Date` varchar(10) DEFAULT NULL,
  `Max_Marks` int(11) DEFAULT NULL,
  `Duration` varchar(8) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `Take_Id` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `batch_lecture_master`
--
DROP TABLE IF EXISTS `batch_lecture_master`;
CREATE TABLE `batch_lecture_master` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `lecture_no` int(11) DEFAULT NULL,
  `subject_topic` text DEFAULT NULL,
  `starttime` varchar(50) DEFAULT NULL,
  `endtime` varchar(50) DEFAULT NULL,
  `assignment` varchar(50) DEFAULT NULL,
  `assignment_date` varchar(50) DEFAULT NULL,
  `faculty_name` varchar(50) DEFAULT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `class_room` varchar(50) DEFAULT NULL,
  `documents` varchar(50) DEFAULT NULL,
  `unit_test` varchar(50) DEFAULT NULL,
  `publish` varchar(10) DEFAULT NULL,
  `subject` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'utf8mb4_unicode_ci	',
  `date` varchar(150) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `lectureday` varchar(50) DEFAULT NULL,
  `module` varchar(50) DEFAULT NULL,
  `planned` varchar(20) DEFAULT NULL,
  `department` text DEFAULT NULL,
  `practicetest` varchar(50) DEFAULT NULL,
  `lecturecontent` text DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `s_Id` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` varchar(50) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45378 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `batch_moc_master`
--
DROP TABLE IF EXISTS `batch_moc_master`;
CREATE TABLE `batch_moc_master` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `subject` varchar(50) DEFAULT NULL,
  `date` varchar(20) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=159 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `batch_mst`
--
DROP TABLE IF EXISTS `batch_mst`;
CREATE TABLE `batch_mst` (
  `Batch_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_code` varchar(80) DEFAULT NULL,
  `Min_Qualifiaction` varchar(300) DEFAULT NULL,
  `SDate` varchar(25) DEFAULT NULL,
  `EDate` varchar(25) DEFAULT NULL,
  `Admission_Date` varchar(25) DEFAULT NULL,
  `Documents_Required` text DEFAULT NULL,
  `Passing_Criteria` varchar(25) DEFAULT NULL,
  `Fees_Full_Payment` int(11) DEFAULT NULL,
  `Fees_Installment_Payment` int(11) DEFAULT NULL,
  `No_of_Lectures` varchar(25) DEFAULT NULL,
  `Max_Students` varchar(50) DEFAULT NULL,
  `Site_Visit_Dt` varchar(25) DEFAULT NULL,
  `Site_company` varchar(100) DEFAULT NULL,
  `Site_Place` varchar(100) DEFAULT NULL,
  `Contact_Person` varchar(100) DEFAULT NULL,
  `Designation` varchar(50) DEFAULT NULL,
  `Telephone` varchar(25) DEFAULT NULL,
  `Date_Added` varchar(25) DEFAULT NULL,
  `Training_Coordinator` varchar(150) DEFAULT NULL,
  `Course_description` text DEFAULT NULL,
  `Category` varchar(120) DEFAULT NULL,
  `Duration` varchar(100) DEFAULT NULL,
  `Timings` varchar(255) DEFAULT NULL,
  `ActualDate` varchar(25) DEFAULT NULL,
  `NoStudent` int(11) DEFAULT NULL,
  `Transfer` int(11) DEFAULT NULL,
  `StudentPassed1` int(11) DEFAULT NULL,
  `StudentPassed2` int(11) DEFAULT NULL,
  `Corporate` varchar(25) DEFAULT NULL,
  `ConvocationDate` varchar(25) DEFAULT NULL,
  `Convocationday` varchar(100) DEFAULT NULL,
  `Actual_Fees_Payment` int(11) DEFAULT NULL,
  `Placement` int(11) DEFAULT NULL,
  `Result` int(11) DEFAULT NULL,
  `Cancel` int(11) DEFAULT NULL,
  `lefted` int(11) DEFAULT NULL,
  `cvsended` int(11) DEFAULT NULL,
  `cvplaced` int(11) DEFAULT NULL,
  `No_block_place` int(11) DEFAULT NULL,
  `AttendWtg` int(11) DEFAULT NULL,
  `AssignWtg` int(11) DEFAULT NULL,
  `ExamWtg` int(11) DEFAULT NULL,
  `UnitTestWtg` int(11) DEFAULT NULL,
  `Others` varchar(42) DEFAULT NULL,
  `FullAttendWtg` int(11) DEFAULT NULL,
  `INR_Basic` int(11) DEFAULT NULL,
  `INR_ServiceTax` decimal(7,2) DEFAULT NULL,
  `INR_Total` decimal(8,2) DEFAULT NULL,
  `Dollar_Basic` int(11) DEFAULT NULL,
  `Dollar_ServiceTax` decimal(7,2) DEFAULT NULL,
  `Dollar_Total` decimal(8,2) DEFAULT NULL,
  `TaxRate` decimal(4,2) DEFAULT NULL,
  `Batch_Category_id` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `Min_Qualification` varchar(250) DEFAULT NULL,
  `Attachment` varchar(51) DEFAULT NULL,
  `LateMarkLimit` int(11) DEFAULT NULL,
  `Current_batch_Course` varchar(10) DEFAULT NULL,
  `CourseName` varchar(255) DEFAULT NULL,
  `Comments` varchar(666) DEFAULT NULL,
  `Location` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`Batch_Id`),
  KEY `idx_batch_code` (`Batch_code`)
) ENGINE=MyISAM AUTO_INCREMENT=979 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `batch_result_structure`
--
DROP TABLE IF EXISTS `batch_result_structure`;
CREATE TABLE `batch_result_structure` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(20) DEFAULT NULL,
  `unit_test` varchar(20) DEFAULT NULL,
  `assignment_wt` varchar(20) DEFAULT NULL,
  `exam_wt` varchar(20) DEFAULT NULL,
  `full_atten_wt` varchar(20) DEFAULT NULL,
  `absent_wt` varchar(150) DEFAULT NULL,
  `late_limit` varchar(150) DEFAULT NULL,
  `created_date` varchar(200) DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `batch_slecture_master`
--
DROP TABLE IF EXISTS `batch_slecture_master`;
CREATE TABLE `batch_slecture_master` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(50) DEFAULT NULL,
  `lecture_no` int(11) DEFAULT NULL,
  `subject_topic` text DEFAULT NULL,
  `starttime` varchar(50) DEFAULT NULL,
  `endtime` varchar(50) DEFAULT NULL,
  `assignment` varchar(50) DEFAULT NULL,
  `assignment_date` varchar(50) DEFAULT NULL,
  `faculty_id` int(11) DEFAULT NULL,
  `faculty_name` varchar(50) DEFAULT NULL,
  `duration` varchar(50) DEFAULT NULL,
  `class_room` varchar(50) DEFAULT NULL,
  `documents` varchar(50) DEFAULT NULL,
  `unit_test` varchar(50) DEFAULT NULL,
  `publish` varchar(10) DEFAULT NULL,
  `subject` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `lectureday` varchar(20) DEFAULT NULL,
  `marks` varchar(50) DEFAULT NULL,
  `module` varchar(50) DEFAULT NULL,
  `planned` varchar(20) DEFAULT NULL,
  `department` text DEFAULT NULL,
  `practicetest` varchar(50) DEFAULT NULL,
  `lecturecontent` text DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` varchar(10) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45698 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `cash_child`
--
DROP TABLE IF EXISTS `cash_child`;
CREATE TABLE `cash_child` (
  `Id` int(11) DEFAULT NULL,
  `CID` int(11) DEFAULT NULL,
  `BillNo` varchar(29) DEFAULT NULL,
  `AccountHead` varchar(30) DEFAULT NULL,
  `Amount` decimal(8,2) DEFAULT NULL,
  `Remark` varchar(229) DEFAULT NULL,
  `Billdate` varchar(26) DEFAULT NULL,
  `Batch_Code` varchar(6) DEFAULT NULL,
  `Course` varchar(51) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `ProjectCode` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `cbd_annual_targets`
--
DROP TABLE IF EXISTS `cbd_annual_targets`;
CREATE TABLE `cbd_annual_targets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `training_name` varchar(200) NOT NULL DEFAULT '',
  `target_frequency` int(11) NOT NULL DEFAULT 0,
  `target_students` int(11) NOT NULL DEFAULT 0,
  `students_admitted` int(11) NOT NULL DEFAULT 0,
  `uploaded_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `cbd_batch_marketing`
--
DROP TABLE IF EXISTS `cbd_batch_marketing`;
CREATE TABLE `cbd_batch_marketing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_name` varchar(200) NOT NULL DEFAULT '',
  `training_name` varchar(200) NOT NULL DEFAULT '',
  `batch_start_date` date DEFAULT NULL,
  `batch_announcement_date` date DEFAULT NULL,
  `meta_ads_date` date DEFAULT NULL,
  `flyer_status` enum('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `announcement_status` enum('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `meta_ads_status` enum('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `is_locked` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_batch_start` (`batch_start_date`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `cbd_content_calendar`
--
DROP TABLE IF EXISTS `cbd_content_calendar`;
CREATE TABLE `cbd_content_calendar` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `content_type` varchar(100) NOT NULL DEFAULT 'Post',
  `planned_date` date DEFAULT NULL,
  `execution_date` date DEFAULT NULL,
  `upload_date` date DEFAULT NULL,
  `status` enum('Not Started','Planned','Shot','Edited','Approved','Posted') NOT NULL DEFAULT 'Not Started',
  `platform` varchar(100) NOT NULL DEFAULT '',
  `responsible_person` varchar(255) NOT NULL DEFAULT '',
  `description` text DEFAULT NULL,
  `IsDelete` tinyint(1) NOT NULL DEFAULT 0,
  `Date_Added` datetime DEFAULT current_timestamp(),
  `Date_Updated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `meta_campaign_id` varchar(191) DEFAULT NULL,
  `meta_campaign_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_planned` (`planned_date`),
  KEY `idx_type` (`content_type`),
  KEY `idx_delete` (`IsDelete`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `cbd_content_plan`
--
DROP TABLE IF EXISTS `cbd_content_plan`;
CREATE TABLE `cbd_content_plan` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `content_type` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `frequency` varchar(100) NOT NULL DEFAULT '',
  `target_per_month` int(11) NOT NULL DEFAULT 0,
  `responsible_person` varchar(255) NOT NULL DEFAULT '',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `college_follow_new`
--
DROP TABLE IF EXISTS `college_follow_new`;
CREATE TABLE `college_follow_new` (
  `Follow_id` int(11) DEFAULT NULL,
  `College_id` int(11) DEFAULT NULL,
  `CName` varchar(255) DEFAULT NULL,
  `Phone` varchar(100) DEFAULT NULL,
  `Email` varchar(150) DEFAULT NULL,
  `Designation` varchar(150) DEFAULT NULL,
  `Purpose` varchar(255) DEFAULT NULL,
  `Remark` varchar(2238) DEFAULT NULL,
  `Tdate` varchar(20) DEFAULT NULL,
  `DirectLine` varchar(100) DEFAULT NULL,
  `Course` varchar(39) DEFAULT NULL,
  `nextdate` varchar(20) DEFAULT NULL,
  `Note` varchar(250) DEFAULT NULL,
  `Discipline` varchar(255) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `StatusId` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `college_follows`
--
DROP TABLE IF EXISTS `college_follows`;
CREATE TABLE `college_follows` (
  `Follow_id` int(11) NOT NULL AUTO_INCREMENT,
  `College_id` int(11) DEFAULT NULL,
  `CName` varchar(71) DEFAULT NULL,
  `Phone` varchar(56) DEFAULT NULL,
  `Email` varchar(93) DEFAULT NULL,
  `Designation` varchar(63) DEFAULT NULL,
  `Purpose` varchar(18) DEFAULT NULL,
  `Remark` varchar(2238) DEFAULT NULL,
  `Tdate` varchar(20) DEFAULT NULL,
  `DirectLine` varchar(70) DEFAULT NULL,
  `Course` varchar(39) DEFAULT NULL,
  `nextdate` varchar(20) DEFAULT NULL,
  `Note` varchar(250) DEFAULT NULL,
  `Discipline` varchar(12) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `StatusId` int(11) DEFAULT NULL,
  PRIMARY KEY (`Follow_id`)
) ENGINE=MyISAM AUTO_INCREMENT=3134 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `company_info`
--
DROP TABLE IF EXISTS `company_info`;
CREATE TABLE `company_info` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_id` int(11) DEFAULT NULL,
  `Company` varchar(255) DEFAULT NULL,
  `BussinessNature` varchar(255) DEFAULT NULL,
  `Designation` varchar(150) DEFAULT NULL,
  `Duration` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25120 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `company_req_batch_details_apk`
--
DROP TABLE IF EXISTS `company_req_batch_details_apk`;
CREATE TABLE `company_req_batch_details_apk` (
  `CompReqBatchId` int(11) NOT NULL AUTO_INCREMENT,
  `CompanyReqId` int(11) DEFAULT NULL,
  `BatchId` int(11) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`CompReqBatchId`)
) ENGINE=MyISAM AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `company_requirements_apk`
--
DROP TABLE IF EXISTS `company_requirements_apk`;
CREATE TABLE `company_requirements_apk` (
  `CompReqId` int(11) NOT NULL AUTO_INCREMENT,
  `CompanyId` int(11) DEFAULT NULL,
  `CourseId` int(11) DEFAULT NULL,
  `Profile` varchar(150) DEFAULT NULL,
  `Location` varchar(150) DEFAULT NULL,
  `Eligibility` varchar(150) DEFAULT NULL,
  `Responsibility` varchar(150) DEFAULT NULL,
  `IsPassStudents` int(11) NOT NULL DEFAULT 0,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `PostedDate` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`CompReqId`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `consultant_branch`
--
DROP TABLE IF EXISTS `consultant_branch`;
CREATE TABLE `consultant_branch` (
  `Branch_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Const_Id` int(11) DEFAULT NULL,
  `Contact_Person` varchar(100) DEFAULT NULL,
  `Designation` varchar(150) DEFAULT NULL,
  `Branch_Address` varchar(255) DEFAULT NULL,
  `Branch_City` varchar(100) DEFAULT NULL,
  `Branch_Tel` varchar(42) DEFAULT NULL,
  `Mobile` varchar(30) DEFAULT NULL,
  `Email` varchar(70) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `City` varchar(100) DEFAULT NULL,
  `Telephone` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Branch_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `consultant_follows`
--
DROP TABLE IF EXISTS `consultant_follows`;
CREATE TABLE `consultant_follows` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Consultant_Id` varchar(7) DEFAULT NULL,
  `CName` varchar(120) DEFAULT NULL,
  `Phone` varchar(93) DEFAULT NULL,
  `Email` varchar(218) DEFAULT NULL,
  `Designation` varchar(255) DEFAULT NULL,
  `Purpose` varchar(111) DEFAULT NULL,
  `Remark` mediumtext DEFAULT NULL,
  `Tdate` varchar(54) DEFAULT NULL,
  `DirectLine` mediumtext DEFAULT NULL,
  `Course` varchar(52) DEFAULT NULL,
  `nextdate` varchar(58) DEFAULT NULL,
  `IsActive` varchar(110) DEFAULT NULL,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `Course_id` varchar(13703) DEFAULT NULL,
  `CreatedBy` varchar(32) DEFAULT NULL,
  `Entry_Type` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=26407 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `consultant_followup`
--
DROP TABLE IF EXISTS `consultant_followup`;
CREATE TABLE `consultant_followup` (
  `Followup_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Const_Id` int(11) NOT NULL,
  `Followup_Date` date DEFAULT NULL,
  `Contact_Person` varchar(255) DEFAULT NULL,
  `Designation` varchar(255) DEFAULT NULL,
  `Mobile` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `Purpose` varchar(255) DEFAULT NULL,
  `Course` varchar(255) DEFAULT NULL,
  `Direct_Line` varchar(100) DEFAULT NULL,
  `Remarks` text DEFAULT NULL,
  `Added_By` int(11) DEFAULT NULL,
  `IsDelete` tinyint(4) DEFAULT 0,
  `Date_Added` datetime DEFAULT current_timestamp(),
  `Source_Inquiry_Id` int(11) DEFAULT NULL,
  PRIMARY KEY (`Followup_Id`),
  KEY `idx_const_id` (`Const_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=6620 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `consultant_mst`
--
DROP TABLE IF EXISTS `consultant_mst`;
CREATE TABLE `consultant_mst` (
  `Const_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Comp_Name` varchar(100) DEFAULT NULL,
  `Contact_Person` varchar(50) DEFAULT NULL,
  `Designation` varchar(70) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  `City` varchar(50) DEFAULT NULL,
  `State` varchar(50) DEFAULT NULL,
  `Pin` varchar(10) DEFAULT NULL,
  `Country` varchar(50) DEFAULT NULL,
  `Tel` varchar(36) DEFAULT NULL,
  `Fax` varchar(14) DEFAULT NULL,
  `EMail` varchar(255) DEFAULT NULL,
  `Remark` text DEFAULT NULL,
  `Date_Added` varchar(20) DEFAULT NULL,
  `Course_Id1` int(11) DEFAULT NULL,
  `CourseName1` varchar(100) DEFAULT NULL,
  `Course_Id2` int(11) DEFAULT NULL,
  `CourseName2` varchar(100) DEFAULT NULL,
  `Course_Id3` int(11) DEFAULT NULL,
  `CourseName3` varchar(100) DEFAULT NULL,
  `Course_Id4` int(11) DEFAULT NULL,
  `CourseName4` varchar(100) DEFAULT NULL,
  `Course_Id5` int(11) DEFAULT NULL,
  `CourseName5` varchar(100) DEFAULT NULL,
  `Course_Id6` int(11) DEFAULT NULL,
  `CourseName6` varchar(100) DEFAULT NULL,
  `Purpose` varchar(20) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `Company_Status` varchar(10) DEFAULT NULL,
  `Website` varchar(70) DEFAULT NULL,
  `Mobile` varchar(20) DEFAULT NULL,
  `Mention_Date` varchar(20) DEFAULT NULL,
  `Industry` varchar(150) DEFAULT NULL,
  `CreatedBy` varchar(10) DEFAULT NULL,
  `Company_Type` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`Const_Id`)
) ENGINE=MyISAM AUTO_INCREMENT=6075 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `convocation_guest_list`
--
DROP TABLE IF EXISTS `convocation_guest_list`;
CREATE TABLE `convocation_guest_list` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Batch_Id` varchar(255) DEFAULT NULL,
  `FName` varchar(100) DEFAULT NULL,
  `GName` varchar(100) DEFAULT NULL,
  `Mobile_no` varchar(15) DEFAULT NULL,
  `Email_id` varchar(100) DEFAULT NULL,
  `Ref_ID` int(11) DEFAULT NULL,
  `DateAdded` varchar(50) DEFAULT NULL,
  `GDesig` varchar(25) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=MyISAM AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `convocation_guest_list_child`
--
DROP TABLE IF EXISTS `convocation_guest_list_child`;
CREATE TABLE `convocation_guest_list_child` (
  `C_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Id` int(11) DEFAULT NULL,
  `FName` varchar(150) DEFAULT NULL,
  `GName` varchar(150) DEFAULT NULL,
  `Mobile_no` varchar(50) DEFAULT NULL,
  `Email_Id` varchar(150) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`C_Id`)
) ENGINE=MyISAM AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `convocation_mst`
--
DROP TABLE IF EXISTS `convocation_mst`;
CREATE TABLE `convocation_mst` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Batch_List` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Convocation_Date` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`Id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `corporate_inquiry`
--
DROP TABLE IF EXISTS `corporate_inquiry`;
CREATE TABLE `corporate_inquiry` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Fname` varchar(255) DEFAULT NULL,
  `Lname` varchar(10) DEFAULT NULL,
  `MName` varchar(11) DEFAULT NULL,
  `FullName` varchar(255) DEFAULT NULL,
  `CompanyName` varchar(255) DEFAULT NULL,
  `Designation` text DEFAULT NULL,
  `Address` varchar(52) DEFAULT NULL,
  `City` varchar(10) DEFAULT NULL,
  `State` varchar(11) DEFAULT NULL,
  `Country` varchar(7) DEFAULT NULL,
  `Pin` varchar(8) DEFAULT NULL,
  `Phone` varchar(50) DEFAULT NULL,
  `Mobile` varchar(50) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Course_Id` varchar(50) DEFAULT NULL,
  `Place` varchar(18) DEFAULT NULL,
  `business` text DEFAULT NULL,
  `Remark` text DEFAULT NULL,
  `Idate` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 0,
  `IsDelete` int(11) DEFAULT 0,
  `Consultancy_Id` int(11) DEFAULT NULL,
  `CompanyAuthority` varchar(255) DEFAULT NULL,
  `TrainingMode` varchar(50) DEFAULT NULL,
  `Participants_Fresher` int(11) DEFAULT NULL,
  `Participants_Experienced` int(11) DEFAULT NULL,
  `TrainingLocation` varchar(255) DEFAULT NULL,
  `Discussion` text DEFAULT NULL,
  `FollowUp` text DEFAULT NULL,
  `InitialFollowUpDate` date DEFAULT NULL,
  `NextFollowUpDate` date DEFAULT NULL,
  `InquiryStatus` varchar(20) DEFAULT NULL,
  `TrainingNumber` varchar(50) DEFAULT NULL,
  `TrainingDate` date DEFAULT NULL,
  `TrainerName` varchar(255) DEFAULT NULL,
  `NumberOfDays` int(11) DEFAULT NULL,
  `TotalStudents` int(11) DEFAULT NULL,
  `TrainingCoordinator` varchar(255) DEFAULT NULL,
  `ConfirmDate` date DEFAULT NULL,
  `PerformanceEvaluation` text DEFAULT NULL,
  `TrainingFeedback` text DEFAULT NULL,
  `SitCertification` varchar(3) DEFAULT NULL,
  `DiscussionOutcome` varchar(20) DEFAULT NULL,
  `CtTrainingEnquiryId` int(11) DEFAULT NULL,
  `CompanyType` varchar(20) DEFAULT NULL,
  `TrainingDates` text DEFAULT NULL,
  `PerformanceEvaluation_PreTest` text DEFAULT NULL,
  `PerformanceEvaluation_Assessment` text DEFAULT NULL,
  `PerformanceEvaluation_Assignment` text DEFAULT NULL,
  `PerformanceEvaluation_FinalExam` text DEFAULT NULL,
  `PerformanceEvaluation_TrainingMaterial` text DEFAULT NULL,
  `PerformanceEvaluation_Attendance` text DEFAULT NULL,
  `TrainingFeedbackObtained` text DEFAULT NULL,
  `SitCertIssuedOnPerformanceOnAttendance` text DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_corp_list` (`IsDelete`,`Id`),
  KEY `idx_corp_status` (`IsDelete`,`InquiryStatus`,`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=122 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `corporate_proposal`
--
DROP TABLE IF EXISTS `corporate_proposal`;
CREATE TABLE `corporate_proposal` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Inquiry_Id` int(11) NOT NULL,
  `ProposalRefNo` varchar(100) DEFAULT NULL,
  `ProposalDate` varchar(50) DEFAULT NULL,
  `ProposalTitle` varchar(500) DEFAULT NULL,
  `ClientName` varchar(255) DEFAULT NULL,
  `Venue` varchar(255) DEFAULT NULL,
  `AboutOrganisation` longtext DEFAULT NULL,
  `TrainingContents` longtext DEFAULT NULL,
  `QuotationRows` longtext DEFAULT NULL,
  `TrainingAttachments` longtext DEFAULT NULL,
  `QuotationAttachments` longtext DEFAULT NULL,
  `CreatedAt` datetime DEFAULT current_timestamp(),
  `UpdatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `TrainerCvAttachments` longtext DEFAULT NULL,
  `TrainingData` longtext DEFAULT NULL,
  `QuotationData` longtext DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `uq_corporate_proposal_inquiry` (`Inquiry_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `country`
--
DROP TABLE IF EXISTS `country`;
CREATE TABLE `country` (
  `ID` int(11) NOT NULL,
  `countryname` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `course_mst`
--
DROP TABLE IF EXISTS `course_mst`;
CREATE TABLE `course_mst` (
  `Course_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Name` varchar(52) DEFAULT NULL,
  `Course_Code` int(11) DEFAULT NULL,
  `FileName1` varchar(55) DEFAULT NULL,
  `FileName2` varchar(17) DEFAULT NULL,
  `FileName3` varchar(10) DEFAULT NULL,
  `FileName4` varchar(10) DEFAULT NULL,
  `FileName5` varchar(10) DEFAULT NULL,
  `FileName6` varchar(10) DEFAULT NULL,
  `FileName7` varchar(10) DEFAULT NULL,
  `FileName8` varchar(10) DEFAULT NULL,
  `FileName9` varchar(10) DEFAULT NULL,
  `FileName10` varchar(10) DEFAULT NULL,
  `Course_syllabus` varchar(10) DEFAULT NULL,
  `course_Preparation` varchar(10) DEFAULT NULL,
  `Date_Added` varchar(7) DEFAULT NULL,
  `Assignment` varchar(10) DEFAULT NULL,
  `Basic_Subject` varchar(7428) DEFAULT NULL,
  `Detailed_Study_Of` varchar(4) DEFAULT NULL,
  `Discipline_1` varchar(10) DEFAULT NULL,
  `Discipline_2` varchar(10) DEFAULT NULL,
  `Discipline_3` varchar(10) DEFAULT NULL,
  `Discipline_4` varchar(10) DEFAULT NULL,
  `Document_Study` varchar(5) DEFAULT NULL,
  `Eligibility` varchar(2000) DEFAULT NULL,
  `ImageName` varchar(56) DEFAULT NULL,
  `Introduction` varchar(643) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `Link` varchar(51) DEFAULT NULL,
  `Objective` varchar(2319) DEFAULT NULL,
  `Publish` varchar(3) DEFAULT NULL,
  `Qualification_1` varchar(10) DEFAULT NULL,
  `Qualification_2` varchar(10) DEFAULT NULL,
  `Qualification_3` varchar(10) DEFAULT NULL,
  `Qualification_4` varchar(10) DEFAULT NULL,
  `Scope_Of` varchar(10) DEFAULT NULL,
  `Course_Description` varchar(8000) DEFAULT NULL,
  PRIMARY KEY (`Course_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `ct_training_conducted`
--
DROP TABLE IF EXISTS `ct_training_conducted`;
CREATE TABLE `ct_training_conducted` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sr_no` int(11) DEFAULT NULL,
  `corporate_training_no` varchar(255) DEFAULT NULL,
  `enquiry_date` date DEFAULT NULL,
  `disciplines` varchar(255) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `training_mode` varchar(255) DEFAULT NULL,
  `training_dates_20242025` varchar(255) DEFAULT NULL,
  `total_days` int(11) DEFAULT NULL,
  `trainer` varchar(255) DEFAULT NULL,
  `sit_training_cordinator` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_name` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_designation` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_mobile` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_email_id` varchar(255) DEFAULT NULL,
  `performance_evaluation_pre_and_posttest` varchar(255) DEFAULT NULL,
  `performance_evaluation_assessment` varchar(255) DEFAULT NULL,
  `performance_evaluation_assignment` varchar(255) DEFAULT NULL,
  `performance_evaluation_final_exam` varchar(255) DEFAULT NULL,
  `performance_evaluation_training_material` varchar(255) DEFAULT NULL,
  `performance_evaluation_attendance` varchar(255) DEFAULT NULL,
  `no_of_participants` varchar(255) DEFAULT NULL,
  `training_feedback_obtained` varchar(255) DEFAULT NULL,
  `sit_cert_issued_on_performance_on_attendance` varchar(255) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `ct_training_enquires`
--
DROP TABLE IF EXISTS `ct_training_enquires`;
CREATE TABLE `ct_training_enquires` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sr_no` int(11) DEFAULT NULL,
  `corporate_training_batch_no` varchar(255) DEFAULT NULL,
  `enquiry_date` date DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `disciplines` varchar(255) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `training_mode` varchar(255) DEFAULT NULL,
  `training_dates` varchar(255) DEFAULT NULL,
  `total_days` varchar(255) DEFAULT NULL,
  `faculty` varchar(255) DEFAULT NULL,
  `sit_training_cordinator` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_name` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_designation` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_mobile` varchar(255) DEFAULT NULL,
  `detail_of_company_corinator_email_id` varchar(255) DEFAULT NULL,
  `performance_evaluation_pretest` varchar(255) DEFAULT NULL,
  `performance_evaluation_assessment` varchar(255) DEFAULT NULL,
  `performance_evaluation_assignment` varchar(255) DEFAULT NULL,
  `performance_evaluation_final_exam` varchar(255) DEFAULT NULL,
  `performance_evaluation_training_material` varchar(255) DEFAULT NULL,
  `performance_evaluation_attendance` varchar(255) DEFAULT NULL,
  `no_of_participants` varchar(255) DEFAULT NULL,
  `training_feedback_obtained` varchar(255) DEFAULT NULL,
  `sit_cert_issued_on_performance_on_attendance` varchar(255) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `cv_shortlisted`
--
DROP TABLE IF EXISTS `cv_shortlisted`;
CREATE TABLE `cv_shortlisted` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `CompanyName` varchar(150) DEFAULT NULL,
  `TDate` varchar(30) DEFAULT NULL,
  `Course_id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Company_Id` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT 0,
  `IsActive` int(11) DEFAULT 1,
  `CompanyReqId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=5796 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `cvchild`
--
DROP TABLE IF EXISTS `cvchild`;
CREATE TABLE `cvchild` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `CV_Id` int(11) DEFAULT NULL,
  `Student_Name` varchar(150) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Result` varchar(20) DEFAULT NULL,
  `Student_Code` bigint(20) DEFAULT NULL,
  `Placement` varchar(6) DEFAULT NULL,
  `Sended` varchar(6) DEFAULT NULL,
  `Batch_id` int(11) DEFAULT NULL,
  `Remark` text DEFAULT NULL,
  `PlacedBy` varchar(10) DEFAULT NULL,
  `Placement_Type` varchar(10) DEFAULT NULL,
  `Placement_Block` varchar(6) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `Placement_BlockReason` varchar(100) DEFAULT NULL,
  `BlockReason_Remark` text DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=MyISAM AUTO_INCREMENT=26560 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `deputation_candidates`
--
DROP TABLE IF EXISTS `deputation_candidates`;
CREATE TABLE `deputation_candidates` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Position_Id` int(11) NOT NULL,
  `Deputation_Id` int(11) DEFAULT NULL,
  `Candidate_Name` varchar(255) DEFAULT NULL,
  `Mobile` varchar(100) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Status` varchar(30) DEFAULT 'Shortlisted',
  `Offer_Letter_Shared` tinyint(1) DEFAULT 0,
  `Offer_Letter_Date` varchar(50) DEFAULT NULL,
  `Joining_Date` varchar(50) DEFAULT NULL,
  `Notes` mediumtext DEFAULT NULL,
  `IsDelete` tinyint(1) DEFAULT 0,
  `CreatedBy` varchar(100) DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ID`),
  KEY `idx_position` (`Position_Id`),
  KEY `idx_deputation` (`Deputation_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `deputation_entries`
--
DROP TABLE IF EXISTS `deputation_entries`;
CREATE TABLE `deputation_entries` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Const_Id` int(11) DEFAULT NULL,
  `Company_Name` varchar(255) DEFAULT NULL,
  `Is_Other` tinyint(1) DEFAULT 0,
  `Agreement_Status` varchar(50) DEFAULT NULL,
  `JD_Shared` tinyint(1) DEFAULT 0,
  `JD_Shared_Date` varchar(50) DEFAULT NULL,
  `IsDelete` tinyint(1) DEFAULT 0,
  `CreatedBy` varchar(100) DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Contact_Name` varchar(255) DEFAULT NULL,
  `Contact_Designation` varchar(255) DEFAULT NULL,
  `Contact_Mobile` varchar(100) DEFAULT NULL,
  `Contact_Mobile2` varchar(100) DEFAULT NULL,
  `Contact_Email` varchar(255) DEFAULT NULL,
  `Initial_Discussion` mediumtext DEFAULT NULL,
  `Current_Phase` varchar(30) DEFAULT 'proposal',
  `Proposal_Status` varchar(30) DEFAULT NULL,
  `Agreement_Title` varchar(255) DEFAULT NULL,
  `Agreement_Attachment` varchar(500) DEFAULT NULL,
  `Deputation_Percentage` varchar(50) DEFAULT NULL,
  `Negotiation_Decision` varchar(30) DEFAULT NULL,
  `Tenure_Details` mediumtext DEFAULT NULL,
  `Followup_Id` int(11) DEFAULT NULL,
  `Service_Type` varchar(30) DEFAULT 'deputation',
  `Agreement_Client_Name` varchar(500) DEFAULT NULL,
  `Agreement_Client_Address` mediumtext DEFAULT NULL,
  `Agreement_Date` varchar(50) DEFAULT NULL,
  `Agreement_Scope` mediumtext DEFAULT NULL,
  `Fee_Annual_CTC` varchar(100) DEFAULT NULL,
  `Fee_Internship` varchar(100) DEFAULT NULL,
  `Fee_Deputation_Monthly` varchar(100) DEFAULT NULL,
  `Fee_Replacement_Period` varchar(100) DEFAULT NULL,
  `Fee_Payment_Credit` varchar(100) DEFAULT NULL,
  `Fee_Agreement_Tenure` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `idx_const` (`Const_Id`),
  KEY `idx_deleted` (`IsDelete`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `deputation_negotiations`
--
DROP TABLE IF EXISTS `deputation_negotiations`;
CREATE TABLE `deputation_negotiations` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Deputation_Id` int(11) NOT NULL,
  `Negotiation_Date` varchar(50) DEFAULT NULL,
  `Discussion` mediumtext DEFAULT NULL,
  `CreatedBy` varchar(100) DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT current_timestamp(),
  `Phase` varchar(20) DEFAULT 'negotiation',
  PRIMARY KEY (`ID`),
  KEY `idx_deputation` (`Deputation_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `deputation_positions`
--
DROP TABLE IF EXISTS `deputation_positions`;
CREATE TABLE `deputation_positions` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Deputation_Id` int(11) NOT NULL,
  `Position_Title` varchar(255) DEFAULT NULL,
  `Total_Requirement` int(11) DEFAULT NULL,
  `Short_Description` mediumtext DEFAULT NULL,
  `Working_Location` varchar(255) DEFAULT NULL,
  `Status` varchar(20) DEFAULT 'Open',
  `Interview_Arrangement` mediumtext DEFAULT NULL,
  `Went_Ahead` tinyint(1) DEFAULT 0,
  `Joining_Date` varchar(50) DEFAULT NULL,
  `Closed_By` varchar(100) DEFAULT NULL,
  `Closing_Notes` mediumtext DEFAULT NULL,
  `IsDelete` tinyint(1) DEFAULT 0,
  `CreatedBy` varchar(100) DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`ID`),
  KEY `idx_deputation` (`Deputation_Id`),
  KEY `idx_status` (`Status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `discussion`
--
DROP TABLE IF EXISTS `discussion`;
CREATE TABLE `discussion` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Disscussion_date` datetime NOT NULL,
  `Remark` varchar(150) NOT NULL,
  `Department` varchar(150) NOT NULL,
  `Student_id` int(11) NOT NULL,
  `Duration` varchar(150) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `doc_19`
--
DROP TABLE IF EXISTS `doc_19`;
CREATE TABLE `doc_19` (
  `ID` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Reg_Id` varchar(10) DEFAULT NULL,
  `FileName` varchar(15) DEFAULT NULL,
  `FileType` varchar(11) DEFAULT NULL,
  `Inquiry_Id` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `documents`
--
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_id` int(11) DEFAULT NULL,
  `doc_name` text DEFAULT NULL,
  `upload_image` varchar(150) DEFAULT NULL,
  `File_Data` longblob DEFAULT NULL,
  `Content_Type` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49220 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `emp_emailcredential`
--
DROP TABLE IF EXISTS `emp_emailcredential`;
CREATE TABLE `emp_emailcredential` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Id` int(11) NOT NULL,
  `SmtpHost` varchar(255) NOT NULL,
  `Port` int(11) NOT NULL,
  `UseCredential` tinyint(1) DEFAULT 0,
  `EnableSSL` tinyint(1) DEFAULT 0,
  `CreatedBy` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT NULL,
  `UpdatedBy` varchar(100) DEFAULT NULL,
  `UpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `Emp_Id` (`Emp_Id`),
  CONSTRAINT `Emp_EmailCredential_ibfk_1` FOREIGN KEY (`Emp_Id`) REFERENCES `office_employee_mst` (`Emp_Id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `emp_intimesetting`
--
DROP TABLE IF EXISTS `emp_intimesetting`;
CREATE TABLE `emp_intimesetting` (
  `IntimeID` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_ID` int(11) NOT NULL,
  `InTime` time NOT NULL,
  `FromDate` date NOT NULL,
  `ToDate` date NOT NULL,
  `CreatedAt` datetime DEFAULT current_timestamp(),
  `UpdatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `CreatedBy` varchar(100) DEFAULT NULL,
  `UpdatedBy` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`IntimeID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `emp_leave_structure`
--
DROP TABLE IF EXISTS `emp_leave_structure`;
CREATE TABLE `emp_leave_structure` (
  `LeaveID` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Id` varchar(255) DEFAULT NULL,
  `PrivilegeLeave` int(11) DEFAULT NULL,
  `SickLeave` int(11) DEFAULT NULL,
  `CasualLeave` int(11) DEFAULT NULL,
  `FromDate` date DEFAULT NULL,
  `ToDate` date DEFAULT NULL,
  `AttainDate` date DEFAULT NULL,
  `CreatedAt` datetime DEFAULT current_timestamp(),
  `CreatedBy` varchar(255) DEFAULT NULL,
  `UpdatedAt` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `UpdatedBy` varchar(255) DEFAULT NULL,
  `Deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`LeaveID`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `emp_salarystructure`
--
DROP TABLE IF EXISTS `emp_salarystructure`;
CREATE TABLE `emp_salarystructure` (
  `SalaryID` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_ID` int(11) NOT NULL,
  `FromDate` date NOT NULL,
  `ToDate` date NOT NULL,
  `SalaryType` varchar(50) DEFAULT NULL,
  `StdWHrs` decimal(5,2) DEFAULT NULL,
  `StdWHRate` decimal(10,2) DEFAULT NULL,
  `OTRate` decimal(10,2) DEFAULT NULL,
  `BasicDA_Percent` decimal(5,2) DEFAULT NULL,
  `DA_Amount` decimal(10,2) DEFAULT NULL,
  `HRA_Percent` decimal(5,2) DEFAULT NULL,
  `Call_Percent` decimal(5,2) DEFAULT NULL,
  `Convey_Percent` decimal(5,2) DEFAULT NULL,
  `Other_Percent` decimal(5,2) DEFAULT NULL,
  `GrossAmount` decimal(10,2) DEFAULT NULL,
  `BasicAmount` decimal(10,2) DEFAULT NULL,
  `DA_Component` decimal(10,2) DEFAULT NULL,
  `HRA_Amount` decimal(10,2) DEFAULT NULL,
  `Call_Amount` decimal(10,2) DEFAULT NULL,
  `Convey_Amount` decimal(10,2) DEFAULT NULL,
  `Other_Amount` decimal(10,2) DEFAULT NULL,
  `OT` tinyint(1) DEFAULT 0,
  `PT` tinyint(1) DEFAULT 0,
  `TDS` tinyint(1) DEFAULT 0,
  `MLWF` tinyint(1) DEFAULT 0,
  `ESIC` tinyint(1) DEFAULT 0,
  `Leaves` tinyint(1) DEFAULT 0,
  `CreatedAt` datetime DEFAULT current_timestamp(),
  `CreatedBy` varchar(100) DEFAULT NULL,
  `UpdatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `UpdatedBy` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`SalaryID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `emp_weekly_off`
--
DROP TABLE IF EXISTS `emp_weekly_off`;
CREATE TABLE `emp_weekly_off` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Id` int(11) NOT NULL,
  `WeekDay` varchar(20) NOT NULL,
  `DateFrom` date NOT NULL,
  `ToDate` date NOT NULL,
  `CreatedAt` datetime DEFAULT current_timestamp(),
  `CreatedBy` varchar(100) DEFAULT NULL,
  `UpdatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `UpdatedBy` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `Emp_Id` (`Emp_Id`),
  CONSTRAINT `Emp_Weekly_Off_ibfk_1` FOREIGN KEY (`Emp_Id`) REFERENCES `office_employee_mst` (`Emp_Id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `emp_work_experience`
--
DROP TABLE IF EXISTS `emp_work_experience`;
CREATE TABLE `emp_work_experience` (
  `ExperienceID` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Id` int(11) DEFAULT NULL,
  `Company` varchar(255) DEFAULT NULL,
  `BusinessNature` varchar(255) DEFAULT NULL,
  `Designation` varchar(255) DEFAULT NULL,
  `Address` text DEFAULT NULL,
  `City` varchar(100) DEFAULT NULL,
  `LastDate` date DEFAULT NULL,
  `Telephone` varchar(20) DEFAULT NULL,
  `Duration` varchar(100) DEFAULT NULL,
  `GrossSalary` decimal(10,2) DEFAULT NULL,
  `NetSalary` decimal(10,2) DEFAULT NULL,
  `LeaveReason` text DEFAULT NULL,
  `CreatedAt` timestamp NULL DEFAULT current_timestamp(),
  `UpdatedAt` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `CreatedBy` varchar(100) DEFAULT NULL,
  `UpdatedBy` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ExperienceID`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `exam_taken_child`
--
DROP TABLE IF EXISTS `exam_taken_child`;
CREATE TABLE `exam_taken_child` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Take_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Name` varchar(100) DEFAULT NULL,
  `Marks_Given` varchar(50) DEFAULT NULL,
  `Marks_from` varchar(50) DEFAULT NULL,
  `Status` varchar(20) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM AUTO_INCREMENT=33581 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `exam_taken_dummy`
--
DROP TABLE IF EXISTS `exam_taken_dummy`;
CREATE TABLE `exam_taken_dummy` (
  `Take_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Exam_Id` int(11) DEFAULT NULL,
  `Exam_Dt` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `faculty_acadamic_record`
--
DROP TABLE IF EXISTS `faculty_acadamic_record`;
CREATE TABLE `faculty_acadamic_record` (
  `Academic_Id` int(11) DEFAULT NULL,
  `Faculty_Id` int(11) DEFAULT NULL,
  `Aca_Qualification` varchar(50) DEFAULT NULL,
  `Institute` varchar(63) DEFAULT NULL,
  `Year` varchar(9) DEFAULT NULL,
  `Grade` varchar(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `faculty_discussion`
--
DROP TABLE IF EXISTS `faculty_discussion`;
CREATE TABLE `faculty_discussion` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Faculty_Id` int(11) DEFAULT NULL,
  `Remark` text DEFAULT NULL,
  `Department` varchar(20) DEFAULT NULL,
  `DateAdded` varchar(25) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `Dis_date` varchar(25) DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `faculty_document`
--
DROP TABLE IF EXISTS `faculty_document`;
CREATE TABLE `faculty_document` (
  `Id` int(11) DEFAULT NULL,
  `FacultyId` int(11) DEFAULT NULL,
  `FileName` varchar(200) DEFAULT NULL,
  `FileType` varchar(50) DEFAULT NULL,
  `DateAdded` varchar(100) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `faculty_master`
--
DROP TABLE IF EXISTS `faculty_master`;
CREATE TABLE `faculty_master` (
  `Faculty_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Faculty_Code` int(11) DEFAULT NULL,
  `Faculty_Name` varchar(100) DEFAULT NULL,
  `Married` varchar(7) DEFAULT NULL,
  `DOB` varchar(20) DEFAULT NULL,
  `Nationality` varchar(30) DEFAULT NULL,
  `Faculty_Type` varchar(30) DEFAULT NULL,
  `Office_Tel` varchar(10) DEFAULT NULL,
  `Res_Tel` varchar(10) DEFAULT NULL,
  `Mobile` varchar(15) DEFAULT NULL,
  `EMail` varchar(30) DEFAULT NULL,
  `Present_Address` text DEFAULT NULL,
  `Present_City` varchar(18) DEFAULT NULL,
  `Present_State` varchar(13) DEFAULT NULL,
  `Present_Country` varchar(11) DEFAULT NULL,
  `Present_Pin` varchar(8) DEFAULT NULL,
  `Present_Tel` varchar(18) DEFAULT NULL,
  `Permanent_Address` text DEFAULT NULL,
  `Permanent_City` varchar(60) DEFAULT NULL,
  `Permanent_State` varchar(13) DEFAULT NULL,
  `Permanent_Country` varchar(11) DEFAULT NULL,
  `Permanent_Pin` varchar(8) DEFAULT NULL,
  `Permanent_Tel` varchar(14) DEFAULT NULL,
  `Service_Offered` varchar(47) DEFAULT NULL,
  `Specialization` varchar(50) DEFAULT NULL,
  `Experience` varchar(20) DEFAULT NULL,
  `Company_Name` varchar(41) DEFAULT NULL,
  `Company_Address` varchar(500) DEFAULT NULL,
  `Company_Phone` varchar(19) DEFAULT NULL,
  `Interview_Date` varchar(25) DEFAULT NULL,
  `Working_At` varchar(10) DEFAULT NULL,
  `Qualified` varchar(3) DEFAULT NULL,
  `Joining_Date` varchar(20) DEFAULT NULL,
  `Comments` varchar(109) DEFAULT NULL,
  `Interviewer` varchar(18) DEFAULT NULL,
  `Sal_Struct` varchar(7) DEFAULT NULL,
  `Salary` int(11) DEFAULT NULL,
  `Date_added` varchar(7) DEFAULT NULL,
  `TDS` varchar(10) DEFAULT NULL,
  `PAN` varchar(15) DEFAULT NULL,
  `Resigned` varchar(10) DEFAULT NULL,
  `InvoiceName` varchar(100) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `CourseId` int(11) DEFAULT NULL,
  `DesignExp` decimal(3,1) DEFAULT NULL,
  `KnowSw` varchar(94) DEFAULT NULL,
  `Working_Status` varchar(11) DEFAULT NULL,
  `TrainingCategory` varchar(13) DEFAULT NULL,
  `Interview_Status` varchar(9) DEFAULT NULL,
  `Reference_by` varchar(4) DEFAULT NULL,
  `BreakTimeMinutes` int(11) DEFAULT 60,
  `InTime` time NOT NULL DEFAULT '08:00:00',
  `OutTime` time NOT NULL DEFAULT '17:30:00',
  `HourlyRate` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`Faculty_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=499 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `faculty_salary`
--
DROP TABLE IF EXISTS `faculty_salary`;
CREATE TABLE `faculty_salary` (
  `Salary_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Faculty_Id` int(11) DEFAULT NULL,
  `Sal_Month` varchar(100) DEFAULT NULL,
  `Sal_Year` varchar(100) DEFAULT NULL,
  `Faculty_Type` varchar(100) DEFAULT NULL,
  `Salary_struct` varchar(100) DEFAULT NULL,
  `Rate` float DEFAULT NULL,
  `Total_Hours` float DEFAULT NULL,
  `Salary` float DEFAULT NULL,
  `Bonus` float DEFAULT NULL,
  `Award` float DEFAULT NULL,
  `Other_Inc` float DEFAULT NULL,
  `Tot_Inc` float DEFAULT NULL,
  `TDS_Per` float DEFAULT NULL,
  `TDS` float DEFAULT NULL,
  `Advance` float DEFAULT NULL,
  `Other_Ded` float DEFAULT NULL,
  `Total_Ded` float DEFAULT NULL,
  `Net_Payment` float DEFAULT NULL,
  `Payment_Type` varchar(100) DEFAULT NULL,
  `Cheque_No` float DEFAULT NULL,
  `Payment_Dt` varchar(100) DEFAULT NULL,
  `Date_Added` varchar(100) DEFAULT NULL,
  `Remark` varchar(255) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `NEFT_No` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Salary_Id`)
) ENGINE=MyISAM AUTO_INCREMENT=3134 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `feedback1`
--
DROP TABLE IF EXISTS `feedback1`;
CREATE TABLE `feedback1` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `course` varchar(255) DEFAULT NULL,
  `batch` varchar(255) DEFAULT NULL,
  `student` varchar(250) DEFAULT NULL,
  `date` int(11) DEFAULT NULL,
  `feedback` varchar(250) DEFAULT NULL,
  `srno` varchar(15) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `fees_details`
--
DROP TABLE IF EXISTS `fees_details`;
CREATE TABLE `fees_details` (
  `Fees_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Fees_Code` varchar(8) DEFAULT NULL,
  `NFees_Code1` varchar(10) DEFAULT NULL,
  `NFees_Code2` varchar(10) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Installment_Id` varchar(10) DEFAULT NULL,
  `Admission_Id` int(11) DEFAULT NULL,
  `Cheque_Date` varchar(7) DEFAULT NULL,
  `Payment_Type` varchar(10) DEFAULT NULL,
  `Cheque_No` varchar(50) DEFAULT NULL,
  `Cheque_Bank` varchar(10) DEFAULT NULL,
  `Cheque_Branch` varchar(6) DEFAULT NULL,
  `Amount` int(11) DEFAULT NULL,
  `Service_Tax` int(11) DEFAULT NULL,
  `Total_Amt` int(11) DEFAULT NULL,
  `TypeR` varchar(1) DEFAULT NULL,
  `UnPaid_Amt` varchar(10) DEFAULT NULL,
  `Amt_Word` varchar(48) DEFAULT NULL,
  `Date_Added` varchar(15) DEFAULT NULL,
  `OldFees_Code` varchar(10) DEFAULT NULL,
  `Notes` varchar(67) DEFAULT NULL,
  `RDate` varchar(15) DEFAULT NULL,
  `Print` int(11) DEFAULT NULL,
  `FeesMonth` int(11) DEFAULT NULL,
  `FeesYear` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `InvoiceCode` varchar(10) DEFAULT NULL,
  `InvoiceDate` varchar(15) DEFAULT NULL,
  `PaymentId` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`Fees_Id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `fees_notes`
--
DROP TABLE IF EXISTS `fees_notes`;
CREATE TABLE `fees_notes` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Perticular` varchar(69) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `fees_structure`
--
DROP TABLE IF EXISTS `fees_structure`;
CREATE TABLE `fees_structure` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(100) DEFAULT NULL,
  `basic_inr` varchar(50) DEFAULT NULL,
  `servicetax_inr` varchar(50) DEFAULT NULL,
  `total_inr` varchar(50) DEFAULT NULL,
  `basic_doller` varchar(50) DEFAULT NULL,
  `servicetax_doller` varchar(50) DEFAULT NULL,
  `total_doller` varchar(50) DEFAULT NULL,
  `actualfees` varchar(50) DEFAULT NULL,
  `fullfees` varchar(50) DEFAULT NULL,
  `installment` varchar(50) DEFAULT NULL,
  `duedate` varchar(50) DEFAULT NULL,
  `paymode` varchar(50) DEFAULT NULL,
  `bdateamt` varchar(50) DEFAULT NULL,
  `adateamt` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `final_exam_master`
--
DROP TABLE IF EXISTS `final_exam_master`;
CREATE TABLE `final_exam_master` (
  `Take_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Marks` int(11) DEFAULT NULL,
  `Test_Id` int(11) DEFAULT NULL,
  `Test_Dt` varchar(15) DEFAULT NULL,
  `Test_No` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Take_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=725 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `finance_cashflow`
--
DROP TABLE IF EXISTS `finance_cashflow`;
CREATE TABLE `finance_cashflow` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `type` enum('Payment','Receipt') NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` varchar(500) NOT NULL DEFAULT '',
  `payment` decimal(15,2) NOT NULL DEFAULT 0.00,
  `receipt` decimal(15,2) NOT NULL DEFAULT 0.00,
  `ref_no` varchar(200) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `company` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2718 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_cashflow_projection`
--
DROP TABLE IF EXISTS `finance_cashflow_projection`;
CREATE TABLE `finance_cashflow_projection` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `month` varchar(50) NOT NULL,
  `revenue` decimal(15,2) NOT NULL DEFAULT 0.00,
  `expenses` decimal(15,2) NOT NULL DEFAULT 0.00,
  `loan_repayment` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_cbd_batch_marketing`
--
DROP TABLE IF EXISTS `finance_cbd_batch_marketing`;
CREATE TABLE `finance_cbd_batch_marketing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_name` varchar(200) NOT NULL DEFAULT '',
  `batch_start_date` date DEFAULT NULL,
  `batch_announcement_date` date DEFAULT NULL,
  `meta_ads_date` date DEFAULT NULL,
  `flyer_status` enum('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `announcement_status` enum('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `meta_ads_status` enum('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `training_name` varchar(200) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_batch_start` (`batch_start_date`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_cbd_monthly`
--
DROP TABLE IF EXISTS `finance_cbd_monthly`;
CREATE TABLE `finance_cbd_monthly` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `month` char(7) DEFAULT NULL,
  `actual_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `target_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_cbd_performance`
--
DROP TABLE IF EXISTS `finance_cbd_performance`;
CREATE TABLE `finance_cbd_performance` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `programme` varchar(300) NOT NULL,
  `frequency` int(11) NOT NULL DEFAULT 0,
  `target_students` int(11) NOT NULL DEFAULT 0,
  `achieved_students` int(11) NOT NULL DEFAULT 0,
  `fees_target` decimal(15,2) NOT NULL DEFAULT 0.00,
  `fees_received` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_ct_monthly`
--
DROP TABLE IF EXISTS `finance_ct_monthly`;
CREATE TABLE `finance_ct_monthly` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `month` char(7) DEFAULT NULL,
  `actual_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `target_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_ct_performance`
--
DROP TABLE IF EXISTS `finance_ct_performance`;
CREATE TABLE `finance_ct_performance` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `month` varchar(50) NOT NULL,
  `training_name` varchar(300) NOT NULL,
  `count` int(11) NOT NULL DEFAULT 0,
  `cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `target` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `duration_of_program` varchar(100) NOT NULL DEFAULT '',
  `frequency_conducted` int(11) NOT NULL DEFAULT 0,
  `target_frequency_batches` int(11) NOT NULL DEFAULT 0,
  `min_students_per_batch` int(11) NOT NULL DEFAULT 0,
  `students_admitted_yearly` int(11) NOT NULL DEFAULT 0,
  `yearly_students_target` int(11) NOT NULL DEFAULT 0,
  `company` varchar(200) NOT NULL DEFAULT '',
  `cost_from_company` decimal(14,2) NOT NULL DEFAULT 0.00,
  `trainer_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `travelling_expenses` decimal(14,2) NOT NULL DEFAULT 0.00,
  `month_year` char(7) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_ct_yearly`
--
DROP TABLE IF EXISTS `finance_ct_yearly`;
CREATE TABLE `finance_ct_yearly` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `training_name` varchar(200) NOT NULL,
  `duration_of_program` varchar(100) DEFAULT NULL,
  `frequency_conducted` int(11) NOT NULL DEFAULT 0,
  `target_frequency_batches` int(11) NOT NULL DEFAULT 0,
  `min_students_per_batch` int(11) NOT NULL DEFAULT 0,
  `students_admitted_yearly` int(11) NOT NULL DEFAULT 0,
  `yearly_students_target` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_debt_plan`
--
DROP TABLE IF EXISTS `finance_debt_plan`;
CREATE TABLE `finance_debt_plan` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `bank_name` varchar(200) NOT NULL,
  `emi_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `planned_date` date DEFAULT NULL,
  `actual_paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `actual_date` date DEFAULT NULL,
  `status` enum('Pending','Paid','Overdue') NOT NULL DEFAULT 'Pending',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_dept_performance`
--
DROP TABLE IF EXISTS `finance_dept_performance`;
CREATE TABLE `finance_dept_performance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `month_year` varchar(7) NOT NULL,
  `department` varchar(100) NOT NULL,
  `amount_achieved` decimal(15,2) NOT NULL DEFAULT 0.00,
  `target_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expense_actual` decimal(14,2) NOT NULL DEFAULT 0.00,
  `expense_target` decimal(14,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_deputation`
--
DROP TABLE IF EXISTS `finance_deputation`;
CREATE TABLE `finance_deputation` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `month` varchar(50) NOT NULL,
  `actual_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `target_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_loans`
--
DROP TABLE IF EXISTS `finance_loans`;
CREATE TABLE `finance_loans` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `bank_name` varchar(200) NOT NULL,
  `outstanding` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_pending_fees`
--
DROP TABLE IF EXISTS `finance_pending_fees`;
CREATE TABLE `finance_pending_fees` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `student_name` varchar(300) NOT NULL,
  `batch` varchar(200) NOT NULL,
  `total_fees` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `due_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_pending_invoices`
--
DROP TABLE IF EXISTS `finance_pending_invoices`;
CREATE TABLE `finance_pending_invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_name` varchar(200) NOT NULL,
  `invoice_no` varchar(100) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `invoice_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('Pending','Paid','Overdue') NOT NULL DEFAULT 'Pending',
  `description` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `department` varchar(100) NOT NULL DEFAULT 'Projects',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_due_date` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_projects`
--
DROP TABLE IF EXISTS `finance_projects`;
CREATE TABLE `finance_projects` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `month` varchar(50) NOT NULL,
  `actual_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `target_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `finance_salary_cashflow`
--
DROP TABLE IF EXISTS `finance_salary_cashflow`;
CREATE TABLE `finance_salary_cashflow` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `month_year` varchar(20) NOT NULL COMMENT 'e.g. 2026-05',
  `total_payable` decimal(15,2) NOT NULL DEFAULT 0.00,
  `salary_paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `salary_pending` decimal(15,2) NOT NULL DEFAULT 0.00,
  `next_payout` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_month_year` (`month_year`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `generate_final_child`
--
DROP TABLE IF EXISTS `generate_final_child`;
CREATE TABLE `generate_final_child` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Gen_id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Code` varchar(150) DEFAULT NULL,
  `Student_Name` varchar(150) DEFAULT NULL,
  `Ass1_Given` int(11) DEFAULT 0,
  `Ass1_Max` int(11) DEFAULT NULL,
  `Ass1_Status` varchar(15) DEFAULT NULL,
  `Ass2_Given` int(11) DEFAULT NULL,
  `Ass2_Max` int(11) DEFAULT NULL,
  `Ass2_Status` varchar(15) DEFAULT NULL,
  `Ass3_Given` int(11) DEFAULT NULL,
  `Ass3_Max` int(11) DEFAULT NULL,
  `Ass3_Status` varchar(11) DEFAULT NULL,
  `Ass4_Given` int(11) DEFAULT NULL,
  `Ass4_Max` int(11) DEFAULT NULL,
  `Ass4_Status` varchar(11) DEFAULT NULL,
  `Ass5_Given` int(11) DEFAULT NULL,
  `Ass5_Max` int(11) DEFAULT NULL,
  `Ass5_Status` varchar(11) DEFAULT NULL,
  `Ass6_Given` int(11) DEFAULT NULL,
  `Ass6_Max` int(11) DEFAULT NULL,
  `Ass6_Status` varchar(15) DEFAULT NULL,
  `Ass7_Given` int(11) DEFAULT NULL,
  `Ass7_Max` int(11) DEFAULT NULL,
  `Ass7_Status` varchar(15) DEFAULT NULL,
  `Ass8_Given` int(11) DEFAULT NULL,
  `Ass8_Max` int(11) DEFAULT NULL,
  `Ass8_Status` varchar(15) DEFAULT NULL,
  `Ass9_Given` int(11) DEFAULT NULL,
  `Ass9_Max` int(11) DEFAULT NULL,
  `Ass9_Status` varchar(15) DEFAULT NULL,
  `Ass10_Given` int(11) DEFAULT NULL,
  `Ass10_Max` int(11) DEFAULT NULL,
  `Ass10_Status` varchar(15) DEFAULT NULL,
  `Ass_Percent` varchar(50) DEFAULT NULL,
  `Test1_Given` int(11) DEFAULT NULL,
  `Test1_Max` int(11) DEFAULT NULL,
  `Test1_Status` varchar(11) DEFAULT NULL,
  `Test2_Given` int(11) DEFAULT NULL,
  `Test2_Max` int(11) DEFAULT NULL,
  `Test2_Status` varchar(11) DEFAULT NULL,
  `Test3_Given` int(11) DEFAULT NULL,
  `Test3_Max` int(11) DEFAULT NULL,
  `Test3_Status` varchar(15) DEFAULT NULL,
  `Test4_Given` int(11) DEFAULT NULL,
  `Test4_Max` int(11) DEFAULT NULL,
  `Test4_Status` varchar(15) DEFAULT NULL,
  `Test5_Given` int(11) DEFAULT NULL,
  `Test5_Max` int(11) DEFAULT NULL,
  `Test5_Status` varchar(15) DEFAULT NULL,
  `Test6_Given` int(11) DEFAULT NULL,
  `Test6_Max` int(11) DEFAULT NULL,
  `Test6_Status` varchar(15) DEFAULT NULL,
  `Test7_Given` int(11) DEFAULT NULL,
  `Test7_Max` int(11) DEFAULT NULL,
  `Test7_Status` varchar(15) DEFAULT NULL,
  `Test8_Given` int(11) DEFAULT NULL,
  `Test8_Max` int(11) DEFAULT NULL,
  `Test8_Status` varchar(15) DEFAULT NULL,
  `Test9_Given` int(11) DEFAULT NULL,
  `Test9_Max` int(11) DEFAULT NULL,
  `Test9_Status` varchar(15) DEFAULT NULL,
  `Test10_Given` int(11) DEFAULT NULL,
  `Test10_Max` int(11) DEFAULT NULL,
  `Test10_Status` varchar(15) DEFAULT NULL,
  `Test_Percent` varchar(50) DEFAULT NULL,
  `Viva_Percent` varchar(50) DEFAULT NULL,
  `Final1_Given` int(11) DEFAULT NULL,
  `Final1_Max` int(11) DEFAULT NULL,
  `Final1_Status` varchar(10) DEFAULT NULL,
  `Final2_Given` varchar(200) DEFAULT NULL,
  `Final2_Max` int(11) DEFAULT NULL,
  `Final2_Status` varchar(10) DEFAULT NULL,
  `Final3_Given` int(11) DEFAULT NULL,
  `Final3_Max` int(11) DEFAULT NULL,
  `Final3_Status` varchar(10) DEFAULT NULL,
  `Final_Percent` varchar(50) DEFAULT NULL,
  `Full_Attend` varchar(25) DEFAULT NULL,
  `Total_Lectures` int(11) DEFAULT NULL,
  `AttenLectures` int(11) DEFAULT NULL,
  `Absents` int(11) DEFAULT NULL,
  `Full_Attendance` varchar(25) DEFAULT NULL,
  `Total_Assignments` int(11) DEFAULT NULL,
  `Given_Assignments` int(11) DEFAULT NULL,
  `Total_Tests` int(11) DEFAULT NULL,
  `Given_Tests` int(11) DEFAULT NULL,
  `Discipline` varchar(100) DEFAULT NULL,
  `Final_Result_Percent` varchar(50) DEFAULT NULL,
  `Grade` varchar(20) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45755 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `generate_final_result`
--
DROP TABLE IF EXISTS `generate_final_result`;
CREATE TABLE `generate_final_result` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Result_date` varchar(20) DEFAULT NULL,
  `Print_date` varchar(20) DEFAULT NULL,
  `Label1` varchar(50) DEFAULT NULL,
  `Faculty1` varchar(50) DEFAULT NULL,
  `Label2` varchar(50) DEFAULT NULL,
  `Faculty2` varchar(50) DEFAULT NULL,
  `Approve` varchar(50) DEFAULT NULL,
  `Start_date` varchar(50) DEFAULT NULL,
  `End_date` varchar(50) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=1134 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `grades`
--
DROP TABLE IF EXISTS `grades`;
CREATE TABLE `grades` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `start_from` decimal(10,2) DEFAULT NULL,
  `end_from` decimal(10,2) DEFAULT NULL,
  `grade` varchar(255) DEFAULT NULL,
  `created_date` varchar(255) DEFAULT NULL,
  `updated_date` varchar(200) DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=297 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `holiday_master`
--
DROP TABLE IF EXISTS `holiday_master`;
CREATE TABLE `holiday_master` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Holiday` varchar(21) DEFAULT NULL,
  `Date_of_Holiday` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `inquiry_contact_log`
--
DROP TABLE IF EXISTS `inquiry_contact_log`;
CREATE TABLE `inquiry_contact_log` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Inquiry_Id` int(11) NOT NULL,
  `Channel` varchar(40) NOT NULL,
  `Created_By` int(11) DEFAULT NULL,
  `Created_At` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`Id`),
  KEY `idx_inquiry_channel` (`Inquiry_Id`,`Channel`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `intime_settings`
--
DROP TABLE IF EXISTS `intime_settings`;
CREATE TABLE `intime_settings` (
  `Intime_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Id` int(11) DEFAULT NULL,
  `In_Time` time NOT NULL,
  `Date_From` date NOT NULL,
  `Date_To` date NOT NULL,
  PRIMARY KEY (`Intime_Id`),
  KEY `Emp_Id` (`Emp_Id`),
  CONSTRAINT `Intime_Settings_ibfk_1` FOREIGN KEY (`Emp_Id`) REFERENCES `office_employee_mst` (`Emp_Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `lecture_taken_child`
--
DROP TABLE IF EXISTS `lecture_taken_child`;
CREATE TABLE `lecture_taken_child` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Take_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Name` varchar(150) DEFAULT NULL,
  `Student_Reaction` varchar(100) DEFAULT NULL,
  `Student_Atten` varchar(50) DEFAULT 'Present',
  `In_Time` varchar(23) DEFAULT NULL,
  `Lect_Time` varchar(23) DEFAULT NULL,
  `Late` varchar(50) DEFAULT NULL,
  `Out_Time` varchar(50) DEFAULT NULL,
  `AssignmentReceived` varchar(50) DEFAULT 'No',
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=2494709 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `lecture_taken_master`
--
DROP TABLE IF EXISTS `lecture_taken_master`;
CREATE TABLE `lecture_taken_master` (
  `Take_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Lecture_Id` int(11) DEFAULT NULL,
  `Lecture_Name` text DEFAULT NULL,
  `Faculty_Id` int(11) DEFAULT NULL,
  `Faculty_Start` varchar(100) DEFAULT NULL,
  `Faculty_End` varchar(100) DEFAULT NULL,
  `Material` varchar(100) DEFAULT NULL,
  `Take_Dt` varchar(25) DEFAULT NULL,
  `Lecture_Start` varchar(100) DEFAULT NULL,
  `Lecture_End` varchar(100) DEFAULT NULL,
  `Duration` varchar(50) DEFAULT NULL,
  `ClassRoom` varchar(50) DEFAULT NULL,
  `Assign_Start` varchar(30) DEFAULT NULL,
  `Assign_End` varchar(30) DEFAULT NULL,
  `Documents` varchar(100) DEFAULT NULL,
  `Assign_Given` varchar(100) DEFAULT NULL,
  `Assignment_Id` int(11) DEFAULT NULL,
  `Test_Given` varchar(100) DEFAULT NULL,
  `Test_Id` int(11) DEFAULT NULL,
  `Topic` text DEFAULT NULL,
  `Next_Planning` varchar(100) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Take_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=37226 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `lecutre_taken_master_dummy`
--
DROP TABLE IF EXISTS `lecutre_taken_master_dummy`;
CREATE TABLE `lecutre_taken_master_dummy` (
  `Take_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Lecture_Id` int(11) DEFAULT NULL,
  `Lecture_Name` varchar(25) DEFAULT NULL,
  `Faculty_Id` int(11) DEFAULT NULL,
  `Faculty_Start` varchar(7) DEFAULT NULL,
  `Faculty_End` varchar(7) DEFAULT NULL,
  `Material` varchar(2) DEFAULT NULL,
  `Take_Dt` varchar(10) DEFAULT NULL,
  `Lecture_Start` varchar(18) DEFAULT NULL,
  `Lecture_End` varchar(18) DEFAULT NULL,
  `Duration` int(11) DEFAULT NULL,
  `ClassRoom` int(11) DEFAULT NULL,
  `Assign_Start` varchar(10) DEFAULT NULL,
  `Assign_End` varchar(10) DEFAULT NULL,
  `Documents` varchar(10) DEFAULT NULL,
  `Assign_Given` varchar(2) DEFAULT NULL,
  `Assignment_Id` int(11) DEFAULT NULL,
  `Test_Given` varchar(2) DEFAULT NULL,
  `Test_Id` int(11) DEFAULT NULL,
  `Topic` varchar(43) DEFAULT NULL,
  `Next_Planning` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `library_book_issue`
--
DROP TABLE IF EXISTS `library_book_issue`;
CREATE TABLE `library_book_issue` (
  `Issue_Id` int(11) DEFAULT NULL,
  `Book_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Book_Code` varchar(14) DEFAULT NULL,
  `Student_Code` bigint(20) DEFAULT NULL,
  `Issue_Dt` varchar(7) DEFAULT NULL,
  `Return_Dt` varchar(7) DEFAULT NULL,
  `Issued_By` varchar(10) DEFAULT NULL,
  `Type_Of_Issue` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `library_book_mst`
--
DROP TABLE IF EXISTS `library_book_mst`;
CREATE TABLE `library_book_mst` (
  `Book_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Book_Name` varchar(172) DEFAULT NULL,
  `Book_Code` varchar(24) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Book_Course` varchar(200) DEFAULT NULL,
  `Book_No` varchar(100) DEFAULT NULL,
  `Book_Copies` int(11) DEFAULT NULL,
  `Author` varchar(41) DEFAULT NULL,
  `Book_Xerox` varchar(3) DEFAULT NULL,
  `Publisher` varchar(100) DEFAULT NULL,
  `Purchase_Dt` varchar(100) DEFAULT NULL,
  `Amount` int(11) DEFAULT NULL,
  `Total_Pages` int(11) DEFAULT NULL,
  `Date_Added` varchar(100) DEFAULT NULL,
  `Remark` varchar(200) DEFAULT NULL,
  `RackNo` varchar(100) DEFAULT NULL,
  `Status` varchar(7) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Book_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=272 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `library_book_return`
--
DROP TABLE IF EXISTS `library_book_return`;
CREATE TABLE `library_book_return` (
  `Return_Id` int(11) DEFAULT NULL,
  `Book_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Book_code` varchar(15) DEFAULT NULL,
  `Student_Code` bigint(20) DEFAULT NULL,
  `Return_Dt` varchar(7) DEFAULT NULL,
  `Type_Of_Issue` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `location_master`
--
DROP TABLE IF EXISTS `location_master`;
CREATE TABLE `location_master` (
  `LocationMaster` varchar(6) DEFAULT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `machine_logs`
--
DROP TABLE IF EXISTS `machine_logs`;
CREATE TABLE `machine_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `EmployeeCode` varchar(150) DEFAULT NULL,
  `LogDate` varchar(150) DEFAULT NULL,
  `SerialNumber` varchar(150) DEFAULT NULL,
  `PunchDirection` varchar(150) DEFAULT NULL,
  `Temperature` varchar(150) DEFAULT NULL,
  `TemperatureState` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=121231 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `meta_ads_batch_scores`
--
DROP TABLE IF EXISTS `meta_ads_batch_scores`;
CREATE TABLE `meta_ads_batch_scores` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `score_date` date NOT NULL,
  `batch_id` int(11) NOT NULL,
  `batch_code` varchar(120) NOT NULL DEFAULT '',
  `course_id` int(11) DEFAULT NULL,
  `course_name` varchar(255) NOT NULL DEFAULT '',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `days_to_start` int(11) NOT NULL DEFAULT 0,
  `max_students` decimal(12,2) NOT NULL DEFAULT 0.00,
  `students_admitted` decimal(12,2) NOT NULL DEFAULT 0.00,
  `seat_gap` decimal(12,2) NOT NULL DEFAULT 0.00,
  `gap_ratio` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `urgency` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `lead_to_admission_rate` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `estimated_cpl` decimal(12,2) DEFAULT NULL,
  `efficiency_score` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `value_score` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `priority_score` decimal(10,6) NOT NULL DEFAULT 0.000000,
  `budget_weight` decimal(12,8) NOT NULL DEFAULT 0.00000000,
  `recommended_budget` decimal(12,2) NOT NULL DEFAULT 0.00,
  `ad_angle` varchar(255) NOT NULL DEFAULT '',
  `snapshot_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_meta_ads_batch_scores` (`score_date`,`batch_id`),
  KEY `idx_meta_ads_batch_score_date` (`score_date`),
  KEY `idx_meta_ads_batch_course` (`course_id`)
) ENGINE=InnoDB AUTO_INCREMENT=147 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `meta_ads_campaign_publish_log`
--
DROP TABLE IF EXISTS `meta_ads_campaign_publish_log`;
CREATE TABLE `meta_ads_campaign_publish_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `meta_campaign_id` varchar(191) DEFAULT NULL,
  `campaign_name` varchar(255) NOT NULL,
  `objective` varchar(64) NOT NULL,
  `publish_status` varchar(32) NOT NULL,
  `effective_status` varchar(64) DEFAULT NULL,
  `ad_account_id` varchar(64) NOT NULL,
  `requested_by` int(11) DEFAULT NULL,
  `request_json` longtext DEFAULT NULL,
  `response_json` longtext DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_meta_campaign_publish_campaign_id` (`meta_campaign_id`),
  KEY `idx_meta_campaign_publish_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `meta_ads_lead_email_click_log`
--
DROP TABLE IF EXISTS `meta_ads_lead_email_click_log`;
CREATE TABLE `meta_ads_lead_email_click_log` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `meta_lead_id` varchar(191) NOT NULL,
  `inquiry_id` int(11) DEFAULT NULL,
  `destination_url` text NOT NULL,
  `ip_address` varchar(100) DEFAULT NULL,
  `user_agent` varchar(512) DEFAULT NULL,
  `referer` text DEFAULT NULL,
  `clicked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_meta_lead_email_click_lead_id` (`meta_lead_id`),
  KEY `idx_meta_lead_email_click_inquiry_id` (`inquiry_id`),
  KEY `idx_meta_lead_email_click_clicked_at` (`clicked_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `meta_ads_lead_sync`
--
DROP TABLE IF EXISTS `meta_ads_lead_sync`;
CREATE TABLE `meta_ads_lead_sync` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `meta_lead_id` varchar(191) NOT NULL,
  `inquiry_id` int(11) DEFAULT NULL,
  `duplicate_of_inquiry_id` int(11) DEFAULT NULL,
  `source_label` varchar(100) NOT NULL DEFAULT 'Meta Ads',
  `contact_source` varchar(100) NOT NULL DEFAULT 'Meta Instant Form',
  `page_id` varchar(191) DEFAULT NULL,
  `page_name` varchar(255) DEFAULT NULL,
  `form_id` varchar(191) DEFAULT NULL,
  `form_name` varchar(255) DEFAULT NULL,
  `campaign_id` varchar(191) DEFAULT NULL,
  `campaign_name` varchar(255) DEFAULT NULL,
  `adset_id` varchar(191) DEFAULT NULL,
  `adset_name` varchar(255) DEFAULT NULL,
  `ad_id` varchar(191) DEFAULT NULL,
  `ad_name` varchar(255) DEFAULT NULL,
  `lead_created_time` varchar(100) DEFAULT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `course_name` varchar(255) DEFAULT NULL,
  `utm_json` longtext DEFAULT NULL,
  `tags_json` longtext DEFAULT NULL,
  `fields_json` longtext DEFAULT NULL,
  `payload_json` longtext DEFAULT NULL,
  `duplicate_reason` varchar(255) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `notifications_sent_at` timestamp NULL DEFAULT NULL,
  `synced_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `applicant_email_sent_at` timestamp NULL DEFAULT NULL,
  `applicant_email_last_error` text DEFAULT NULL,
  `online_state` int(11) DEFAULT NULL,
  `wa_stage` varchar(50) DEFAULT NULL,
  `wa_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`wa_data`)),
  `wa_callback_requested` tinyint(1) DEFAULT 0,
  `wa_admission_link_requested` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_meta_ads_lead_id` (`meta_lead_id`),
  KEY `idx_meta_ads_inquiry_id` (`inquiry_id`),
  KEY `idx_meta_ads_duplicate_inquiry_id` (`duplicate_of_inquiry_id`),
  KEY `idx_meta_ads_campaign_id` (`campaign_id`),
  KEY `idx_meta_ads_form_id` (`form_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1791170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `meta_ads_settings`
--
DROP TABLE IF EXISTS `meta_ads_settings`;
CREATE TABLE `meta_ads_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` longtext DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `mst_batchcategory`
--
DROP TABLE IF EXISTS `mst_batchcategory`;
CREATE TABLE `mst_batchcategory` (
  `BatchCategory` varchar(18) DEFAULT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `Check_for_Others` varchar(3) DEFAULT NULL,
  `Prefix` varchar(10) DEFAULT NULL,
  `Batch_Type` varchar(9) DEFAULT NULL,
  `Description` varchar(42) DEFAULT NULL,
  `ExtendedDays` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `mst_deciplin`
--
DROP TABLE IF EXISTS `mst_deciplin`;
CREATE TABLE `mst_deciplin` (
  `Deciplin` varchar(50) DEFAULT NULL,
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `mst_education`
--
DROP TABLE IF EXISTS `mst_education`;
CREATE TABLE `mst_education` (
  `Education` varchar(17) DEFAULT NULL,
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `office_employee_academic_rec`
--
DROP TABLE IF EXISTS `office_employee_academic_rec`;
CREATE TABLE `office_employee_academic_rec` (
  `Academic_Id` int(11) DEFAULT NULL,
  `Emp_Id` int(11) DEFAULT NULL,
  `Aca_Qualification` varchar(30) DEFAULT NULL,
  `Discipline` varchar(16) DEFAULT NULL,
  `Institute` varchar(49) DEFAULT NULL,
  `Year` varchar(13) DEFAULT NULL,
  `Grade` varchar(120) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `office_employee_annual_training`
--
DROP TABLE IF EXISTS `office_employee_annual_training`;
CREATE TABLE `office_employee_annual_training` (
  `Training_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Id` varchar(1000) DEFAULT NULL,
  `Subject` varchar(16) DEFAULT NULL,
  `Inernal_By` varchar(18) DEFAULT NULL,
  `Identified_By` varchar(22) DEFAULT NULL,
  `Training_Dt` date DEFAULT NULL,
  `Date_Added` date DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`Training_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=290 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `office_employee_mst`
--
DROP TABLE IF EXISTS `office_employee_mst`;
CREATE TABLE `office_employee_mst` (
  `Emp_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Emp_Code` int(11) DEFAULT NULL,
  `FName` varchar(50) DEFAULT NULL,
  `LName` varchar(50) DEFAULT NULL,
  `MName` varchar(50) DEFAULT NULL,
  `Employee_Name` varchar(150) DEFAULT NULL,
  `PFNo` varchar(30) DEFAULT NULL,
  `Dept_Id` int(11) DEFAULT NULL,
  `Designation` varchar(44) DEFAULT NULL,
  `Emp_Type` varchar(100) DEFAULT NULL,
  `DOB` varchar(15) DEFAULT NULL,
  `Married` varchar(7) DEFAULT NULL,
  `Nationality` varchar(50) DEFAULT NULL,
  `Joining_Date` varchar(10) DEFAULT NULL,
  `Present_Status` varchar(50) DEFAULT NULL,
  `Present_Address` varchar(127) DEFAULT NULL,
  `Present_City` varchar(200) DEFAULT NULL,
  `Present_Pin` varchar(50) DEFAULT NULL,
  `Present_State` varchar(50) DEFAULT NULL,
  `Present_Country` varchar(100) DEFAULT NULL,
  `Present_Tel` varchar(21) DEFAULT NULL,
  `Present_Mobile` varchar(22) DEFAULT NULL,
  `Permanent_Address` varchar(200) DEFAULT NULL,
  `Permanent_City` varchar(50) DEFAULT NULL,
  `Permanent_Pin` varchar(11) DEFAULT NULL,
  `Permanent_State` varchar(50) DEFAULT NULL,
  `Permanent_Country` varchar(50) DEFAULT NULL,
  `Permanent_Tel` varchar(26) DEFAULT NULL,
  `EMail` varchar(50) DEFAULT NULL,
  `Leave_Given` int(11) DEFAULT NULL,
  `Basic_Salary` int(11) DEFAULT NULL,
  `Hra` int(11) DEFAULT NULL,
  `Call` int(11) DEFAULT NULL,
  `Conveyance` int(11) DEFAULT NULL,
  `Ppf` int(11) DEFAULT NULL,
  `Others` int(11) DEFAULT NULL,
  `Prof_Tax` int(11) DEFAULT NULL,
  `Other_Tax` int(11) DEFAULT NULL,
  `Net_Salary` int(11) DEFAULT NULL,
  `Date_Added` varchar(10) DEFAULT NULL,
  `Prev_Sal` int(11) DEFAULT NULL,
  `Increment` int(11) DEFAULT NULL,
  `PAN` varchar(50) DEFAULT NULL,
  `EmailPwd` varchar(20) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `OfficialEmail` varchar(50) DEFAULT NULL,
  `User_type` int(11) DEFAULT NULL,
  `UserId` varchar(22) DEFAULT NULL,
  `UserPswd` varchar(44) DEFAULT NULL,
  `Company_Type` varchar(100) DEFAULT NULL,
  `ChkOT` int(11) DEFAULT NULL,
  `ChkPT` int(11) DEFAULT NULL,
  `ChkPF` int(11) DEFAULT NULL,
  `ChkTDS` int(11) DEFAULT NULL,
  `ChkMLWF` int(11) DEFAULT NULL,
  `ChkESIC` int(11) DEFAULT NULL,
  `ChkLeave` int(11) DEFAULT NULL,
  `Gender` varchar(6) DEFAULT NULL,
  `EncUserId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Emp_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=284 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `online_admission_documents`
--
DROP TABLE IF EXISTS `online_admission_documents`;
CREATE TABLE `online_admission_documents` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Inquiry_Id` int(11) NOT NULL,
  `Doc_Key` varchar(120) NOT NULL,
  `Filename` varchar(255) NOT NULL,
  `Content_Type` varchar(100) DEFAULT NULL,
  `Is_Photo` tinyint(1) NOT NULL DEFAULT 0,
  `File_Data` longblob DEFAULT NULL,
  `Created_At` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`Id`),
  KEY `idx_oadoc_inquiry` (`Inquiry_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=637 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `online_admission_kt_details`
--
DROP TABLE IF EXISTS `online_admission_kt_details`;
CREATE TABLE `online_admission_kt_details` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Inquiry_Id` int(11) NOT NULL,
  `Level` varchar(20) NOT NULL,
  `Subject_Name` varchar(255) DEFAULT NULL,
  `Year` varchar(10) DEFAULT NULL,
  `Semester` varchar(10) DEFAULT NULL,
  `Cleared_Year` varchar(10) DEFAULT NULL,
  `Marks` varchar(50) DEFAULT NULL,
  `Sort_Order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `idx_inquiry` (`Inquiry_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=231 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `online_admission_payload`
--
DROP TABLE IF EXISTS `online_admission_payload`;
CREATE TABLE `online_admission_payload` (
  `Student_Id` int(11) DEFAULT NULL,
  `Payload` longtext DEFAULT NULL,
  `Created_At` datetime NOT NULL DEFAULT current_timestamp(),
  `Updated_At` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Inquiry_Id` int(11) NOT NULL,
  `First_Name` varchar(100) DEFAULT NULL,
  `Middle_Name` varchar(100) DEFAULT NULL,
  `Last_Name` varchar(100) DEFAULT NULL,
  `Short_Name` varchar(100) DEFAULT NULL,
  `Student_Name` varchar(300) DEFAULT NULL,
  `DOB` date DEFAULT NULL,
  `Sex` varchar(20) DEFAULT NULL,
  `Nationality` varchar(100) DEFAULT NULL,
  `Email` varchar(200) DEFAULT NULL,
  `Present_Mobile` varchar(20) DEFAULT NULL,
  `Telephone` varchar(20) DEFAULT NULL,
  `Family_Contact` varchar(100) DEFAULT NULL,
  `ID_Proof_Type` varchar(100) DEFAULT NULL,
  `Present_Flat` varchar(100) DEFAULT NULL,
  `Present_Building` varchar(200) DEFAULT NULL,
  `Present_Street` varchar(200) DEFAULT NULL,
  `Present_Area` varchar(200) DEFAULT NULL,
  `Present_Landmark` varchar(200) DEFAULT NULL,
  `Present_Address` text DEFAULT NULL,
  `Present_City` varchar(100) DEFAULT NULL,
  `Present_District` varchar(100) DEFAULT NULL,
  `Present_State` varchar(100) DEFAULT NULL,
  `Present_Pin` varchar(10) DEFAULT NULL,
  `Present_Country` varchar(100) DEFAULT NULL,
  `Same_As_Present` tinyint(1) DEFAULT 0,
  `Permanent_Flat` varchar(100) DEFAULT NULL,
  `Permanent_Building` varchar(200) DEFAULT NULL,
  `Permanent_Street` varchar(200) DEFAULT NULL,
  `Permanent_Area` varchar(200) DEFAULT NULL,
  `Permanent_Landmark` varchar(200) DEFAULT NULL,
  `Permanent_Address` text DEFAULT NULL,
  `Permanent_City` varchar(100) DEFAULT NULL,
  `Permanent_District` varchar(100) DEFAULT NULL,
  `Permanent_State` varchar(100) DEFAULT NULL,
  `Permanent_Pin` varchar(10) DEFAULT NULL,
  `Permanent_Country` varchar(100) DEFAULT NULL,
  `SSC_Board` varchar(200) DEFAULT NULL,
  `SSC_School_Name` varchar(300) DEFAULT NULL,
  `SSC_Year_Passing` varchar(10) DEFAULT NULL,
  `SSC_Percentage` decimal(5,2) DEFAULT NULL,
  `SSC_KT_Count` int(11) DEFAULT 0,
  `HSC_Board` varchar(200) DEFAULT NULL,
  `HSC_College_Name` varchar(300) DEFAULT NULL,
  `HSC_Stream` varchar(200) DEFAULT NULL,
  `HSC_Year_Passing` varchar(10) DEFAULT NULL,
  `HSC_Percentage` decimal(5,2) DEFAULT NULL,
  `HSC_KT_Count` int(11) DEFAULT 0,
  `Diploma_Degree` varchar(200) DEFAULT NULL,
  `Diploma_Specialization` varchar(200) DEFAULT NULL,
  `Diploma_Institute` varchar(300) DEFAULT NULL,
  `Diploma_Year_Passing` varchar(10) DEFAULT NULL,
  `Diploma_Percentage` decimal(5,2) DEFAULT NULL,
  `Diploma_KT_Count` int(11) DEFAULT 0,
  `Grad_Degree` varchar(200) DEFAULT NULL,
  `Grad_Specialization` varchar(200) DEFAULT NULL,
  `Grad_University` varchar(300) DEFAULT NULL,
  `Grad_Year_Passing` varchar(10) DEFAULT NULL,
  `Grad_Percentage` decimal(5,2) DEFAULT NULL,
  `Grad_KT_Count` int(11) DEFAULT 0,
  `PG_Degree` varchar(200) DEFAULT NULL,
  `PG_Specialization` varchar(200) DEFAULT NULL,
  `PG_University` varchar(300) DEFAULT NULL,
  `PG_Year_Passing` varchar(10) DEFAULT NULL,
  `PG_Percentage` decimal(5,2) DEFAULT NULL,
  `PG_KT_Count` int(11) DEFAULT 0,
  `Qualification` varchar(200) DEFAULT NULL,
  `Discipline` varchar(200) DEFAULT NULL,
  `Percentage` decimal(5,2) DEFAULT NULL,
  `Education_Remark` text DEFAULT NULL,
  `Occupational_Status` varchar(200) DEFAULT NULL,
  `Job_Organisation` varchar(300) DEFAULT NULL,
  `Job_Designation` varchar(200) DEFAULT NULL,
  `Total_Experience` varchar(20) DEFAULT NULL,
  `Job_Description` text DEFAULT NULL,
  `Self_Employment_Details` text DEFAULT NULL,
  `Working_From_Years` varchar(10) DEFAULT NULL,
  `Working_From_Months` varchar(20) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Code` varchar(100) DEFAULT NULL,
  `Training_Programme_Name` varchar(300) DEFAULT NULL,
  `Training_Category` varchar(200) DEFAULT NULL,
  `Mode_Of_Payment` varchar(100) DEFAULT NULL,
  `Razorpay_Paid` tinyint(1) DEFAULT 0,
  `Razorpay_Payment_Id` varchar(200) DEFAULT NULL,
  `Razorpay_Order_Id` varchar(200) DEFAULT NULL,
  `Razorpay_Amount` decimal(10,2) DEFAULT NULL,
  `Razorpay_Signature` varchar(500) DEFAULT NULL,
  `Pay_At_Office_Audit` text DEFAULT NULL,
  `Terms_Agreed` tinyint(1) DEFAULT 0,
  `Consent_Acknowledged` tinyint(1) DEFAULT 0,
  `Experienced_Consent_Acknowledged` tinyint(1) DEFAULT 0,
  `Consent_Data` text DEFAULT NULL,
  `Consent_Checks` text DEFAULT NULL,
  `Draft_Step` int(11) DEFAULT 0,
  `Draft_Autosaved_At` datetime DEFAULT NULL,
  `Upi_Transfer_Confirmed` tinyint(1) DEFAULT 0,
  `Upi_Transfer_Reference` varchar(300) DEFAULT NULL,
  `Upi_Amount` decimal(10,2) DEFAULT NULL,
  `Medical_History` tinyint(1) DEFAULT 0,
  `Medical_History_Details` text DEFAULT NULL,
  PRIMARY KEY (`Inquiry_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `order`
--
DROP TABLE IF EXISTS `order`;
CREATE TABLE `order` (
  `id` int(11) NOT NULL,
  `userid` varchar(15) NOT NULL,
  `firstname` varchar(100) NOT NULL,
  `lastname` varchar(100) NOT NULL,
  `orderno` varchar(100) NOT NULL,
  `invoiceNo` varchar(255) NOT NULL,
  `invoiceDate` datetime NOT NULL,
  `invoiceStatus` int(11) NOT NULL DEFAULT 0,
  `paystatus` int(11) DEFAULT 0,
  `transactionid` varchar(200) NOT NULL,
  `transacamount` varchar(10) NOT NULL,
  `PaymentID` varchar(100) NOT NULL,
  `status` varchar(200) NOT NULL,
  `mobileno` varchar(200) NOT NULL,
  `email` varchar(200) NOT NULL,
  `phone` varchar(100) NOT NULL,
  `oamount` int(11) NOT NULL,
  `shipamount` varchar(20) NOT NULL,
  `recamount` int(11) NOT NULL,
  `disamount` int(11) NOT NULL,
  `disper` int(11) NOT NULL,
  `pamount` int(11) NOT NULL,
  `shipping` int(11) NOT NULL,
  `addressid` int(11) NOT NULL,
  `address1` text NOT NULL,
  `landmark` text NOT NULL,
  `city1` varchar(50) NOT NULL,
  `state` varchar(50) NOT NULL,
  `country` varchar(50) NOT NULL,
  `postcode` varchar(10) NOT NULL,
  `lat` varchar(100) NOT NULL,
  `long` varchar(100) NOT NULL,
  `additional_address` text NOT NULL,
  `shipaddress` text NOT NULL,
  `shiplandmark` text NOT NULL,
  `shipcity` varchar(50) NOT NULL,
  `shippostcode` varchar(50) NOT NULL,
  `paymode` varchar(20) NOT NULL,
  `ostatus` varchar(20) NOT NULL,
  `order_comments` text NOT NULL,
  `admin_note` text NOT NULL,
  `pstatus` varchar(20) NOT NULL,
  `delivered_date` datetime NOT NULL,
  `delivery_date` varchar(20) DEFAULT NULL,
  `orderfrom` int(11) NOT NULL,
  `paymentFrom` int(11) NOT NULL,
  `payment_date` datetime NOT NULL,
  `order_array` text NOT NULL,
  `orderemail` int(11) NOT NULL,
  `ordercount` int(11) NOT NULL,
  `order_success` int(11) NOT NULL,
  `order_date` datetime NOT NULL,
  `success_change` datetime NOT NULL,
  `success_userid` int(11) NOT NULL,
  `shiprocket_orderid` varchar(200) NOT NULL DEFAULT '0',
  `shipment_id` varchar(200) NOT NULL DEFAULT '0',
  `awb_code` varchar(200) NOT NULL DEFAULT '0',
  `awb_code_status` varchar(200) NOT NULL DEFAULT '0',
  `created_by` int(11) NOT NULL,
  `created_date` datetime NOT NULL,
  `updated_by` int(11) NOT NULL DEFAULT 0,
  `updated_date` datetime NOT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  `discountamount` int(11) NOT NULL,
  `discountone` varchar(100) NOT NULL,
  `percenone` int(11) NOT NULL,
  `couponType` int(11) NOT NULL DEFAULT 0,
  `couponID` int(11) NOT NULL DEFAULT 0,
  `discountStatus` int(11) NOT NULL DEFAULT 0,
  `discountAmt` int(11) NOT NULL DEFAULT 0,
  `totalamt` varchar(255) NOT NULL,
  `sendmail` int(11) NOT NULL DEFAULT 0,
  `tracking_link` varchar(100) DEFAULT NULL,
  `tracking_id` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `page_master`
--
DROP TABLE IF EXISTS `page_master`;
CREATE TABLE `page_master` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pagename` varchar(50) DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=112 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `pagerole`
--
DROP TABLE IF EXISTS `pagerole`;
CREATE TABLE `pagerole` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `roleid` int(11) NOT NULL,
  `pageid` int(11) NOT NULL,
  `accessid` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=5560 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `password_reset_tokens`
--
DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens` (
  `user_id` int(11) NOT NULL,
  `otp` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `placement_applications`
--
DROP TABLE IF EXISTS `placement_applications`;
CREATE TABLE `placement_applications` (
  `Application_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Job_Id` int(11) NOT NULL,
  `Student_Id` varchar(50) NOT NULL,
  `CV_Path` varchar(255) DEFAULT NULL,
  `Cover_Letter` text DEFAULT NULL,
  `Status` varchar(30) NOT NULL DEFAULT 'Applied',
  `Remarks` text DEFAULT NULL,
  `Applied_Date` datetime NOT NULL DEFAULT current_timestamp(),
  `Screened_By` int(11) DEFAULT NULL,
  `Screened_Date` datetime DEFAULT NULL,
  `IsDelete` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Application_Id`),
  UNIQUE KEY `uniq_job_student` (`Job_Id`,`Student_Id`),
  KEY `idx_job_id` (`Job_Id`),
  KEY `idx_student_id` (`Student_Id`),
  KEY `idx_status` (`Status`),
  KEY `idx_isdelete` (`IsDelete`),
  KEY `idx_applied_date` (`Applied_Date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `placement_company_visits`
--
DROP TABLE IF EXISTS `placement_company_visits`;
CREATE TABLE `placement_company_visits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `visit_date` date NOT NULL,
  `company_name` varchar(160) NOT NULL,
  `person_to_meet` varchar(160) NOT NULL,
  `place` varchar(160) NOT NULL,
  `is_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_placement_company_visits_active` (`is_deleted`,`visit_date`),
  KEY `idx_placement_company_visits_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `placement_deputation_openings`
--
DROP TABLE IF EXISTS `placement_deputation_openings`;
CREATE TABLE `placement_deputation_openings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_name` varchar(160) NOT NULL,
  `role` varchar(160) NOT NULL,
  `no_of_positions` int(11) NOT NULL DEFAULT 1,
  `deadline` date DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Open',
  `is_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_placement_deputation_openings_active` (`is_deleted`,`status`,`deadline`),
  KEY `idx_placement_deputation_openings_updated` (`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `placement_emails`
--
DROP TABLE IF EXISTS `placement_emails`;
CREATE TABLE `placement_emails` (
  `Email_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Company_Email` varchar(255) NOT NULL,
  `Company_Name` varchar(255) DEFAULT NULL,
  `Subject` varchar(255) NOT NULL,
  `Body` text DEFAULT NULL,
  `Job_Submission_Link` varchar(512) DEFAULT NULL,
  `Status` varchar(30) NOT NULL DEFAULT 'Draft',
  `Created_By` int(11) DEFAULT NULL,
  `Created_Date` datetime NOT NULL DEFAULT current_timestamp(),
  `IsDelete` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Email_Id`),
  KEY `idx_company_email` (`Company_Email`),
  KEY `idx_created_date` (`Created_Date`),
  KEY `idx_isdelete` (`IsDelete`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `placement_interview_master`
--
DROP TABLE IF EXISTS `placement_interview_master`;
CREATE TABLE `placement_interview_master` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `interview_code` varchar(20) DEFAULT NULL,
  `interview_date` date NOT NULL,
  `company_name` varchar(160) NOT NULL,
  `role` varchar(160) NOT NULL,
  `interview_type` varchar(20) NOT NULL DEFAULT 'On Campus',
  `is_deleted` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_placement_interview_master_code` (`interview_code`),
  KEY `idx_interview_master_active` (`is_deleted`,`interview_date`),
  KEY `idx_interview_master_company` (`company_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `placement_jobs`
--
DROP TABLE IF EXISTS `placement_jobs`;
CREATE TABLE `placement_jobs` (
  `Job_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Company_Name` varchar(255) DEFAULT NULL,
  `Company_Email` varchar(255) DEFAULT NULL,
  `Job_Title` varchar(255) DEFAULT NULL,
  `Job_Description` text DEFAULT NULL,
  `Requirements` text DEFAULT NULL,
  `Location` varchar(255) DEFAULT NULL,
  `Package` varchar(100) DEFAULT NULL,
  `Min_Percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `Eligible_Courses` text DEFAULT NULL,
  `Eligible_Batches` text DEFAULT NULL,
  `Max_Backlogs` int(11) NOT NULL DEFAULT 0,
  `Application_Deadline` datetime DEFAULT NULL,
  `Status` varchar(30) NOT NULL DEFAULT 'Open',
  `Token` varchar(128) DEFAULT NULL,
  `Created_By` int(11) DEFAULT NULL,
  `Created_Date` datetime NOT NULL DEFAULT current_timestamp(),
  `Updated_Date` datetime DEFAULT NULL,
  `IsDelete` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Job_Id`),
  UNIQUE KEY `uniq_token` (`Token`),
  KEY `idx_status` (`Status`),
  KEY `idx_isdelete` (`IsDelete`),
  KEY `idx_created_date` (`Created_Date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `public_student_intake`
--
DROP TABLE IF EXISTS `public_student_intake`;
CREATE TABLE `public_student_intake` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `student_name` varchar(255) NOT NULL,
  `phone_number` varchar(32) NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `token` varchar(64) DEFAULT NULL,
  `inquiry_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `roll_number` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_token` (`token`),
  KEY `idx_inquiry` (`inquiry_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `qms_master`
--
DROP TABLE IF EXISTS `qms_master`;
CREATE TABLE `qms_master` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `QMS_name` varchar(16) DEFAULT NULL,
  `QMS_Desc` varchar(28) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `qualification_master`
--
DROP TABLE IF EXISTS `qualification_master`;
CREATE TABLE `qualification_master` (
  `Id` int(11) DEFAULT NULL,
  `CourseId` int(11) DEFAULT NULL,
  `QualificationID` int(11) DEFAULT NULL,
  `DecieplineID` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `role`
--
DROP TABLE IF EXISTS `role`;
CREATE TABLE `role` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(30) DEFAULT NULL,
  `slug` varchar(100) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `image` varchar(100) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `delete` int(11) NOT NULL DEFAULT 0,
  `dashboard_department` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `role_permissions`
--
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `permission_id` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`role_id`,`permission_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4740 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `s_batch_lec`
--
DROP TABLE IF EXISTS `s_batch_lec`;
CREATE TABLE `s_batch_lec` (
  `Lecture_Id` varchar(69) DEFAULT NULL,
  `Batch_Id` varchar(8) DEFAULT NULL,
  `Lecture` mediumtext DEFAULT NULL,
  `Lecture_Dt` varchar(10) DEFAULT NULL,
  `Lecture_Time` varchar(23) DEFAULT NULL,
  `Assign_Start` varchar(10) DEFAULT NULL,
  `Assignment_Id` varchar(4) DEFAULT NULL,
  `Assign_End` varchar(7) DEFAULT NULL,
  `Documents` varchar(15) DEFAULT NULL,
  `Faculty_Id` varchar(7) DEFAULT NULL,
  `Lecture_Duration` varchar(10) DEFAULT NULL,
  `Date_Added` varchar(23) DEFAULT NULL,
  `ClassRoom` varchar(8) DEFAULT NULL,
  `Lecture_Time_end` varchar(23) DEFAULT NULL,
  `test_id` int(11) DEFAULT NULL,
  `Test` varchar(14) DEFAULT NULL,
  `LectureNo` varchar(50) DEFAULT NULL,
  `Publish` varchar(6) DEFAULT NULL,
  `SubTopics` mediumtext DEFAULT NULL,
  `IsActive` varchar(7) DEFAULT NULL,
  `IsDelete` varchar(7) DEFAULT NULL,
  `V` varchar(7) DEFAULT NULL,
  `W` int(11) DEFAULT NULL,
  `X` varchar(10) DEFAULT NULL,
  `Y` varchar(3) DEFAULT NULL,
  `Z` int(11) DEFAULT NULL,
  `AA` int(11) DEFAULT NULL,
  `AB` varchar(7) DEFAULT NULL,
  `AC` int(11) DEFAULT NULL,
  `AD` varchar(7) DEFAULT NULL,
  `AE` int(11) DEFAULT NULL,
  `AF` varchar(10) DEFAULT NULL,
  `AG` int(11) DEFAULT NULL,
  `AH` varchar(3) DEFAULT NULL,
  `AI` varchar(4084) DEFAULT NULL,
  `AJ` varchar(7) DEFAULT NULL,
  `AK` varchar(7) DEFAULT NULL,
  `AL` varchar(7) DEFAULT NULL,
  `AM` int(11) DEFAULT NULL,
  `AN` varchar(10) DEFAULT NULL,
  `AO` varchar(10) DEFAULT NULL,
  `AP` int(11) DEFAULT NULL,
  `AQ` int(11) DEFAULT NULL,
  `AR` varchar(7) DEFAULT NULL,
  `AS` int(11) DEFAULT NULL,
  `AT` varchar(7) DEFAULT NULL,
  `AU` int(11) DEFAULT NULL,
  `AV` varchar(10) DEFAULT NULL,
  `AW` int(11) DEFAULT NULL,
  `AX` varchar(3) DEFAULT NULL,
  `AY` varchar(23) DEFAULT NULL,
  `AZ` int(11) DEFAULT NULL,
  `BA` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `s_exam_taken_master`
--
DROP TABLE IF EXISTS `s_exam_taken_master`;
CREATE TABLE `s_exam_taken_master` (
  `Take_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Exam_Id` int(11) DEFAULT NULL,
  `Exam_Dt` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  PRIMARY KEY (`Take_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=677 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `s_exam_taken_master__bak_20260320_103211`
--
DROP TABLE IF EXISTS `s_exam_taken_master__bak_20260320_103211`;
CREATE TABLE `s_exam_taken_master__bak_20260320_103211` (
  `Take_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Exam_Id` int(11) DEFAULT NULL,
  `Exam_Dt` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `s_fees_mst`
--
DROP TABLE IF EXISTS `s_fees_mst`;
CREATE TABLE `s_fees_mst` (
  `Fees_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Fees_Code` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `NFees_Code1` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `NFees_Code2` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Installment_Id` int(11) DEFAULT NULL,
  `Admission_Id` int(11) DEFAULT NULL,
  `Cheque_Date` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Payment_Type` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Cheque_No` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Cheque_Bank` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Cheque_Branch` varchar(150) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Amount` float DEFAULT NULL,
  `Service_Tax` float DEFAULT NULL,
  `Total_Amt` float DEFAULT NULL,
  `TypeR` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `UnPaid_Amt` float DEFAULT NULL,
  `Amt_Word` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Date_Added` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `OldFees_Code` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Notes` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `RDate` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `Print` int(11) DEFAULT NULL,
  `FeesMonth` int(11) DEFAULT NULL,
  `FeesYear` int(11) DEFAULT NULL,
  `IsActive` int(11) NOT NULL DEFAULT 1,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  `InvoiceCode` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `InvoiceDate` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `PaymentId` varchar(255) DEFAULT NULL,
  `created_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`Fees_Id`),
  KEY `idx_sfees_student` (`Student_Id`),
  KEY `idx_sfees_code` (`Fees_Code`)
) ENGINE=MyISAM AUTO_INCREMENT=52591 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `sheet1`
--
DROP TABLE IF EXISTS `sheet1`;
CREATE TABLE `sheet1` (
  `Student_Id` int(11) DEFAULT NULL,
  `FName` varchar(36) DEFAULT NULL,
  `LName` varchar(10) DEFAULT NULL,
  `MName` varchar(10) DEFAULT NULL,
  `Student_Name` varchar(36) DEFAULT NULL,
  `Qualification` varchar(7) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `DOB` varchar(10) DEFAULT NULL,
  `Sex` varchar(6) DEFAULT NULL,
  `Nationality` varchar(10) DEFAULT NULL,
  `Region` varchar(10) DEFAULT NULL,
  `Present_Address` varchar(95) DEFAULT NULL,
  `Present_City` varchar(11) DEFAULT NULL,
  `Present_Pin` int(11) DEFAULT NULL,
  `Present_State` varchar(12) DEFAULT NULL,
  `Present_Country` varchar(5) DEFAULT NULL,
  `Present_Tel` bigint(20) DEFAULT NULL,
  `Present_Mobile` bigint(20) DEFAULT NULL,
  `Present_Mobile2` varchar(10) DEFAULT NULL,
  `Fax` varchar(10) DEFAULT NULL,
  `Permanent_Address` varchar(95) DEFAULT NULL,
  `Permanent_City` varchar(11) DEFAULT NULL,
  `Permanent_Pin` int(11) DEFAULT NULL,
  `Permanent_State` varchar(16) DEFAULT NULL,
  `Permanent_Country` varchar(5) DEFAULT NULL,
  `Permanent_Tel` varchar(12) DEFAULT NULL,
  `Email` varchar(34) DEFAULT NULL,
  `Other_Training` varchar(10) DEFAULT NULL,
  `AutoCad` varchar(10) DEFAULT NULL,
  `MicroStation` varchar(10) DEFAULT NULL,
  `PDS` varchar(10) DEFAULT NULL,
  `PDMS` varchar(10) DEFAULT NULL,
  `Others` varchar(10) DEFAULT NULL,
  `Occupation` varchar(13) DEFAULT NULL,
  `Company` varchar(10) DEFAULT NULL,
  `Designation` varchar(10) DEFAULT NULL,
  `Company_Add` varchar(10) DEFAULT NULL,
  `Company_Tel` varchar(10) DEFAULT NULL,
  `Design_Exp` int(11) DEFAULT NULL,
  `Construction_Exp` int(11) DEFAULT NULL,
  `Production_Exp` int(11) DEFAULT NULL,
  `Marketing_Exp` int(11) DEFAULT NULL,
  `Other_Exp` int(11) DEFAULT NULL,
  `Total_Exp` int(11) DEFAULT NULL,
  `Pass_No` varchar(10) DEFAULT NULL,
  `Pass_Issue_Dt` varchar(10) DEFAULT NULL,
  `Pas_Exp_Dt` varchar(10) DEFAULT NULL,
  `Known_Stud` varchar(10) DEFAULT NULL,
  `Known_Web` varchar(10) DEFAULT NULL,
  `Known_Paper` varchar(10) DEFAULT NULL,
  `Known_Other` varchar(10) DEFAULT NULL,
  `Refered_By` varchar(10) DEFAULT NULL,
  `Inquiry` varchar(7) DEFAULT NULL,
  `Student` varchar(7) DEFAULT NULL,
  `Inquiry_From` varchar(10) DEFAULT NULL,
  `Inquiry_Type` varchar(10) DEFAULT NULL,
  `Discussion` varchar(445) DEFAULT NULL,
  `Inquiry_Dt` varchar(10) DEFAULT NULL,
  `Date_Added` varchar(10) DEFAULT NULL,
  `Aca_Qualification` varchar(7) DEFAULT NULL,
  `Discipline` varchar(33) DEFAULT NULL,
  `Institute` varchar(50) DEFAULT NULL,
  `Year` int(11) DEFAULT NULL,
  `Marks` decimal(5,3) DEFAULT NULL,
  `Batch_Code` int(11) DEFAULT NULL,
  `DNC` varchar(2) DEFAULT NULL,
  `Part_Time` varchar(5) DEFAULT NULL,
  `Ex_Student` varchar(10) DEFAULT NULL,
  `Photo` varchar(3) DEFAULT NULL,
  `Quali` varchar(3) DEFAULT NULL,
  `Resi` varchar(3) DEFAULT NULL,
  `Contract` varchar(2) DEFAULT NULL,
  `Marksheet` varchar(3) DEFAULT NULL,
  `Address` varchar(3) DEFAULT NULL,
  `Admission` varchar(2) DEFAULT NULL,
  `JobRequired` varchar(10) DEFAULT NULL,
  `Remark` varchar(10) DEFAULT NULL,
  `CVDate` varchar(10) DEFAULT NULL,
  `SitPerformance` varchar(10) DEFAULT NULL,
  `PlacementRemark` varchar(10) DEFAULT NULL,
  `Accomodation` varchar(2) DEFAULT NULL,
  `Placement_Block` varchar(10) DEFAULT NULL,
  `college_id` int(11) DEFAULT NULL,
  `Admission_Dt` varchar(10) DEFAULT NULL,
  `Father_Name` varchar(10) DEFAULT NULL,
  `Father_Occupation` varchar(10) DEFAULT NULL,
  `Father_Mobile` varchar(10) DEFAULT NULL,
  `Mother_Name` varchar(10) DEFAULT NULL,
  `Mother_Occupation` varchar(10) DEFAULT NULL,
  `Mother_Mobile` varchar(10) DEFAULT NULL,
  `Sibling_Name` varchar(10) DEFAULT NULL,
  `Sibling_Occupation` varchar(10) DEFAULT NULL,
  `Sibling_Mobile` varchar(10) DEFAULT NULL,
  `online_stud_id` int(11) DEFAULT NULL,
  `StateChangeDt` varchar(10) DEFAULT NULL,
  `OnlineState` int(11) DEFAULT NULL,
  `Percentage` varchar(4) DEFAULT NULL,
  `Adm_DNC` varchar(2) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `IsUnread` int(11) DEFAULT NULL,
  `IsUnreadAdm` int(11) DEFAULT NULL,
  `Login_Id` varchar(27) DEFAULT NULL,
  `Login_Password` varchar(15) DEFAULT NULL,
  `Area_Of_Interest` varchar(10) DEFAULT NULL,
  `Notice_Period` varchar(10) DEFAULT NULL,
  `Industry` varchar(10) DEFAULT NULL,
  `Salary` varchar(10) DEFAULT NULL,
  `Business_Nature` varchar(10) DEFAULT NULL,
  `Company_city` varchar(10) DEFAULT NULL,
  `IsAdmOpen` varchar(6) DEFAULT NULL,
  `Placement_Type` varchar(10) DEFAULT NULL,
  `Batch_Category_id` int(11) DEFAULT NULL,
  `Nickname` varchar(25) DEFAULT NULL,
  `Status_id` int(11) DEFAULT NULL,
  `Status_date` varchar(10) DEFAULT NULL,
  `Expected_Location` varchar(10) DEFAULT NULL,
  `Company_id` varchar(10) DEFAULT NULL,
  `EncStudentId` varchar(24) DEFAULT NULL,
  `GCMID` varchar(10) DEFAULT NULL,
  `IMEI` varchar(10) DEFAULT NULL,
  `EncUpdateDate` varchar(10) DEFAULT NULL,
  `PlacementBlockReason` varchar(10) DEFAULT NULL,
  `PlacementBlockReasonRemark` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `sit_account_head`
--
DROP TABLE IF EXISTS `sit_account_head`;
CREATE TABLE `sit_account_head` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `sit_bank`
--
DROP TABLE IF EXISTS `sit_bank`;
CREATE TABLE `sit_bank` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `sit_descipline`
--
DROP TABLE IF EXISTS `sit_descipline`;
CREATE TABLE `sit_descipline` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `sit_employeeloan`
--
DROP TABLE IF EXISTS `sit_employeeloan`;
CREATE TABLE `sit_employeeloan` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee` varchar(255) DEFAULT NULL,
  `loandate` varchar(25) DEFAULT NULL,
  `loanamt` varchar(350) DEFAULT NULL,
  `monthly` varchar(350) DEFAULT NULL,
  `totalmonths` varchar(350) DEFAULT NULL,
  `comments` varchar(1050) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `sit_eptaxmaster`
--
DROP TABLE IF EXISTS `sit_eptaxmaster`;
CREATE TABLE `sit_eptaxmaster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_sal` int(11) DEFAULT NULL,
  `to_sal` int(11) DEFAULT NULL,
  `tax_price` int(11) DEFAULT NULL,
  `sep_mnth` varchar(250) DEFAULT NULL,
  `sep_tax_price` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` varchar(25) DEFAULT NULL,
  `created_date` varchar(25) DEFAULT NULL,
  `updated_date` varchar(25) DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `sit_feesnotes`
--
DROP TABLE IF EXISTS `sit_feesnotes`;
CREATE TABLE `sit_feesnotes` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `sit_mlwfmaster`
--
DROP TABLE IF EXISTS `sit_mlwfmaster`;
CREATE TABLE `sit_mlwfmaster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `formdate` varchar(255) DEFAULT NULL,
  `todate` varchar(250) DEFAULT NULL,
  `grossupto` varchar(550) DEFAULT NULL,
  `chargeswill` varchar(550) DEFAULT NULL,
  `otherwise` varchar(550) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `sit_qualification`
--
DROP TABLE IF EXISTS `sit_qualification`;
CREATE TABLE `sit_qualification` (
  `id` int(11) NOT NULL,
  `title` varchar(50) DEFAULT NULL,
  `created_by` int(11) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `deleted` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `site_visit_master`
--
DROP TABLE IF EXISTS `site_visit_master`;
CREATE TABLE `site_visit_master` (
  `Visit_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Location` varchar(51) DEFAULT NULL,
  `Visit_Date` varchar(15) DEFAULT NULL,
  `Visit_Time` varchar(8) DEFAULT NULL,
  `Visit_Fees` int(11) DEFAULT NULL,
  `Total_Student` int(11) DEFAULT NULL,
  `Region` varchar(7) DEFAULT NULL,
  `Bus_No` int(11) DEFAULT NULL,
  `Head_Name` varchar(35) DEFAULT NULL,
  `Batch_ID` int(11) DEFAULT NULL,
  `Batch_Code` int(11) DEFAULT NULL,
  `Course_Name` varchar(51) DEFAULT NULL,
  `ConfirmDAte` varchar(15) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Visit_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=224 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `sms_delivery_reports`
--
DROP TABLE IF EXISTS `sms_delivery_reports`;
CREATE TABLE `sms_delivery_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `message_id` varchar(191) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `delivery_status` varchar(100) DEFAULT NULL,
  `delivered_at` varchar(100) DEFAULT NULL,
  `error_code` varchar(100) DEFAULT NULL,
  `auth_header` varchar(255) DEFAULT NULL,
  `source_ip` varchar(100) DEFAULT NULL,
  `payload_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_message_id` (`message_id`),
  KEY `idx_mobile` (`mobile`),
  KEY `idx_status` (`delivery_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `standard_grades`
--
DROP TABLE IF EXISTS `standard_grades`;
CREATE TABLE `standard_grades` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `start_from` varchar(11) DEFAULT NULL,
  `end_from` varchar(11) DEFAULT NULL,
  `grade` varchar(255) DEFAULT NULL,
  `created_date` varchar(255) DEFAULT NULL,
  `updated_date` varchar(200) DEFAULT NULL,
  `deleted` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Table structure for table `status_master`
--
DROP TABLE IF EXISTS `status_master`;
CREATE TABLE `status_master` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Status` varchar(46) DEFAULT NULL,
  `Description` varchar(46) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT 0,
  `PreDefined` varchar(3) DEFAULT NULL,
  `SetBy` varchar(4) DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_attendance`
--
DROP TABLE IF EXISTS `student_attendance`;
CREATE TABLE `student_attendance` (
  `Attendance_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Batch_Id` int(11) NOT NULL,
  `Student_Id` int(11) NOT NULL,
  `Admission_Id` int(11) DEFAULT NULL,
  `Attendance_Date` date NOT NULL,
  `Session` enum('first_half','second_half') NOT NULL DEFAULT 'first_half',
  `In_Time` time DEFAULT NULL,
  `Out_Time` time DEFAULT NULL,
  `Status` char(1) NOT NULL DEFAULT 'P' COMMENT 'P=Present, A=Absent',
  `Remarks` varchar(255) DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `IsDelete` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`Attendance_Id`),
  UNIQUE KEY `uq_attendance` (`Batch_Id`,`Student_Id`,`Attendance_Date`,`Session`)
) ENGINE=InnoDB AUTO_INCREMENT=342705 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `student_attendance_duplicate_backup_20260629`
--
DROP TABLE IF EXISTS `student_attendance_duplicate_backup_20260629`;
CREATE TABLE `student_attendance_duplicate_backup_20260629` (
  `Attendance_Id` int(11) NOT NULL DEFAULT 0,
  `Batch_Id` int(11) NOT NULL,
  `Student_Id` int(11) NOT NULL,
  `Admission_Id` int(11) DEFAULT NULL,
  `Attendance_Date` date NOT NULL,
  `Session` enum('first_half','second_half') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'first_half',
  `In_Time` time DEFAULT NULL,
  `Out_Time` time DEFAULT NULL,
  `Status` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'P' COMMENT 'P=Present, A=Absent',
  `Remarks` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `Created_At` timestamp NULL DEFAULT current_timestamp(),
  `Updated_At` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `IsDelete` tinyint(1) DEFAULT 0,
  `Backed_Up_At` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `student_cvs`
--
DROP TABLE IF EXISTS `student_cvs`;
CREATE TABLE `student_cvs` (
  `CV_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` varchar(50) NOT NULL,
  `CV_Name` varchar(255) NOT NULL,
  `CV_Path` varchar(255) NOT NULL,
  `Is_Default` tinyint(4) NOT NULL DEFAULT 0,
  `Created_Date` datetime NOT NULL DEFAULT current_timestamp(),
  `IsDelete` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`CV_Id`),
  KEY `idx_student_id` (`Student_Id`),
  KEY `idx_isdelete` (`IsDelete`),
  KEY `idx_created_date` (`Created_Date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `student_documentmaster`
--
DROP TABLE IF EXISTS `student_documentmaster`;
CREATE TABLE `student_documentmaster` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` int(11) DEFAULT NULL,
  `Reg_Id` int(11) DEFAULT NULL,
  `FileName` varchar(255) DEFAULT NULL,
  `FileType` varchar(255) DEFAULT NULL,
  `Inquiry_Id` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=45349 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_documets_bk`
--
DROP TABLE IF EXISTS `student_documets_bk`;
CREATE TABLE `student_documets_bk` (
  `ID` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `doc_name` text DEFAULT NULL,
  `upload_image` varchar(150) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_inquiry`
--
DROP TABLE IF EXISTS `student_inquiry`;
CREATE TABLE `student_inquiry` (
  `Inquiry_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` varchar(50) DEFAULT NULL,
  `FName` text DEFAULT NULL,
  `LName` text DEFAULT NULL,
  `MName` text DEFAULT NULL,
  `Student_Name` varchar(60) DEFAULT NULL,
  `Qualification` text DEFAULT NULL,
  `Course_Id` varchar(50) DEFAULT NULL,
  `Sex` text DEFAULT NULL,
  `Nationality` varchar(30) DEFAULT NULL,
  `Region` text DEFAULT NULL,
  `Present_Address` text DEFAULT NULL,
  `Present_City` text DEFAULT NULL,
  `Present_Pin` text DEFAULT NULL,
  `Present_State` varchar(30) DEFAULT NULL,
  `Present_Country` text DEFAULT NULL,
  `Present_Tel` text DEFAULT NULL,
  `Present_Mobile` varchar(100) DEFAULT NULL,
  `Present_Mobile2` varchar(50) DEFAULT NULL,
  `Fax` text DEFAULT NULL,
  `Permanent_Address` text DEFAULT NULL,
  `Permanent_City` text DEFAULT NULL,
  `Permanent_Pin` text DEFAULT NULL,
  `Permanent_State` text DEFAULT NULL,
  `Permanent_Country` text DEFAULT NULL,
  `Permanent_Tel` text DEFAULT NULL,
  `Email` text DEFAULT NULL,
  `Other_Training` text DEFAULT NULL,
  `AutoCad` text DEFAULT NULL,
  `MicroStation` text DEFAULT NULL,
  `PDS` text DEFAULT NULL,
  `PDMS` text DEFAULT NULL,
  `Others` text DEFAULT NULL,
  `Occupation` text DEFAULT NULL,
  `Company` text DEFAULT NULL,
  `Designation` text DEFAULT NULL,
  `Company_Add` text DEFAULT NULL,
  `Company_Tel` text DEFAULT NULL,
  `Design_Exp` text DEFAULT NULL,
  `Construction_Exp` text DEFAULT NULL,
  `Production_Exp` text DEFAULT NULL,
  `Marketing_Exp` text DEFAULT NULL,
  `Other_Exp` text DEFAULT NULL,
  `Total_Exp` text DEFAULT NULL,
  `Pass_No` text DEFAULT NULL,
  `Pass_Issue_Dt` text DEFAULT NULL,
  `Pas_Exp_Dt` text DEFAULT NULL,
  `Known_Stud` text DEFAULT NULL,
  `Known_Web` text DEFAULT NULL,
  `Known_Paper` varchar(50) DEFAULT NULL,
  `Known_Other` varchar(50) DEFAULT NULL,
  `Refered_By` varchar(50) DEFAULT NULL,
  `Inquiry` varchar(50) DEFAULT NULL,
  `Student` varchar(50) DEFAULT NULL,
  `Inquiry_From` varchar(50) DEFAULT NULL,
  `Inquiry_Type` varchar(50) DEFAULT NULL,
  `Discussion` text DEFAULT NULL,
  `Inquiry_Dt` varchar(50) DEFAULT NULL,
  `Date_Added` varchar(50) DEFAULT NULL,
  `Aca_Qualification` varchar(50) DEFAULT NULL,
  `Discipline` text DEFAULT NULL,
  `Institute` text DEFAULT NULL,
  `Year` varchar(50) DEFAULT NULL,
  `Marks` varchar(50) DEFAULT NULL,
  `Batch_Code` text DEFAULT NULL,
  `DNC` text DEFAULT NULL,
  `Part_Time` text DEFAULT NULL,
  `Ex_Student` varchar(50) DEFAULT NULL,
  `Photo` varchar(50) DEFAULT NULL,
  `Quali` varchar(50) DEFAULT NULL,
  `Resi` varchar(50) DEFAULT NULL,
  `Contract` varchar(50) DEFAULT NULL,
  `Marksheet` varchar(50) DEFAULT NULL,
  `Address` varchar(50) DEFAULT NULL,
  `JobRequired` varchar(50) DEFAULT NULL,
  `Remark` text DEFAULT NULL,
  `CVDate` varchar(50) DEFAULT NULL,
  `SitPerformance` varchar(50) DEFAULT NULL,
  `PlacementRemark` text DEFAULT NULL,
  `Accomodation` varchar(50) DEFAULT NULL,
  `Placement_Block` varchar(50) DEFAULT NULL,
  `college_id` varchar(50) DEFAULT NULL,
  `Admission` int(11) DEFAULT 0,
  `Admission_Dt` varchar(50) DEFAULT NULL,
  `Father_Name` varchar(50) DEFAULT NULL,
  `Father_Occupation` varchar(50) DEFAULT NULL,
  `Father_Mobile` varchar(25) DEFAULT NULL,
  `Mother_Name` text DEFAULT NULL,
  `Mother_Occupation` varchar(25) DEFAULT NULL,
  `Mother_Mobile` varchar(25) DEFAULT NULL,
  `Sibling_Name` text DEFAULT NULL,
  `Sibling_Occupation` varchar(50) DEFAULT NULL,
  `Sibling_Mobile` varchar(50) DEFAULT NULL,
  `online_stud_id` varchar(50) DEFAULT NULL,
  `StateChangeDt` varchar(50) DEFAULT NULL,
  `OnlineState` varchar(50) DEFAULT '3',
  `Percentage` varchar(50) DEFAULT NULL,
  `DOB` varchar(50) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 0,
  `IsDelete` int(11) DEFAULT 0,
  `Adm_DNC` varchar(50) DEFAULT NULL,
  `Convert_Flag` varchar(50) DEFAULT NULL,
  `Batch_Category_id` varchar(50) DEFAULT NULL,
  `IsUnread` int(11) DEFAULT 0,
  `admission_done` int(11) DEFAULT 0 COMMENT '0 = null\r\n1= start\r\n2=done',
  `IsUnreadAdm` varchar(50) DEFAULT NULL,
  `Created_By` int(11) DEFAULT NULL,
  `_inquiry_date` date GENERATED ALWAYS AS (coalesce(str_to_date(left(nullif(trim(`Inquiry_Dt`),''),19),'%Y-%m-%d %H:%i:%s'),str_to_date(left(nullif(trim(`Inquiry_Dt`),''),10),'%Y-%m-%d'),str_to_date(left(nullif(trim(`Inquiry_Dt`),''),10),'%d-%m-%Y'),str_to_date(left(nullif(trim(`Inquiry_Dt`),''),10),'%d/%m/%Y'))) VIRTUAL,
  `Preferred_Location` text DEFAULT NULL,
  PRIMARY KEY (`Inquiry_Id`),
  KEY `idx_si_list` (`IsDelete`,`_inquiry_date`,`Inquiry_Id`),
  KEY `idx_si_status_list` (`IsDelete`,`OnlineState`,`_inquiry_date`,`Inquiry_Id`),
  KEY `idx_si_type_list` (`IsDelete`,`Inquiry_Type`,`_inquiry_date`,`Inquiry_Id`),
  KEY `idx_si_course_list` (`IsDelete`,`Course_Id`,`_inquiry_date`,`Inquiry_Id`),
  KEY `idx_si_student` (`Student_Id`,`IsDelete`),
  KEY `idx_si_student_dedup` (`Student_Id`,`Inquiry_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=66390 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci ROW_FORMAT=DYNAMIC;

--
-- Table structure for table `student_intake_tokens`
--
DROP TABLE IF EXISTS `student_intake_tokens`;
CREATE TABLE `student_intake_tokens` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `InquiryId` int(11) NOT NULL,
  `Token` varchar(64) NOT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT 1,
  `ExpiresAt` datetime DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Token` (`Token`),
  KEY `idx_inquiry` (`InquiryId`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `student_master`
--
DROP TABLE IF EXISTS `student_master`;
CREATE TABLE `student_master` (
  `Student_Id` int(11) NOT NULL AUTO_INCREMENT,
  `FName` varchar(100) DEFAULT NULL,
  `LName` varchar(100) DEFAULT NULL,
  `MName` varchar(100) DEFAULT NULL,
  `Student_Name` varchar(100) DEFAULT NULL,
  `Qualification` varchar(100) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `DOB` varchar(50) DEFAULT NULL,
  `Sex` varchar(50) DEFAULT NULL,
  `Nationality` varchar(100) DEFAULT NULL,
  `Region` varchar(50) DEFAULT NULL,
  `Present_Address` text DEFAULT NULL,
  `Present_City` varchar(150) DEFAULT NULL,
  `Present_Pin` varchar(200) DEFAULT NULL,
  `Present_State` varchar(50) DEFAULT NULL,
  `Present_Country` varchar(100) DEFAULT NULL,
  `Present_Tel` varchar(50) DEFAULT NULL,
  `Present_Mobile` varchar(50) DEFAULT NULL,
  `Present_Mobile2` varchar(50) DEFAULT NULL,
  `Fax` varchar(50) DEFAULT NULL,
  `Permanent_Address` text DEFAULT NULL,
  `Permanent_City` varchar(200) DEFAULT NULL,
  `Permanent_Pin` varchar(200) DEFAULT NULL,
  `Permanent_State` varchar(50) DEFAULT NULL,
  `Permanent_Country` varchar(100) DEFAULT NULL,
  `Permanent_Tel` varchar(50) DEFAULT NULL,
  `Email` varchar(50) DEFAULT NULL,
  `Other_Training` varchar(50) DEFAULT NULL,
  `AutoCad` varchar(50) DEFAULT NULL,
  `MicroStation` varchar(50) DEFAULT NULL,
  `PDS` varchar(50) DEFAULT NULL,
  `PDMS` varchar(50) DEFAULT NULL,
  `Others` varchar(50) DEFAULT NULL,
  `Occupation` varchar(100) DEFAULT NULL,
  `Company` varchar(150) DEFAULT NULL,
  `Designation` varchar(100) DEFAULT NULL,
  `Company_Add` text DEFAULT NULL,
  `Company_Tel` varchar(50) DEFAULT NULL,
  `Design_Exp` int(11) DEFAULT NULL,
  `Construction_Exp` int(11) DEFAULT NULL,
  `Production_Exp` int(11) DEFAULT NULL,
  `Marketing_Exp` int(11) DEFAULT NULL,
  `Other_Exp` int(11) DEFAULT NULL,
  `Total_Exp` int(11) DEFAULT NULL,
  `Pass_No` varchar(50) DEFAULT NULL,
  `Pass_Issue_Dt` varchar(50) DEFAULT NULL,
  `Pas_Exp_Dt` varchar(50) DEFAULT NULL,
  `Known_Stud` varchar(50) DEFAULT NULL,
  `Known_Web` varchar(50) DEFAULT NULL,
  `Known_Paper` varchar(50) DEFAULT NULL,
  `Known_Other` varchar(50) DEFAULT NULL,
  `Refered_By` varchar(50) DEFAULT NULL,
  `Inquiry` varchar(100) DEFAULT NULL,
  `Student` varchar(100) DEFAULT NULL,
  `Inquiry_From` varchar(100) DEFAULT NULL,
  `Inquiry_Type` varchar(50) DEFAULT NULL,
  `Discussion` text DEFAULT NULL,
  `Inquiry_Dt` varchar(50) DEFAULT NULL,
  `Date_Added` varchar(70) DEFAULT NULL,
  `Aca_Qualification` varchar(50) DEFAULT NULL,
  `Discipline` varchar(50) DEFAULT NULL,
  `Institute` varchar(60) DEFAULT NULL,
  `Year` varchar(50) DEFAULT NULL,
  `Marks` varchar(50) DEFAULT NULL,
  `Batch_Code` varchar(100) DEFAULT NULL,
  `DNC` varchar(50) DEFAULT NULL,
  `Part_Time` varchar(50) DEFAULT NULL,
  `Ex_Student` varchar(50) DEFAULT NULL,
  `Photo` varchar(255) DEFAULT NULL,
  `Quali` varchar(50) DEFAULT NULL,
  `Resi` varchar(50) DEFAULT NULL,
  `Contract` varchar(50) DEFAULT NULL,
  `Marksheet` varchar(50) DEFAULT NULL,
  `Address` varchar(50) DEFAULT NULL,
  `Admission` varchar(50) DEFAULT '0',
  `JobRequired` varchar(50) DEFAULT NULL,
  `Remark` text DEFAULT NULL,
  `CVDate` varchar(50) DEFAULT NULL,
  `SitPerformance` varchar(50) DEFAULT NULL,
  `PlacementRemark` varchar(50) DEFAULT NULL,
  `Accomodation` varchar(50) DEFAULT NULL,
  `Placement_Block` varchar(50) DEFAULT NULL,
  `college_id` int(11) DEFAULT NULL,
  `Admission_Dt` varchar(50) DEFAULT NULL,
  `Father_Name` varchar(50) DEFAULT NULL,
  `Father_Occupation` varchar(50) DEFAULT NULL,
  `Father_Mobile` varchar(50) DEFAULT NULL,
  `Mother_Name` varchar(50) DEFAULT NULL,
  `Mother_Occupation` varchar(50) DEFAULT NULL,
  `Mother_Mobile` varchar(50) DEFAULT NULL,
  `Sibling_Name` varchar(50) DEFAULT NULL,
  `Sibling_Occupation` varchar(50) DEFAULT NULL,
  `Sibling_Mobile` varchar(50) DEFAULT NULL,
  `online_stud_id` int(11) DEFAULT NULL,
  `StateChangeDt` varchar(50) DEFAULT NULL,
  `OnlineState` int(11) DEFAULT NULL,
  `Percentage` varchar(50) DEFAULT NULL,
  `Adm_DNC` varchar(50) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `IsUnread` int(11) DEFAULT NULL,
  `IsUnreadAdm` int(11) DEFAULT NULL,
  `Login_Id` varchar(50) DEFAULT NULL,
  `Login_Password` varchar(100) DEFAULT NULL,
  `Area_Of_Interest` varchar(50) DEFAULT NULL,
  `Notice_Period` varchar(50) DEFAULT NULL,
  `Industry` varchar(50) DEFAULT NULL,
  `Salary` varchar(50) DEFAULT NULL,
  `Business_Nature` varchar(50) DEFAULT NULL,
  `Company_city` varchar(50) DEFAULT NULL,
  `IsAdmOpen` varchar(100) DEFAULT NULL,
  `Placement_Type` varchar(50) DEFAULT NULL,
  `Batch_Category_id` int(11) DEFAULT NULL,
  `Nickname` varchar(50) DEFAULT NULL,
  `Status_id` int(11) DEFAULT NULL,
  `Status_date` varchar(60) DEFAULT NULL,
  `Expected_Location` varchar(50) DEFAULT NULL,
  `Company_id` varchar(50) DEFAULT NULL,
  `EncStudentId` varchar(50) DEFAULT NULL,
  `GCMID` varchar(50) DEFAULT NULL,
  `IMEI` varchar(50) DEFAULT NULL,
  `EncUpdateDate` varchar(50) DEFAULT NULL,
  `PlacementBlockReason` varchar(50) DEFAULT NULL,
  `PlacementBlockReasonRemark` varchar(50) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime NOT NULL DEFAULT current_timestamp(),
  `Transfered` varchar(20) DEFAULT NULL,
  `Moved_To_Course_Id` int(11) DEFAULT NULL,
  `Moved_To_Batch_Code` varchar(100) DEFAULT NULL,
  `Alumni_Registered` varchar(3) DEFAULT NULL,
  `Photo_Data` longblob DEFAULT NULL,
  `Photo_Content_Type` varchar(100) DEFAULT NULL,
  `Photo_File_Name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Student_Id`),
  KEY `idx_sm_list` (`IsDelete`,`Status_id`,`Student_Id`),
  KEY `idx_sm_course` (`Course_Id`),
  KEY `idx_sm_batch_code` (`Batch_Code`)
) ENGINE=MyISAM AUTO_INCREMENT=176779 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_master_aca_rec`
--
DROP TABLE IF EXISTS `student_master_aca_rec`;
CREATE TABLE `student_master_aca_rec` (
  `Academic_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Aca_Qualification` varchar(50) DEFAULT NULL,
  `Discipline` varchar(48) DEFAULT NULL,
  `Institute` varchar(80) DEFAULT NULL,
  `Year` varchar(23) DEFAULT NULL,
  `Marks` varchar(34) DEFAULT NULL,
  `College_id` int(11) DEFAULT NULL,
  `Inquiry_id` varchar(10) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `Quali_Status` varchar(8) DEFAULT NULL,
  `Status_Remark` varchar(499) DEFAULT NULL,
  `Total_KT` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_master_upload`
--
DROP TABLE IF EXISTS `student_master_upload`;
CREATE TABLE `student_master_upload` (
  `Student_Id` int(11) NOT NULL AUTO_INCREMENT,
  `FName` varchar(100) DEFAULT NULL,
  `LName` varchar(100) DEFAULT NULL,
  `MName` varchar(100) DEFAULT NULL,
  `Student_Name` varchar(100) DEFAULT NULL,
  `Qualification` varchar(100) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `DOB` varchar(50) DEFAULT NULL,
  `Sex` varchar(50) DEFAULT NULL,
  `Nationality` varchar(100) DEFAULT NULL,
  `Region` varchar(50) DEFAULT NULL,
  `Present_Address` text DEFAULT NULL,
  `Present_City` varchar(150) DEFAULT NULL,
  `Present_Pin` int(11) DEFAULT NULL,
  `Present_State` varchar(50) DEFAULT NULL,
  `Present_Country` varchar(100) DEFAULT NULL,
  `Present_Tel` varchar(50) DEFAULT NULL,
  `Present_Mobile` varchar(50) DEFAULT NULL,
  `Present_Mobile2` varchar(50) DEFAULT NULL,
  `Fax` varchar(50) DEFAULT NULL,
  `Permanent_Address` text DEFAULT NULL,
  `Permanent_City` varchar(200) DEFAULT NULL,
  `Permanent_Pin` int(11) DEFAULT NULL,
  `Permanent_State` varchar(50) DEFAULT NULL,
  `Permanent_Country` varchar(100) DEFAULT NULL,
  `Permanent_Tel` varchar(50) DEFAULT NULL,
  `Email` varchar(50) DEFAULT NULL,
  `Other_Training` varchar(50) DEFAULT NULL,
  `AutoCad` varchar(50) DEFAULT NULL,
  `MicroStation` varchar(50) DEFAULT NULL,
  `PDS` varchar(50) DEFAULT NULL,
  `PDMS` varchar(50) DEFAULT NULL,
  `Others` varchar(50) DEFAULT NULL,
  `Occupation` varchar(100) DEFAULT NULL,
  `Company` varchar(150) DEFAULT NULL,
  `Designation` varchar(100) DEFAULT NULL,
  `Company_Add` text DEFAULT NULL,
  `Company_Tel` varchar(50) DEFAULT NULL,
  `Design_Exp` int(11) DEFAULT NULL,
  `Construction_Exp` int(11) DEFAULT NULL,
  `Production_Exp` int(11) DEFAULT NULL,
  `Marketing_Exp` int(11) DEFAULT NULL,
  `Other_Exp` int(11) DEFAULT NULL,
  `Total_Exp` int(11) DEFAULT NULL,
  `Pass_No` varchar(50) DEFAULT NULL,
  `Pass_Issue_Dt` varchar(50) DEFAULT NULL,
  `Pas_Exp_Dt` varchar(50) DEFAULT NULL,
  `Known_Stud` varchar(50) DEFAULT NULL,
  `Known_Web` varchar(50) DEFAULT NULL,
  `Known_Paper` varchar(50) DEFAULT NULL,
  `Known_Other` varchar(50) DEFAULT NULL,
  `Refered_By` varchar(50) DEFAULT NULL,
  `Inquiry` varchar(100) DEFAULT NULL,
  `Student` varchar(100) DEFAULT NULL,
  `Inquiry_From` varchar(100) DEFAULT NULL,
  `Inquiry_Type` varchar(50) DEFAULT NULL,
  `Discussion` text DEFAULT NULL,
  `Inquiry_Dt` varchar(50) DEFAULT NULL,
  `Date_Added` varchar(70) DEFAULT NULL,
  `Aca_Qualification` varchar(50) DEFAULT NULL,
  `Discipline` varchar(50) DEFAULT NULL,
  `Institute` varchar(60) DEFAULT NULL,
  `Year` varchar(50) DEFAULT NULL,
  `Marks` varchar(50) DEFAULT NULL,
  `Batch_Code` varchar(100) DEFAULT NULL,
  `DNC` varchar(50) DEFAULT NULL,
  `Part_Time` varchar(50) DEFAULT NULL,
  `Ex_Student` varchar(50) DEFAULT NULL,
  `Photo` varchar(50) DEFAULT NULL,
  `Quali` varchar(50) DEFAULT NULL,
  `Resi` varchar(50) DEFAULT NULL,
  `Contract` varchar(50) DEFAULT NULL,
  `Marksheet` varchar(50) DEFAULT NULL,
  `Address` varchar(50) DEFAULT NULL,
  `Admission` varchar(50) DEFAULT '0',
  `JobRequired` varchar(50) DEFAULT NULL,
  `Remark` varchar(50) DEFAULT NULL,
  `CVDate` varchar(50) DEFAULT NULL,
  `SitPerformance` varchar(50) DEFAULT NULL,
  `PlacementRemark` varchar(50) DEFAULT NULL,
  `Accomodation` varchar(50) DEFAULT NULL,
  `Placement_Block` varchar(50) DEFAULT NULL,
  `college_id` int(11) DEFAULT NULL,
  `Admission_Dt` varchar(50) DEFAULT NULL,
  `Father_Name` varchar(50) DEFAULT NULL,
  `Father_Occupation` varchar(50) DEFAULT NULL,
  `Father_Mobile` varchar(50) DEFAULT NULL,
  `Mother_Name` varchar(50) DEFAULT NULL,
  `Mother_Occupation` varchar(50) DEFAULT NULL,
  `Mother_Mobile` varchar(50) DEFAULT NULL,
  `Sibling_Name` varchar(50) DEFAULT NULL,
  `Sibling_Occupation` varchar(50) DEFAULT NULL,
  `Sibling_Mobile` varchar(50) DEFAULT NULL,
  `online_stud_id` int(11) DEFAULT NULL,
  `StateChangeDt` varchar(50) DEFAULT NULL,
  `OnlineState` int(11) DEFAULT NULL,
  `Percentage` varchar(50) DEFAULT NULL,
  `Adm_DNC` varchar(50) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `IsUnread` int(11) DEFAULT NULL,
  `IsUnreadAdm` int(11) DEFAULT NULL,
  `Login_Id` varchar(50) DEFAULT NULL,
  `Login_Password` varchar(100) DEFAULT NULL,
  `Area_Of_Interest` varchar(50) DEFAULT NULL,
  `Notice_Period` varchar(50) DEFAULT NULL,
  `Industry` varchar(50) DEFAULT NULL,
  `Salary` varchar(50) DEFAULT NULL,
  `Business_Nature` varchar(50) DEFAULT NULL,
  `Company_city` varchar(50) DEFAULT NULL,
  `IsAdmOpen` varchar(100) DEFAULT NULL,
  `Placement_Type` varchar(50) DEFAULT NULL,
  `Batch_Category_id` int(11) DEFAULT NULL,
  `Nickname` varchar(50) DEFAULT NULL,
  `Status_id` int(11) DEFAULT NULL,
  `Status_date` varchar(60) DEFAULT NULL,
  `Expected_Location` varchar(50) DEFAULT NULL,
  `Company_id` varchar(50) DEFAULT NULL,
  `EncStudentId` varchar(50) DEFAULT NULL,
  `GCMID` varchar(50) DEFAULT NULL,
  `IMEI` varchar(50) DEFAULT NULL,
  `EncUpdateDate` varchar(50) DEFAULT NULL,
  `PlacementBlockReason` varchar(50) DEFAULT NULL,
  `PlacementBlockReasonRemark` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Student_Id`)
) ENGINE=MyISAM AUTO_INCREMENT=174964 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_master_work_exp`
--
DROP TABLE IF EXISTS `student_master_work_exp`;
CREATE TABLE `student_master_work_exp` (
  `Exp_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` int(11) DEFAULT NULL,
  `Company` varchar(255) DEFAULT NULL,
  `Business_Nature` varchar(255) DEFAULT NULL,
  `Designation` varchar(50) DEFAULT NULL,
  `Address` text DEFAULT NULL,
  `City` varchar(50) DEFAULT NULL,
  `Telephone` varchar(50) DEFAULT NULL,
  `Duration` varchar(50) DEFAULT NULL,
  `Salary` varchar(50) DEFAULT NULL,
  `Start_date` varchar(30) DEFAULT NULL,
  `End_date` varchar(30) DEFAULT NULL,
  `Status` varchar(50) DEFAULT NULL,
  `On_work_details` varchar(278) DEFAULT NULL,
  `Exp_Month` varchar(50) DEFAULT NULL,
  `Exp_Year` varchar(50) DEFAULT NULL,
  `Inquiry_id` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `Industry` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Exp_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=24556 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `student_portal_auth`
--
DROP TABLE IF EXISTS `student_portal_auth`;
CREATE TABLE `student_portal_auth` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` varchar(50) NOT NULL,
  `Username` varchar(100) NOT NULL,
  `Password_Hash` char(32) NOT NULL,
  `IsActive` tinyint(4) NOT NULL DEFAULT 1,
  `Created_Date` datetime NOT NULL DEFAULT current_timestamp(),
  `Last_Login` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `uniq_username` (`Username`),
  KEY `idx_student_id` (`Student_Id`),
  KEY `idx_isactive` (`IsActive`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `student_report`
--
DROP TABLE IF EXISTS `student_report`;
CREATE TABLE `student_report` (
  `Result_Id` int(11) DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Code` bigint(20) DEFAULT NULL,
  `Student_Name` varchar(49) DEFAULT NULL,
  `Ass1_ID` varchar(15) DEFAULT NULL,
  `Ass1_Max` int(11) DEFAULT NULL,
  `Ass1_Given` int(11) DEFAULT NULL,
  `Ass1_Status` int(11) DEFAULT NULL,
  `Ass2_ID` varchar(19) DEFAULT NULL,
  `Ass2_Max` int(11) DEFAULT NULL,
  `Ass2_Given` int(11) DEFAULT NULL,
  `Ass2_Status` int(11) DEFAULT NULL,
  `Ass3_ID` varchar(20) DEFAULT NULL,
  `Ass3_Max` int(11) DEFAULT NULL,
  `Ass3_Given` int(11) DEFAULT NULL,
  `Ass3_Status` int(11) DEFAULT NULL,
  `Ass4_ID` varchar(18) DEFAULT NULL,
  `Ass4_Max` int(11) DEFAULT NULL,
  `Ass4_Given` int(11) DEFAULT NULL,
  `Ass4_Status` int(11) DEFAULT NULL,
  `Ass5_ID` varchar(20) DEFAULT NULL,
  `Ass5_Max` int(11) DEFAULT NULL,
  `Ass5_Given` int(11) DEFAULT NULL,
  `Ass5_Status` int(11) DEFAULT NULL,
  `Ass6_ID` varchar(15) DEFAULT NULL,
  `Ass6_Max` int(11) DEFAULT NULL,
  `Ass6_Given` int(11) DEFAULT NULL,
  `Ass6_Status` int(11) DEFAULT NULL,
  `Ass7_ID` varchar(15) DEFAULT NULL,
  `Ass7_Max` int(11) DEFAULT NULL,
  `Ass7_Given` int(11) DEFAULT NULL,
  `Ass7_Status` int(11) DEFAULT NULL,
  `Ass8_ID` varchar(14) DEFAULT NULL,
  `Ass8_Max` int(11) DEFAULT NULL,
  `Ass8_Given` int(11) DEFAULT NULL,
  `Ass8_Status` int(11) DEFAULT NULL,
  `Ass9_ID` varchar(14) DEFAULT NULL,
  `Ass9_Max` int(11) DEFAULT NULL,
  `Ass9_Given` int(11) DEFAULT NULL,
  `Ass9_Status` int(11) DEFAULT NULL,
  `Ass10_ID` varchar(8) DEFAULT NULL,
  `Ass10_Max` int(11) DEFAULT NULL,
  `Ass10_Given` int(11) DEFAULT NULL,
  `Ass10_Status` int(11) DEFAULT NULL,
  `Ass11_ID` varchar(10) DEFAULT NULL,
  `Ass11_Max` int(11) DEFAULT NULL,
  `Ass11_Given` int(11) DEFAULT NULL,
  `Ass11_Status` int(11) DEFAULT NULL,
  `Ass12_ID` varchar(10) DEFAULT NULL,
  `Ass12_Max` int(11) DEFAULT NULL,
  `Ass12_Given` int(11) DEFAULT NULL,
  `Ass12_Status` int(11) DEFAULT NULL,
  `Ass13_ID` varchar(10) DEFAULT NULL,
  `Ass13_Max` int(11) DEFAULT NULL,
  `Ass13_Given` int(11) DEFAULT NULL,
  `Ass13_Status` int(11) DEFAULT NULL,
  `Ass14_ID` varchar(10) DEFAULT NULL,
  `Ass14_Max` int(11) DEFAULT NULL,
  `Ass14_Given` int(11) DEFAULT NULL,
  `Ass14_Status` int(11) DEFAULT NULL,
  `Ass15_ID` varchar(10) DEFAULT NULL,
  `Ass15_Max` int(11) DEFAULT NULL,
  `Ass15_Given` int(11) DEFAULT NULL,
  `Ass15_Status` int(11) DEFAULT NULL,
  `Ass16_ID` varchar(10) DEFAULT NULL,
  `Ass16_Max` int(11) DEFAULT NULL,
  `Ass16_Given` int(11) DEFAULT NULL,
  `Ass16_Status` int(11) DEFAULT NULL,
  `Ass17_ID` varchar(10) DEFAULT NULL,
  `Ass17_Max` int(11) DEFAULT NULL,
  `Ass17_Given` int(11) DEFAULT NULL,
  `Ass17_Status` int(11) DEFAULT NULL,
  `Ass18_ID` varchar(10) DEFAULT NULL,
  `Ass18_Max` int(11) DEFAULT NULL,
  `Ass18_Given` int(11) DEFAULT NULL,
  `Ass18_Status` int(11) DEFAULT NULL,
  `Ass19_ID` varchar(10) DEFAULT NULL,
  `Ass19_Max` int(11) DEFAULT NULL,
  `Ass19_Given` int(11) DEFAULT NULL,
  `Ass19_Status` int(11) DEFAULT NULL,
  `Ass20_ID` varchar(10) DEFAULT NULL,
  `Ass20_Max` int(11) DEFAULT NULL,
  `Ass20_Given` int(11) DEFAULT NULL,
  `Ass20_Status` int(11) DEFAULT NULL,
  `Ass_Percent` decimal(4,2) DEFAULT NULL,
  `Test1_ID` varchar(28) DEFAULT NULL,
  `Test1_Max` int(11) DEFAULT NULL,
  `Test1_Given` int(11) DEFAULT NULL,
  `Test1_Status` int(11) DEFAULT NULL,
  `Test2_ID` varchar(19) DEFAULT NULL,
  `Test2_Max` int(11) DEFAULT NULL,
  `Test2_Given` int(11) DEFAULT NULL,
  `Test2_Status` int(11) DEFAULT NULL,
  `Test3_ID` varchar(17) DEFAULT NULL,
  `Test3_Max` int(11) DEFAULT NULL,
  `Test3_Given` int(11) DEFAULT NULL,
  `Test3_Status` int(11) DEFAULT NULL,
  `Test4_ID` varchar(25) DEFAULT NULL,
  `Test4_Max` int(11) DEFAULT NULL,
  `Test4_Given` int(11) DEFAULT NULL,
  `Test4_Status` int(11) DEFAULT NULL,
  `Test5_ID` varchar(26) DEFAULT NULL,
  `Test5_Max` int(11) DEFAULT NULL,
  `Test5_Given` int(11) DEFAULT NULL,
  `Test5_Status` int(11) DEFAULT NULL,
  `Test6_ID` varchar(14) DEFAULT NULL,
  `Test6_Max` int(11) DEFAULT NULL,
  `Test6_Given` int(11) DEFAULT NULL,
  `Test6_Status` int(11) DEFAULT NULL,
  `Test7_ID` varchar(23) DEFAULT NULL,
  `Test7_Max` int(11) DEFAULT NULL,
  `Test7_Given` int(11) DEFAULT NULL,
  `Test7_Status` int(11) DEFAULT NULL,
  `Test8_ID` varchar(14) DEFAULT NULL,
  `Test8_Max` int(11) DEFAULT NULL,
  `Test8_Given` int(11) DEFAULT NULL,
  `Test8_Status` int(11) DEFAULT NULL,
  `Test9_ID` varchar(14) DEFAULT NULL,
  `Test9_Max` int(11) DEFAULT NULL,
  `Test9_Given` int(11) DEFAULT NULL,
  `Test9_Status` int(11) DEFAULT NULL,
  `Test10_ID` varchar(14) DEFAULT NULL,
  `Test10_Max` int(11) DEFAULT NULL,
  `Test10_Given` int(11) DEFAULT NULL,
  `Test10_Status` int(11) DEFAULT NULL,
  `Test11_ID` varchar(14) DEFAULT NULL,
  `Test11_Max` int(11) DEFAULT NULL,
  `Test11_Given` int(11) DEFAULT NULL,
  `Test11_Status` int(11) DEFAULT NULL,
  `Test12_ID` varchar(10) DEFAULT NULL,
  `Test12_Max` int(11) DEFAULT NULL,
  `Test12_Given` int(11) DEFAULT NULL,
  `Test12_Status` int(11) DEFAULT NULL,
  `Test13_ID` varchar(10) DEFAULT NULL,
  `Test13_Max` int(11) DEFAULT NULL,
  `Test13_Given` int(11) DEFAULT NULL,
  `Test13_Status` int(11) DEFAULT NULL,
  `Test14_ID` varchar(10) DEFAULT NULL,
  `Test14_Max` int(11) DEFAULT NULL,
  `Test14_Given` int(11) DEFAULT NULL,
  `Test14_Status` int(11) DEFAULT NULL,
  `Test15_ID` varchar(10) DEFAULT NULL,
  `Test15_Max` int(11) DEFAULT NULL,
  `Test15_Given` int(11) DEFAULT NULL,
  `Test15_Status` int(11) DEFAULT NULL,
  `Test16_ID` varchar(10) DEFAULT NULL,
  `Test16_Max` int(11) DEFAULT NULL,
  `Test16_Given` int(11) DEFAULT NULL,
  `Test16_Status` int(11) DEFAULT NULL,
  `Test17_ID` varchar(10) DEFAULT NULL,
  `Test17_Max` int(11) DEFAULT NULL,
  `Test17_Given` int(11) DEFAULT NULL,
  `Test17_Status` int(11) DEFAULT NULL,
  `Test18_ID` varchar(10) DEFAULT NULL,
  `Test18_Max` int(11) DEFAULT NULL,
  `Test18_Given` int(11) DEFAULT NULL,
  `Test18_Status` int(11) DEFAULT NULL,
  `Test19_ID` varchar(10) DEFAULT NULL,
  `Test19_Max` int(11) DEFAULT NULL,
  `Test19_Given` int(11) DEFAULT NULL,
  `Test19_Status` int(11) DEFAULT NULL,
  `Test20_ID` varchar(10) DEFAULT NULL,
  `Test20_Max` int(11) DEFAULT NULL,
  `Test20_Given` int(11) DEFAULT NULL,
  `Test20_Status` int(11) DEFAULT NULL,
  `Test_PErcent` decimal(4,2) DEFAULT NULL,
  `Final1_Max` int(11) DEFAULT NULL,
  `Final1_Given` decimal(4,1) DEFAULT NULL,
  `Final1_Status` int(11) DEFAULT NULL,
  `Final2_Max` int(11) DEFAULT NULL,
  `Final2_Given` int(11) DEFAULT NULL,
  `Final2_Status` int(11) DEFAULT NULL,
  `Final3_Max` int(11) DEFAULT NULL,
  `Final3_Given` int(11) DEFAULT NULL,
  `Final3_Status` int(11) DEFAULT NULL,
  `Final_Percent` decimal(4,2) DEFAULT NULL,
  `Full_Attend` decimal(9,6) DEFAULT NULL,
  `Viva1_ID` varchar(10) DEFAULT NULL,
  `Viva1_Max` int(11) DEFAULT NULL,
  `Viva1_Given` int(11) DEFAULT NULL,
  `Viva1_Status` int(11) DEFAULT NULL,
  `Viva2_ID` varchar(10) DEFAULT NULL,
  `Viva2_Max` int(11) DEFAULT NULL,
  `Viva2_Given` int(11) DEFAULT NULL,
  `Viva2_Status` int(11) DEFAULT NULL,
  `Viva3_ID` varchar(10) DEFAULT NULL,
  `Viva3_Max` int(11) DEFAULT NULL,
  `Viva3_Given` int(11) DEFAULT NULL,
  `Viva3_Status` int(11) DEFAULT NULL,
  `Viva4_ID` varchar(10) DEFAULT NULL,
  `Viva4_Max` int(11) DEFAULT NULL,
  `Viva4_Given` int(11) DEFAULT NULL,
  `Viva4_Status` int(11) DEFAULT NULL,
  `Viva5_ID` varchar(10) DEFAULT NULL,
  `Viva5_Max` int(11) DEFAULT NULL,
  `Viva5_Given` int(11) DEFAULT NULL,
  `Viva5_Status` int(11) DEFAULT NULL,
  `Viva6_ID` varchar(10) DEFAULT NULL,
  `Viva6_Max` int(11) DEFAULT NULL,
  `Viva6_Given` int(11) DEFAULT NULL,
  `Viva6_Status` int(11) DEFAULT NULL,
  `Viva7_ID` varchar(10) DEFAULT NULL,
  `Viva7_Max` int(11) DEFAULT NULL,
  `Viva7_Given` int(11) DEFAULT NULL,
  `Viva7_Status` int(11) DEFAULT NULL,
  `Viva8_ID` varchar(10) DEFAULT NULL,
  `Viva8_Max` int(11) DEFAULT NULL,
  `Viva8_Given` int(11) DEFAULT NULL,
  `Viva8_Status` int(11) DEFAULT NULL,
  `Viva9_ID` varchar(10) DEFAULT NULL,
  `Viva9_Max` int(11) DEFAULT NULL,
  `Viva9_Given` int(11) DEFAULT NULL,
  `Viva9_Status` int(11) DEFAULT NULL,
  `Viva10_ID` varchar(10) DEFAULT NULL,
  `Viva10_Max` int(11) DEFAULT NULL,
  `Viva10_Given` int(11) DEFAULT NULL,
  `Viva10_Status` int(11) DEFAULT NULL,
  `Viva_Percent` int(11) DEFAULT NULL,
  `Final_Result_Percent` decimal(5,2) DEFAULT NULL,
  `Grade` varchar(14) DEFAULT NULL,
  `date_Added` varchar(10) DEFAULT NULL,
  `Course_Details` varchar(1861) DEFAULT NULL,
  `Total_Lectures` int(11) DEFAULT NULL,
  `AttenLectures` int(11) DEFAULT NULL,
  `AttenPercent` decimal(9,6) DEFAULT NULL,
  `TotAss` int(11) DEFAULT NULL,
  `SubAss` int(11) DEFAULT NULL,
  `TotUnit` int(11) DEFAULT NULL,
  `SubUnit` int(11) DEFAULT NULL,
  `PreparedBy` varchar(23) DEFAULT NULL,
  `CheckedBy` varchar(25) DEFAULT NULL,
  `ApprovedBy` varchar(22) DEFAULT NULL,
  `Discipline` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) DEFAULT NULL,
  `PreparedLabel` varchar(20) DEFAULT NULL,
  `CheckedLabel` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `studet_id`
--
DROP TABLE IF EXISTS `studet_id`;
CREATE TABLE `studet_id` (
  `Student_Id` int(11) DEFAULT NULL,
  `Status_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `support_ticket_replies`
--
DROP TABLE IF EXISTS `support_ticket_replies`;
CREATE TABLE `support_ticket_replies` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint(20) NOT NULL,
  `message` longtext NOT NULL,
  `author_user_id` int(11) DEFAULT NULL,
  `author_name` varchar(255) DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_replies_ticket` (`ticket_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `support_tickets`
--
DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE `support_tickets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `subject` varchar(255) NOT NULL,
  `category` varchar(80) DEFAULT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'normal',
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `message` longtext NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `user_email` varchar(255) DEFAULT NULL,
  `role_id` int(11) DEFAULT NULL,
  `department` varchar(120) DEFAULT NULL,
  `reply_count` int(11) NOT NULL DEFAULT 0,
  `last_reply_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tickets_user` (`user_id`,`created_at`),
  KEY `idx_tickets_status` (`status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `suvidya_inquiry_sync`
--
DROP TABLE IF EXISTS `suvidya_inquiry_sync`;
CREATE TABLE `suvidya_inquiry_sync` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `source_table_name` varchar(100) NOT NULL,
  `source_inquiry_id` bigint(20) NOT NULL,
  `inquiry_id` int(11) DEFAULT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `course_name` varchar(255) DEFAULT NULL,
  `page_source` varchar(255) DEFAULT NULL,
  `created_date` varchar(100) DEFAULT NULL,
  `payload_json` longtext DEFAULT NULL,
  `synced_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suvidya_source` (`source_table_name`,`source_inquiry_id`),
  KEY `idx_suvidya_inquiry_id` (`inquiry_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1750 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `suvidya_inquiry_sync_runs`
--
DROP TABLE IF EXISTS `suvidya_inquiry_sync_runs`;
CREATE TABLE `suvidya_inquiry_sync_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `scope` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL,
  `run_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `summary_json` longtext DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_suvidya_sync_runs_scope_id` (`scope`,`id`),
  KEY `idx_suvidya_sync_runs_run_at` (`run_at`)
) ENGINE=InnoDB AUTO_INCREMENT=47605 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `sync_state`
--
DROP TABLE IF EXISTS `sync_state`;
CREATE TABLE `sync_state` (
  `name` varchar(255) NOT NULL,
  `last_pk_json` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `system_activity_log`
--
DROP TABLE IF EXISTS `system_activity_log`;
CREATE TABLE `system_activity_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `table_name` varchar(120) NOT NULL,
  `action_type` varchar(30) NOT NULL,
  `record_id` varchar(80) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `endpoint` varchar(255) DEFAULT NULL,
  `details_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity_table_created` (`table_name`,`created_at`),
  KEY `idx_activity_user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3882 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `test_taken_child`
--
DROP TABLE IF EXISTS `test_taken_child`;
CREATE TABLE `test_taken_child` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Take_Id` int(11) DEFAULT NULL,
  `Test_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Name` varchar(100) DEFAULT NULL,
  `Marks_Given` int(11) DEFAULT NULL,
  `Marks_from` int(11) DEFAULT NULL,
  `Status` varchar(25) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM AUTO_INCREMENT=158053 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `test_taken_master`
--
DROP TABLE IF EXISTS `test_taken_master`;
CREATE TABLE `test_taken_master` (
  `Take_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Test_Id` int(11) DEFAULT NULL,
  `Test_No` int(11) DEFAULT NULL,
  `Marks` int(11) DEFAULT NULL,
  `Test_Dt` varchar(15) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`Take_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=3684 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `testimonial_master`
--
DROP TABLE IF EXISTS `testimonial_master`;
CREATE TABLE `testimonial_master` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Student_Id` int(11) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  `Description` text DEFAULT NULL,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `StudName` text DEFAULT NULL,
  `date_added` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=290 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `timining_org`
--
DROP TABLE IF EXISTS `timining_org`;
CREATE TABLE `timining_org` (
  `Timing` varchar(7) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `trainer_attendance`
--
DROP TABLE IF EXISTS `trainer_attendance`;
CREATE TABLE `trainer_attendance` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Faculty_Id` int(11) NOT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Attend_Date` date NOT NULL,
  `Check_In` time DEFAULT NULL,
  `Check_Out` time DEFAULT NULL,
  `Status` varchar(30) NOT NULL DEFAULT 'Present',
  `Remarks` text DEFAULT NULL,
  `Created_Date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`Id`),
  UNIQUE KEY `uniq_faculty_date` (`Faculty_Id`,`Attend_Date`),
  KEY `idx_faculty_id` (`Faculty_Id`),
  KEY `idx_attend_date` (`Attend_Date`),
  KEY `idx_batch_id` (`Batch_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `trainer_portal_auth`
--
DROP TABLE IF EXISTS `trainer_portal_auth`;
CREATE TABLE `trainer_portal_auth` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Faculty_Id` int(11) NOT NULL,
  `Username` varchar(100) NOT NULL,
  `Password_Hash` char(32) NOT NULL,
  `IsActive` tinyint(4) NOT NULL DEFAULT 1,
  `Created_Date` datetime NOT NULL DEFAULT current_timestamp(),
  `Last_Login` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `uniq_username` (`Username`),
  KEY `idx_faculty_id` (`Faculty_Id`),
  KEY `idx_isactive` (`IsActive`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `trainer_schedule_override`
--
DROP TABLE IF EXISTS `trainer_schedule_override`;
CREATE TABLE `trainer_schedule_override` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Faculty_Id` int(11) NOT NULL,
  `Work_Date` date NOT NULL,
  `InTime` time NOT NULL,
  `OutTime` time NOT NULL,
  `Created_At` datetime NOT NULL DEFAULT current_timestamp(),
  `Updated_At` datetime DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `uniq_faculty_date` (`Faculty_Id`,`Work_Date`),
  KEY `idx_work_date` (`Work_Date`),
  KEY `idx_faculty_id` (`Faculty_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `training_dashboard_meta`
--
DROP TABLE IF EXISTS `training_dashboard_meta`;
CREATE TABLE `training_dashboard_meta` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `widget_type` varchar(40) NOT NULL,
  `entity_key` varchar(160) NOT NULL,
  `status` varchar(40) DEFAULT NULL,
  `numeric_value` int(11) DEFAULT NULL,
  `date_value` date DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_training_dashboard_meta_widget_entity` (`widget_type`,`entity_key`),
  KEY `idx_training_dashboard_meta_widget` (`widget_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `training_feedback_forms`
--
DROP TABLE IF EXISTS `training_feedback_forms`;
CREATE TABLE `training_feedback_forms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stage_percent` int(11) NOT NULL,
  `training_program` varchar(255) DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `batch_no` varchar(100) DEFAULT NULL,
  `feedback_date` date DEFAULT NULL,
  `schema_json` longtext NOT NULL,
  `published` tinyint(4) NOT NULL DEFAULT 0,
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stage_percent` (`stage_percent`),
  KEY `idx_published` (`published`),
  KEY `idx_deleted` (`deleted`),
  KEY `idx_feedback_date` (`feedback_date`),
  KEY `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `training_feedback_submissions`
--
DROP TABLE IF EXISTS `training_feedback_submissions`;
CREATE TABLE `training_feedback_submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `student_code` varchar(50) DEFAULT NULL,
  `student_name` varchar(150) DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `answers_json` longtext NOT NULL,
  `submitted_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_form_student` (`form_id`,`student_id`),
  KEY `idx_form` (`form_id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `viva_moc_child`
--
DROP TABLE IF EXISTS `viva_moc_child`;
CREATE TABLE `viva_moc_child` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `viva_id` int(11) NOT NULL,
  `Student_Id` int(11) NOT NULL,
  `Admission_Id` int(11) DEFAULT NULL,
  `Marks` decimal(6,2) DEFAULT NULL,
  `Discipline_Marks` decimal(6,2) DEFAULT NULL,
  `Status` varchar(20) NOT NULL DEFAULT 'Present',
  `IsDelete` tinyint(1) NOT NULL DEFAULT 0,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_viva_student` (`viva_id`,`Student_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Table structure for table `viva_taken`
--
DROP TABLE IF EXISTS `viva_taken`;
CREATE TABLE `viva_taken` (
  `Take_Id` int(11) NOT NULL AUTO_INCREMENT,
  `Course_Id` int(11) DEFAULT NULL,
  `Batch_Id` int(11) DEFAULT NULL,
  `Marks` int(11) DEFAULT NULL,
  `Viva_Id` int(11) DEFAULT NULL,
  `Take_Dt` varchar(15) DEFAULT NULL,
  `Date_Added` varchar(15) DEFAULT NULL,
  `IsActive` int(11) DEFAULT NULL,
  `IsDelete` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Take_Id`)
) ENGINE=InnoDB AUTO_INCREMENT=168 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `viva_taken_child`
--
DROP TABLE IF EXISTS `viva_taken_child`;
CREATE TABLE `viva_taken_child` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Take_Id` int(11) DEFAULT NULL,
  `Student_Id` int(11) DEFAULT NULL,
  `Student_Name` varchar(100) DEFAULT NULL,
  `Marks_Given` int(11) DEFAULT NULL,
  `Status` varchar(20) DEFAULT NULL,
  `Remark` varchar(150) DEFAULT NULL,
  `IsActive` int(11) DEFAULT 1,
  `IsDelete` int(11) DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM AUTO_INCREMENT=10065 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

--
-- Table structure for table `wa_booked_slots`
--
DROP TABLE IF EXISTS `wa_booked_slots`;
CREATE TABLE `wa_booked_slots` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lead_id` bigint(20) unsigned NOT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `course` varchar(255) DEFAULT NULL,
  `slot_date` date DEFAULT NULL,
  `slot_label` varchar(100) DEFAULT NULL,
  `booked_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lead_id` (`lead_id`),
  KEY `idx_slot_date` (`slot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Table structure for table `website_inquiry_sync_map`
--
DROP TABLE IF EXISTS `website_inquiry_sync_map`;
CREATE TABLE `website_inquiry_sync_map` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `source_name` varchar(64) NOT NULL,
  `source_inquiry_id` varchar(191) NOT NULL,
  `local_inquiry_id` bigint(20) unsigned NOT NULL,
  `last_synced_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_source_record` (`source_name`,`source_inquiry_id`),
  KEY `idx_local_inquiry_id` (`local_inquiry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- View structure for view `child`
--
DROP VIEW IF EXISTS `child`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY INVOKER VIEW `child` AS select '' AS `Gen_id`,`student_report`.`Course_Id` AS `Course_Id`,`student_report`.`Batch_Id` AS `Batch_Id`,`student_report`.`Student_Id` AS `Student_Id`,`student_report`.`Student_Code` AS `Student_Code`,`student_report`.`Student_Name` AS `Student_Name`,`student_report`.`Ass1_Status` AS `Ass1_Status`,`student_report`.`Ass1_Max` AS `Ass1_Max`,`student_report`.`Ass1_Given` AS `Ass1_Given`,`student_report`.`Ass2_Status` AS `Ass2_Status`,`student_report`.`Ass2_Max` AS `Ass2_Max`,`student_report`.`Ass2_Given` AS `Ass2_Given`,`student_report`.`Ass3_Status` AS `Ass3_Status`,`student_report`.`Ass3_Max` AS `Ass3_Max`,`student_report`.`Ass3_Given` AS `Ass3_Given`,`student_report`.`Ass4_Status` AS `Ass4_Status`,`student_report`.`Ass4_Max` AS `Ass4_Max`,`student_report`.`Ass4_Given` AS `Ass4_Given`,`student_report`.`Ass5_Status` AS `Ass5_Status`,`student_report`.`Ass5_Max` AS `Ass5_Max`,`student_report`.`Ass5_Given` AS `Ass5_Given`,`student_report`.`Ass6_Status` AS `Ass6_Status`,`student_report`.`Ass6_Max` AS `Ass6_Max`,`student_report`.`Ass6_Given` AS `Ass6_Given`,`student_report`.`Ass7_Status` AS `Ass7_Status`,`student_report`.`Ass7_Max` AS `Ass7_Max`,`student_report`.`Ass7_Given` AS `Ass7_Given`,`student_report`.`Ass8_Status` AS `Ass8_Status`,`student_report`.`Ass8_Max` AS `Ass8_Max`,`student_report`.`Ass8_Given` AS `Ass8_Given`,`student_report`.`Ass9_Status` AS `Ass9_Status`,`student_report`.`Ass9_Max` AS `Ass9_Max`,`student_report`.`Ass9_Given` AS `Ass9_Given`,`student_report`.`Ass10_Status` AS `Ass10_Status`,`student_report`.`Ass10_Max` AS `Ass10_Max`,`student_report`.`Ass10_Given` AS `Ass10_Given`,`student_report`.`Ass_Percent` AS `Ass_Percent`,`student_report`.`Test1_Given` AS `Test1_Given`,`student_report`.`Test1_Max` AS `Test1_Max`,`student_report`.`Test1_Status` AS `Test1_Status`,`student_report`.`Test2_Given` AS `Test2_Given`,`student_report`.`Test2_Max` AS `Test2_Max`,`student_report`.`Test2_Status` AS `Test2_Status`,`student_report`.`Test3_Given` AS `Test3_Given`,`student_report`.`Test3_Max` AS `Test3_Max`,`student_report`.`Test3_Status` AS `Test3_Status`,`student_report`.`Test4_Given` AS `Test4_Given`,`student_report`.`Test4_Max` AS `Test4_Max`,`student_report`.`Test4_Status` AS `Test4_Status`,`student_report`.`Test5_Given` AS `Test5_Given`,`student_report`.`Test5_Max` AS `Test5_Max`,`student_report`.`Test5_Status` AS `Test5_Status`,`student_report`.`Test6_Given` AS `Test6_Given`,`student_report`.`Test6_Max` AS `Test6_Max`,`student_report`.`Test6_Status` AS `Test6_Status`,`student_report`.`Test7_Given` AS `Test7_Given`,`student_report`.`Test7_Max` AS `Test7_Max`,`student_report`.`Test7_Status` AS `Test7_Status`,`student_report`.`Test8_Given` AS `Test8_Given`,`student_report`.`Test8_Max` AS `Test8_Max`,`student_report`.`Test8_Status` AS `Test8_Status`,`student_report`.`Test9_Given` AS `Test9_Given`,`student_report`.`Test9_Max` AS `Test9_Max`,`student_report`.`Test9_Status` AS `Test9_Status`,`student_report`.`Test10_Given` AS `Test10_Given`,`student_report`.`Test10_Max` AS `Test10_Max`,`student_report`.`Test10_Status` AS `Test10_Status`,`student_report`.`Test_PErcent` AS `Test_Percent`,`student_report`.`Viva_Percent` AS `Viva_Percent`,`student_report`.`Final1_Max` AS `Final1_Max`,`student_report`.`Final1_Given` AS `Final1_Given`,`student_report`.`Final1_Status` AS `Final1_Status`,`student_report`.`Final2_Max` AS `Final2_Max`,`student_report`.`Final2_Given` AS `Final2_Given`,`student_report`.`Final2_Status` AS `Final2_Status`,`student_report`.`Final3_Max` AS `Final3_Max`,`student_report`.`Final3_Given` AS `Final3_Given`,`student_report`.`Final3_Status` AS `Final3_Status`,`student_report`.`Final_Percent` AS `Final_Percent`,`student_report`.`Full_Attend` AS `Full_Attend`,`student_report`.`Total_Lectures` AS `Total_Lectures`,`student_report`.`AttenLectures` AS `AttenLectures`,`student_report`.`AttenPercent` AS `Full_Attendance`,`student_report`.`TotAss` AS `Total_Assignments`,`student_report`.`SubAss` AS `Given_Assignments`,`student_report`.`TotUnit` AS `Total_Tests`,`student_report`.`SubUnit` AS `Given_Tests`,`student_report`.`Discipline` AS `Discipline`,`student_report`.`Final_Result_Percent` AS `Final_Result_Percent`,`student_report`.`Grade` AS `Grade`,`student_report`.`Total_Lectures` - `student_report`.`AttenLectures` AS `Absents`,`student_report`.`IsDelete` AS `deleted` from `student_report`;

--
-- View structure for view `sit_alumni_before_2023`
--
DROP VIEW IF EXISTS `sit_alumni_before_2023`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY INVOKER VIEW `sit_alumni_before_2023` AS select `c`.`Student_Id` AS `Student_Id`,`sm`.`Student_Name` AS `Student_Name`,`sm`.`Present_Address` AS `Present_Address`,`sm`.`Present_Mobile` AS `Present_Mobile`,`sm`.`Present_Tel` AS `Present_Tel`,`sm`.`Email` AS `Email`,`s`.`TDate` AS `TDate`,`c`.`Placement` AS `Placement`,`s`.`CompanyName` AS `CompanyName` from ((`cv_shortlisted` `s` left join `cvchild` `c` on(`c`.`CV_Id` = `s`.`id`)) left join `student_master` `sm` on(`c`.`Student_Id` = `sm`.`Student_Id`)) where `s`.`TDate` < '2023-01-01';

--
-- View structure for view `sit_alumni_of_before_2023`
--
DROP VIEW IF EXISTS `sit_alumni_of_before_2023`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY INVOKER VIEW `sit_alumni_of_before_2023` AS select `c`.`Student_Id` AS `Student_Id`,`sm`.`Student_Name` AS `Student_Name`,`am`.`Admission_Date` AS `Admission_Date`,`sm`.`Present_Address` AS `Present_Address`,`sm`.`Present_Mobile` AS `Present_Mobile`,`sm`.`Present_Tel` AS `Present_Tel`,`sm`.`Email` AS `Email`,`s`.`TDate` AS `Placement_Date`,`c`.`Placement` AS `Placement`,`s`.`CompanyName` AS `CompanyName` from (((`admission_master` `am` left join `student_master` `sm` on(`am`.`Student_Id` = `sm`.`Student_Id`)) left join `cvchild` `c` on(`c`.`Student_Id` = `sm`.`Student_Id`)) left join `cv_shortlisted` `s` on(`c`.`CV_Id` = `s`.`id`)) where `am`.`IsDelete` = 0 and `am`.`IsActive` = 1 and `sm`.`IsDelete` = 0 and `sm`.`Status_id` = 8 and `am`.`Admission_Date` < '2023-01-01';

--
-- View structure for view `student_contact`
--
DROP VIEW IF EXISTS `student_contact`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY INVOKER VIEW `student_contact` AS select distinct `sm`.`Student_Name` AS `Student_Name`,`sm`.`Email` AS `Email`,`sm`.`Present_Mobile` AS `Present_Mobile` from (((`admission_master` `am` left join `student_master` `sm` on(`sm`.`Student_Id` = `am`.`Student_Id`)) left join `status_master` `stm` on(`stm`.`Id` = `sm`.`Status_id`)) left join `batch_mst` `bm` on(`bm`.`Batch_Id` = `am`.`Batch_Id`)) where `am`.`IsDelete` = 0 and `am`.`IsActive` = 1 and `sm`.`Status_id` = 8 and `am`.`Batch_Id` = '910';

--
-- View structure for view `student_details`
--
DROP VIEW IF EXISTS `student_details`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY INVOKER VIEW `student_details` AS select `i`.`Student_Name` AS `Student_Name`,`i`.`Qualification` AS `Qualification`,`i`.`Inquiry_Type` AS `Inquiry_Type`,`i`.`Batch_Code` AS `Batch_Code`,`i`.`Inquiry_Dt` AS `Inquiry_Dt`,`i`.`Email` AS `Email`,`i`.`Present_Mobile` AS `Present_Mobile`,`cm`.`Course_Name` AS `Course_Name`,`mb`.`BatchCategory` AS `BatchCategory`,`sm`.`Status` AS `Status1`,`smtp`.`Status` AS `Status2` from (((((`student_inquiry` `i` left join `mst_batchcategory` `mb` on(`mb`.`id` = `i`.`Batch_Category_id`)) left join `status_master` `sm` on(`sm`.`Id` = `i`.`OnlineState`)) left join `student_master` `smm` on(`smm`.`Student_Id` = `i`.`Student_Id`)) left join `status_master` `smtp` on(`smtp`.`Id` = `smm`.`Status_id`)) left join `course_mst` `cm` on(`cm`.`Course_Id` = `i`.`Course_Id`)) where `i`.`Inquiry_Dt` > '2024-08-31' and `i`.`IsDelete` = 0 and `i`.`Admission` <> 1 group by `i`.`Email` order by `i`.`Inquiry_Dt` desc;

--
-- View structure for view `view_cv_shortlisted_before_2023`
--
DROP VIEW IF EXISTS `view_cv_shortlisted_before_2023`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY INVOKER VIEW `view_cv_shortlisted_before_2023` AS select `c`.`Student_Id` AS `Student_Id`,`sm`.`Student_Name` AS `Student_Name`,`sm`.`Present_Address` AS `Present_Address`,`sm`.`Present_Mobile` AS `Present_Mobile`,`sm`.`Present_Tel` AS `Present_Tel`,`sm`.`Email` AS `Email`,`s`.`TDate` AS `TDate`,`c`.`Placement` AS `Placement`,`s`.`CompanyName` AS `CompanyName` from ((`cv_shortlisted` `s` left join `cvchild` `c` on(`c`.`CV_Id` = `s`.`id`)) left join `student_master` `sm` on(`c`.`Student_Id` = `sm`.`Student_Id`)) where `s`.`TDate` < '2023-01-01';

--
-- View structure for view `vw_suvidya_pune_inquiries`
--
DROP VIEW IF EXISTS `vw_suvidya_pune_inquiries`;
CREATE ALGORITHM=UNDEFINED DEFINER=`sitadmin`@`%` SQL SECURITY DEFINER VIEW `vw_suvidya_pune_inquiries` AS select `si`.`Inquiry_Id` AS `inquiry_id`,`si`.`Student_Id` AS `legacy_student_id`,`si`.`Inquiry_Id` AS `Student_Id`,`si`.`Student_Name` AS `Student_Name`,`si`.`Present_Mobile` AS `Present_Mobile`,`si`.`Email` AS `Email`,`si`.`Inquiry_Dt` AS `Inquiry_Dt`,`si`.`Inquiry_From` AS `Inquiry_From`,`si`.`Inquiry_Type` AS `Inquiry_Type`,`si`.`Qualification` AS `Qualification`,`si`.`Discussion` AS `Discussion`,`sis`.`source_table_name` AS `source_table_name`,`sis`.`source_inquiry_id` AS `source_inquiry_id`,`sis`.`created_date` AS `source_created_date`,cast(str_to_date(`sis`.`created_date`,'%Y-%m-%d %H:%i:%s') as date) AS `source_created_day`,coalesce(nullif(`sis`.`course_name`,''),nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.select_course')),'')) AS `source_course`,nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.your_location')),'') AS `source_location`,coalesce(nullif(`sis`.`page_source`,''),nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.page_source')),'')) AS `source_page_source`,case when lcase(coalesce(nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.your_location')),''),'')) like '%pune%' then 1 else 0 end AS `has_pune_location`,case when lcase(coalesce(coalesce(nullif(`sis`.`page_source`,''),nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.page_source')),'')),'')) like '%pune%' then 1 else 0 end AS `has_pune_page_source`,case when lcase(coalesce(`si`.`Inquiry_From`,'')) like '%pune%' or lcase(coalesce(`si`.`Discussion`,'')) like '%pune%' then 1 else 0 end AS `has_pune_listing_text` from (`student_inquiry` `si` join `suvidya_inquiry_sync` `sis` on(`sis`.`inquiry_id` in (`si`.`Inquiry_Id`,`si`.`Student_Id`))) where lcase(coalesce(coalesce(nullif(`sis`.`page_source`,''),nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.page_source')),'')),'')) like '%pune%' or lcase(coalesce(nullif(json_unquote(json_extract(`sis`.`payload_json`,'$.your_location')),''),'')) like '%pune%' or lcase(coalesce(`si`.`Inquiry_From`,'')) like '%pune%' or lcase(coalesce(`si`.`Discussion`,'')) like '%pune%';

SET FOREIGN_KEY_CHECKS=1;
