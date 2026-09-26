import { getPool } from '@/lib/db';

/**
 * Appointment Booking & Counsellor Scheduling — table definitions.
 *
 * Tables are created lazily on first use (same pattern as lib/support-tickets.ts),
 * so no migration step is required on deploy.
 *
 * Concurrency notes:
 *  - appt_settings row id=1 doubles as the booking mutex: every booking /
 *    reschedule / reassignment takes `SELECT … FOR UPDATE` on it, serialising
 *    slot allocation across all serverless instances.
 *  - appointments.slot_guard is a UNIQUE last line of defence: it holds
 *    "counsellor|date|start" while the appointment occupies its slot and is NULL
 *    once cancelled, so two active appointments can never share a start time.
 *
 * `staff_tasks` and `staff_notifications` are deliberately generic (source_type /
 * channel columns) so the future Task Management module and email / SMS /
 * WhatsApp reminders can build on them instead of adding new tables.
 */

let ensured: Promise<void> | null = null;

export function ensureAppointmentTables(): Promise<void> {
  if (!ensured) {
    ensured = createTables().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

async function createTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_settings (
      id TINYINT NOT NULL PRIMARY KEY,
      working_days VARCHAR(20) NOT NULL DEFAULT '0,1,2,3,4,5,6',
      start_time TIME NOT NULL DEFAULT '09:00:00',
      end_time TIME NOT NULL DEFAULT '16:00:00',
      slot_minutes SMALLINT NOT NULL DEFAULT 30,
      booking_window_days SMALLINT NOT NULL DEFAULT 30,
      min_notice_minutes SMALLINT NOT NULL DEFAULT 60,
      use_holiday_master TINYINT(1) NOT NULL DEFAULT 1,
      office_address VARCHAR(500) NULL,
      default_meeting_link VARCHAR(500) NULL,
      contact_phone VARCHAR(40) NULL,
      contact_email VARCHAR(120) NULL,
      updated_by INT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`INSERT IGNORE INTO appt_settings (id) VALUES (1)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_breaks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(100) NOT NULL DEFAULT 'Break',
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      weekdays VARCHAR(20) NULL COMMENT 'CSV of 0-6; NULL = every working day',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_exceptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      exc_date DATE NOT NULL,
      exc_type VARCHAR(20) NOT NULL DEFAULT 'blocked' COMMENT 'holiday | blocked',
      label VARCHAR(150) NULL,
      start_time TIME NULL COMMENT 'NULL start/end = whole day',
      end_time TIME NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_appt_exc_date (exc_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_counsellors (
      user_id INT NOT NULL PRIMARY KEY COMMENT 'awt_adminuser.id',
      emp_id INT NULL COMMENT 'office_employee_mst.Emp_Id (weekly off)',
      display_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NULL,
      phone VARCHAR(40) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      modes VARCHAR(20) NOT NULL DEFAULT 'both' COMMENT 'both | online | offline',
      use_custom_hours TINYINT(1) NOT NULL DEFAULT 0,
      working_days VARCHAR(20) NULL,
      start_time TIME NULL,
      end_time TIME NULL,
      meeting_link VARCHAR(500) NULL,
      last_assigned_at DATETIME(6) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_counsellor_blocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      counsellor_user_id INT NOT NULL,
      start_at DATETIME NOT NULL,
      end_at DATETIME NOT NULL,
      block_type VARCHAR(20) NOT NULL DEFAULT 'blocked' COMMENT 'blocked | leave | task | unavailable',
      reason VARCHAR(255) NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_appt_blocks_c (counsellor_user_id, start_at, end_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      appointment_code VARCHAR(30) NOT NULL,
      public_token CHAR(32) NOT NULL,
      first_name VARCHAR(80) NOT NULL,
      last_name VARCHAR(80) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(150) NOT NULL,
      qualification VARCHAR(120) NULL,
      experience VARCHAR(80) NULL,
      course_id INT NULL,
      program_name VARCHAR(200) NULL,
      needs_guidance TINYINT(1) NOT NULL DEFAULT 0,
      mode VARCHAR(10) NOT NULL COMMENT 'online | offline',
      appt_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      duration_minutes SMALLINT NOT NULL,
      counsellor_user_id INT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Scheduled' COMMENT 'Scheduled | Completed | No Show | Cancelled',
      slot_guard VARCHAR(64) NULL,
      meeting_link VARCHAR(500) NULL,
      location VARCHAR(500) NULL,
      notes TEXT NULL,
      reschedule_count SMALLINT NOT NULL DEFAULT 0,
      source VARCHAR(20) NOT NULL DEFAULT 'public',
      client_ip VARCHAR(64) NULL,
      applicant_email_sent_at DATETIME NULL,
      counsellor_email_sent_at DATETIME NULL,
      email_error VARCHAR(500) NULL,
      calendly_event_uri VARCHAR(255) NULL,
      calendly_invitee_uri VARCHAR(255) NULL,
      calendly_reschedule_url VARCHAR(500) NULL,
      calendly_cancel_url VARCHAR(500) NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_appt_code (appointment_code),
      UNIQUE KEY uq_appt_slot_guard (slot_guard),
      UNIQUE KEY uq_appt_calendly_invitee (calendly_invitee_uri),
      INDEX idx_appt_date (appt_date, start_time),
      INDEX idx_appt_counsellor (counsellor_user_id, appt_date),
      INDEX idx_appt_status (status, appt_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Calendly sync columns — added in place for installs created before the integration.
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'`
  );
  const have = new Set((cols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME));
  if (!have.has('calendly_invitee_uri')) {
    await pool.query(`
      ALTER TABLE appointments
        ADD COLUMN calendly_event_uri VARCHAR(255) NULL,
        ADD COLUMN calendly_invitee_uri VARCHAR(255) NULL,
        ADD COLUMN calendly_reschedule_url VARCHAR(500) NULL,
        ADD COLUMN calendly_cancel_url VARCHAR(500) NULL,
        ADD UNIQUE KEY uq_appt_calendly_invitee (calendly_invitee_uri)
    `);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_integrations (
      k VARCHAR(80) NOT NULL PRIMARY KEY,
      v TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointment_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      appointment_id INT NOT NULL,
      action VARCHAR(30) NOT NULL COMMENT 'created | rescheduled | reassigned | status | edited',
      from_value VARCHAR(255) NULL,
      to_value VARCHAR(255) NULL,
      note VARCHAR(500) NULL,
      actor_user_id INT NULL,
      actor_name VARCHAR(150) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_appt_hist (appointment_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appt_code_counters (
      day DATE NOT NULL PRIMARY KEY,
      seq INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      details TEXT NULL,
      due_date DATE NULL,
      due_time TIME NULL,
      duration_minutes SMALLINT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open | done | cancelled',
      source_type VARCHAR(40) NULL COMMENT 'e.g. appointment',
      source_id INT NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_staff_tasks_owner (owner_user_id, due_date),
      INDEX idx_staff_tasks_source (source_type, source_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      channel VARCHAR(20) NOT NULL DEFAULT 'in_app' COMMENT 'in_app | email | sms | whatsapp',
      kind VARCHAR(40) NOT NULL COMMENT 'e.g. appointment_reminder',
      title VARCHAR(255) NOT NULL,
      body TEXT NULL,
      link VARCHAR(500) NULL,
      source_type VARCHAR(40) NULL,
      source_id INT NULL,
      dedupe_key VARCHAR(191) NOT NULL,
      deliver_after DATETIME NULL,
      delivered_at DATETIME NULL,
      read_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_staff_notif_dedupe (dedupe_key),
      INDEX idx_staff_notif_user (user_id, channel, read_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
